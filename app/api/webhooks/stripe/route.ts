import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/checkout/stripe";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { syncSubscriptionToHighLevel } from "@/lib/checkout/fulfill";
import { settlePaidIntent } from "@/lib/checkout/settle";
import { ALARM_KINDS, raise } from "@/lib/alarm";

export const runtime = "nodejs";

/*
 * Stripe webhook. Every event is signature-verified. Two properties keep
 * the money path correct:
 *
 *  - Paying is decoupled from fulfilling. The order is marked paid once
 *    (idempotent conditional update), independent of HighLevel, so the
 *    buyer always sees success. Fulfillment (HighLevel sync) is a SEPARATE,
 *    re-entrant step gated on whether the opportunity already exists, not
 *    on the paid-claim. So a fault after "paid" but before sync completes
 *    is recoverable: the sync throws, the handler returns non-2xx, Stripe
 *    re-delivers, and the re-entrant handler retries the sync until it
 *    lands. The payment is never reversed by a HighLevel failure.
 *  - Idempotency: the paid-claim flips only on the first delivery, and the
 *    sync is skipped once an opportunity id is stored, so duplicates never
 *    double-charge, double-mark, or double-fulfill.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    return NextResponse.json(
      { error: `Signature verification failed: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  const db = supabaseAdmin();

  // Fast path for exact duplicates of an already-fully-processed event.
  const { data: seen } = await db
    .from("stripe_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();
  if (seen) return NextResponse.json({ received: true, duplicate: true });

  try {
    if (event.type === "payment_intent.succeeded") {
      await handleSucceeded(db, event.data.object as Stripe.PaymentIntent);
    } else if (event.type === "payment_intent.payment_failed") {
      await handleFailed(db, event.data.object as Stripe.PaymentIntent);
    } else if (event.type === "charge.refunded") {
      await handleChargeRefunded(db, event.data.object as Stripe.Charge);
    } else if (event.type === "charge.dispute.created") {
      await handleDisputeCreated(db, event.data.object as Stripe.Dispute);
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated"
    ) {
      await handleSubscription(db, event.data.object as Stripe.Subscription);
    } else if (event.type === "customer.subscription.deleted") {
      await handleSubscriptionDeleted(db, event.data.object as Stripe.Subscription);
    }
    // Recorded only after full success, so a thrown fulfillment leaves the
    // event unrecorded and Stripe retries it.
    await db.from("stripe_events").insert({ id: event.id, type: event.type });
  } catch (err) {
    /*
     * Returning 500 is the correct handling: Stripe re-delivers and the retry
     * usually lands, which is why this is not raised as critical and why it
     * waits for three occurrences before telling anybody. One failure here is
     * the system working. The same event failing over and over is an order
     * that is paid for and going nowhere.
     *
     * Fingerprinted by event type rather than event id, so a broken HighLevel
     * token shows up as one line that happened 240 times instead of 240 lines.
     */
    await raise(db, {
      kind: ALARM_KINDS.WEBHOOK_FAILED,
      fingerprint: `${ALARM_KINDS.WEBHOOK_FAILED}:${event.type}`,
      message: (err as Error).message,
      context: { eventType: event.type, eventId: event.id },
      notifyAfter: 3,
    });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleSucceeded(
  db: ReturnType<typeof supabaseAdmin>,
  pi: Stripe.PaymentIntent,
) {
  // Mark paid (idempotent) AND fulfill (re-entrant, gated on the opportunity
  // not yet existing). On a sync failure, throw so the webhook returns non-2xx
  // and Stripe re-delivers. Shared with the confirmation-page reconcile.
  const first = await settlePaidIntent(db, pi, { fulfill: true });
  const status = first.status;
  let syncError = first.syncError;

  // Money captured with no order row: finalize never landed (crash
  // mid-checkout, or a client confirmed the raw secret). Reconstruct a
  // durable order from the intent so a charge never goes unrecorded, then
  // settle it normally. Intents without a recognizable sku (created by some
  // other integration on this Stripe account) are logged and left alone.
  if (status === "unknown") {
    /*
     * Subscription billing is not an orphan.
     *
     * A plan's invoice raises payment_intent.succeeded with no sku and no
     * order row, because a subscription lives in `subscriptions` and never
     * had an order. Left alone this reached the orphan path and raised a
     * CRITICAL "money taken, nothing to attach it to" alarm, which is both
     * wrong and corrosive: it would fire again on every monthly renewal for
     * every subscriber, and an alarm screen that cries wolf monthly is one
     * nobody reads on the day it matters. The subscription lifecycle events
     * own these payments.
     */
    if (await isSubscriptionBilling(db, pi)) {
      await recordSubscriptionPayment(db, pi);
    } else {
      const recovered = await recoverOrphanPaidIntent(db, pi);
      if (recovered) {
        ({ syncError } = await settlePaidIntent(db, pi, { fulfill: true }));
      }
    }
  }

  if (syncError) {
    /*
     * The buyer is fine: they paid, the order is marked paid, and they saw
     * success. What did not happen is the HighLevel sync, so the studio has
     * no contact and no opportunity for work that is already sold.
     *
     * Raised before the throw so it is recorded even though the throw is the
     * thing that gets Stripe to retry. Three occurrences before anyone is
     * told, for the same reason as the outer handler: the retry usually wins.
     */
    await raise(db, {
      kind: ALARM_KINDS.FULFILL_FAILED,
      fingerprint: ALARM_KINDS.FULFILL_FAILED,
      message: syncError,
      context: { paymentIntent: pi.id, orderStatus: status },
      notifyAfter: 3,
    });
    throw new Error(syncError);
  }
}

/*
 * Does this payment belong to a subscription rather than to an order?
 *
 * Judged on two signals together, because either alone is too loose. The
 * Stripe customer must be one we already hold a subscription row for, and
 * the intent must carry none of checkout's own metadata: `finalize` stamps
 * sku and order_id onto every one-time intent BEFORE the pending order is
 * written, so a genuine one-time payment that stranded still has them and
 * still gets the alarm it deserves.
 *
 * `pi.invoice` would say this outright, but Stripe dropped it from the
 * PaymentIntent shape in this API version, so we ask our own records instead
 * of trusting an untyped field.
 */
async function isSubscriptionBilling(
  db: ReturnType<typeof supabaseAdmin>,
  pi: Stripe.PaymentIntent,
): Promise<boolean> {
  const meta = pi.metadata ?? {};
  if (meta.sku || meta.order_id) return false;
  const customerId = typeof pi.customer === "string" ? pi.customer : pi.customer?.id;
  if (!customerId) return false;
  const { data } = await db
    .from("subscriptions")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

/*
 * Keep the recurring charge, now that we know what it is.
 *
 * The transactions list showed a plan once, when it started, and never again,
 * so the one stream that repeats every month was the one you could not see.
 * The intent id is unique on the table, so Stripe re-delivering an event is
 * a no-op rather than revenue counted twice.
 *
 * Fail-soft on purpose: a bookkeeping row must never be the reason a webhook
 * returns non-2xx and Stripe starts retrying a payment that already worked.
 */
async function recordSubscriptionPayment(
  db: ReturnType<typeof supabaseAdmin>,
  pi: Stripe.PaymentIntent,
): Promise<void> {
  try {
    const customerId = typeof pi.customer === "string" ? pi.customer : pi.customer?.id;
    const { data: sub } = customerId
      ? await db
          .from("subscriptions")
          .select("id, customer_email, plan_name, product:products(name)")
          .eq("stripe_customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };
    if (!sub) {
      console.info(`[webhook] ${pi.id} looks like subscription billing but no plan matched`);
      return;
    }
    const { error } = await db.from("subscription_payments").upsert(
      {
        subscription_id: sub.id as string,
        customer_email: String(sub.customer_email),
        amount_cents: pi.amount_received || pi.amount,
        currency: pi.currency,
        stripe_payment_intent_id: pi.id,
        plan_name:
          (sub.plan_name as string | null) ??
          (sub.product as { name?: string } | null)?.name ??
          null,
        paid_at: new Date((pi.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
      },
      { onConflict: "stripe_payment_intent_id", ignoreDuplicates: true },
    );
    if (error) console.error(`[webhook] recurring payment not stored:`, error.message);
  } catch (e) {
    console.error("[webhook] recordSubscriptionPayment failed:", e instanceof Error ? e.message : e);
  }
}

async function recoverOrphanPaidIntent(
  db: ReturnType<typeof supabaseAdmin>,
  pi: Stripe.PaymentIntent,
): Promise<boolean> {
  const sku = typeof pi.metadata?.sku === "string" ? pi.metadata.sku : "";
  const { data: product } = sku
    ? await db.from("products").select("*").eq("sku", sku).maybeSingle()
    : { data: null };
  if (!product) {
    /*
     * Critical and told immediately, with no retry threshold, because this is
     * the one failure in this file that no retry can fix. Money has been
     * captured and there is nothing to attach it to, so every re-delivery
     * lands here again. Somebody has to look at it by hand.
     *
     * Fingerprinted per intent: each stranded payment is its own piece of
     * work and must not hide behind another one's line.
     */
    await raise(db, {
      kind: ALARM_KINDS.ORPHAN_UNRECOVERABLE,
      fingerprint: `${ALARM_KINDS.ORPHAN_UNRECOVERABLE}:${pi.id}`,
      severity: "critical",
      message: `A payment of ${(pi.amount / 100).toFixed(2)} ${pi.currency.toUpperCase()} was taken but could not be matched to a product, so no order exists for it.`,
      context: {
        paymentIntent: pi.id,
        sku: sku || "(none on the payment)",
        amount: `${(pi.amount / 100).toFixed(2)} ${pi.currency.toUpperCase()}`,
      },
    });
    return false;
  }

  let email = (
    (typeof pi.metadata?.customer_email === "string" ? pi.metadata.customer_email : "") ||
    pi.receipt_email ||
    ""
  )
    .toLowerCase()
    .trim();
  if (!email && typeof pi.latest_charge === "string") {
    try {
      const charge = await stripe().charges.retrieve(pi.latest_charge);
      email = (charge.billing_details?.email ?? "").toLowerCase().trim();
    } catch {}
  }
  if (!email) email = `unknown+${pi.id.toLowerCase()}@recovered.ghlvideo.com`;

  await db
    .from("customers")
    .upsert({ email }, { onConflict: "email", ignoreDuplicates: true });
  const { data: customer } = await db
    .from("customers")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (!customer) {
    console.error(`[webhook] could not create customer for orphan intent ${pi.id}`);
    return false;
  }

  const chargedCents = pi.amount_received || pi.amount;
  const { data: order, error: orderErr } = await db
    .from("orders")
    .insert({
      product_id: product.id,
      customer_id: customer.id,
      customer_email: email,
      amount_cents: chargedCents,
      currency: pi.currency ?? product.currency,
      status: "pending",
      stripe_payment_intent_id: pi.id,
      metadata: {
        sku: product.sku,
        base_cents: product.price_cents,
        recovered: true,
        ...(typeof pi.metadata?.coupon_code === "string" && pi.metadata.coupon_code
          ? {
              coupon: {
                code: pi.metadata.coupon_code,
                discount_cents: Number(pi.metadata.discount_cents) || 0,
              },
            }
          : {}),
      },
    })
    .select("id")
    .single();
  if (orderErr || !order) {
    // A concurrent delivery may have recovered it first; that's success here.
    if (orderErr?.code === "23505") return true;
    console.error(
      `[webhook] failed to recover orphan intent ${pi.id}: ${orderErr?.message ?? "no row"}`,
    );
    return false;
  }

  console.error(`[webhook] recovered orphan paid intent ${pi.id} as order ${order.id}`);
  await db.from("order_events").insert({
    order_id: order.id,
    event_type: "order_recovered",
    payload: { stripe_payment_intent_id: pi.id, amount_cents: chargedCents },
  });
  return true;
}

async function handleChargeRefunded(
  db: ReturnType<typeof supabaseAdmin>,
  charge: Stripe.Charge,
) {
  // Covers refunds issued from the Stripe dashboard, which never touch the
  // admin refund route. Idempotent with it: the conditional flip wins once.
  const piId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;
  if (!piId) return;
  const { data: order } = await db
    .from("orders")
    .select("id, status")
    .eq("stripe_payment_intent_id", piId)
    .maybeSingle();
  if (!order) return;

  if (charge.refunded) {
    const { data: flipped } = await db
      .from("orders")
      .update({ status: "refunded" })
      .eq("id", order.id)
      .eq("status", "paid")
      .select("id")
      .maybeSingle();
    if (flipped) {
      await db.from("order_events").insert({
        order_id: order.id,
        event_type: "refunded",
        payload: { source: "stripe", amount_cents: charge.amount_refunded },
      });
      // exactly-once via the flip; fail-soft inside
      const { sendOrderRefundedEmail } = await import("@/lib/email/notify");
      await sendOrderRefundedEmail(db, order.id, charge.amount_refunded);
    }
  } else if (charge.amount_refunded > 0) {
    await db.from("order_events").insert({
      order_id: order.id,
      event_type: "partial_refund",
      payload: { source: "stripe", amount_cents: charge.amount_refunded },
    });
  }
}

async function handleDisputeCreated(
  db: ReturnType<typeof supabaseAdmin>,
  dispute: Stripe.Dispute,
) {
  const piId =
    typeof dispute.payment_intent === "string"
      ? dispute.payment_intent
      : dispute.payment_intent?.id;
  if (!piId) return;
  const { data: order } = await db
    .from("orders")
    .select("id, metadata")
    .eq("stripe_payment_intent_id", piId)
    .maybeSingle();
  if (!order) {
    console.error(`[webhook] dispute ${dispute.id} has no matching order (intent ${piId})`);
    return;
  }
  console.error(`[webhook] dispute ${dispute.id} opened on order ${order.id}`);
  await db
    .from("orders")
    .update({
      metadata: { ...((order.metadata as Record<string, unknown> | null) ?? {}), disputed: true },
    })
    .eq("id", order.id);
  await db.from("order_events").insert({
    order_id: order.id,
    event_type: "dispute_created",
    payload: {
      dispute_id: dispute.id,
      reason: dispute.reason,
      amount_cents: dispute.amount,
      status: dispute.status,
    },
  });
  // time-sensitive team alert; fail-soft inside
  const { sendDisputeAlertEmail } = await import("@/lib/email/notify");
  await sendDisputeAlertEmail(db, order.id, {
    amountCents: dispute.amount,
    reason: String(dispute.reason ?? ""),
  });
}

async function handleFailed(
  db: ReturnType<typeof supabaseAdmin>,
  pi: Stripe.PaymentIntent,
) {
  const { data: order } = await db
    .from("orders")
    .update({ status: "failed" })
    .eq("stripe_payment_intent_id", pi.id)
    .eq("status", "pending")
    .select()
    .maybeSingle();
  if (order) {
    await db.from("order_events").insert({
      order_id: order.id,
      event_type: "payment_failed",
      payload: {
        stripe_payment_intent_id: pi.id,
        reason: pi.last_payment_error?.message ?? null,
      },
    });
  }
}

async function handleSubscription(
  db: ReturnType<typeof supabaseAdmin>,
  sub: Stripe.Subscription,
) {
  let { data: row } = await db
    .from("subscriptions")
    .select("*")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle();
  if (!row) {
    // Our subscription (it carries our sku + email metadata) but no local
    // row: the create-subscription insert failed after Stripe succeeded.
    // Reconstruct it so a live billing relationship is never invisible.
    // Subscriptions created outside our flow carry no sku and are skipped.
    row = await recoverOrphanSubscription(db, sub);
    if (!row) return;
  }

  // current_period_end lives on the subscription in older API versions and
  // on each subscription item in the current one.
  const item = sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined;
  const periodEnd =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    item?.current_period_end;
  await db
    .from("subscriptions")
    .update({
      status: sub.status,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end,
    })
    .eq("id", row.id);

  // First activation: tag the customer in HighLevel once (flagged, not
  // thrown). Claimed atomically: created + updated events can arrive nearly
  // simultaneously on activation, and both would pass a plain read check.
  // A failed sync writes metadata without the claim key, releasing it.
  if (sub.status === "active" && !row.metadata?.hl_synced) {
    const { data: claimed } = await db
      .from("subscriptions")
      .update({
        metadata: {
          ...((row.metadata as Record<string, unknown> | null) ?? {}),
          hl_synced: "claimed",
        },
      })
      .eq("id", row.id)
      .is("metadata->>hl_synced", null)
      .select("id")
      .maybeSingle();
    if (claimed) {
      await syncSubscriptionToHighLevel(db, row);
      // same atomic claim = exactly-once welcome email; fail-soft inside
      const { sendSubscriptionStartedEmail } = await import("@/lib/email/notify");
      await sendSubscriptionStartedEmail(db, row.id);
    }
  }
}

async function recoverOrphanSubscription(
  db: ReturnType<typeof supabaseAdmin>,
  sub: Stripe.Subscription,
) {
  const sku = typeof sub.metadata?.sku === "string" ? sub.metadata.sku : "";
  const email = (
    typeof sub.metadata?.customer_email === "string" ? sub.metadata.customer_email : ""
  )
    .toLowerCase()
    .trim();
  if (!sku || !email) return null;

  const { data: product } = await db
    .from("products")
    .select("*")
    .eq("sku", sku)
    .maybeSingle();
  if (!product) return null;

  await db.from("customers").upsert({ email }, { onConflict: "email", ignoreDuplicates: true });
  const { data: customer } = await db
    .from("customers")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (!customer) return null;

  const stripeCustomerId =
    typeof sub.customer === "string" ? sub.customer : (sub.customer?.id ?? null);
  const { data: inserted, error } = await db
    .from("subscriptions")
    .insert({
      customer_id: customer.id,
      customer_email: email,
      product_id: product.id,
      stripe_subscription_id: sub.id,
      stripe_customer_id: stripeCustomerId,
      status: sub.status,
      plan_name: product.name,
      amount_cents: product.price_cents,
      currency: product.currency,
      interval: "month",
      // carry the affiliate ref off the Stripe sub so a recovered row still
      // credits the partner (the create-subscription insert may lose the race
      // to this recovery, since the sub is created default_incomplete).
      metadata: {
        sku,
        recovered: true,
        ...(typeof sub.metadata?.ref === "string" && sub.metadata.ref
          ? { ref: sub.metadata.ref }
          : {}),
      },
    })
    .select("*")
    .single();
  if (error) {
    // A concurrent delivery may have recovered it first.
    if (error.code === "23505") {
      const { data: raced } = await db
        .from("subscriptions")
        .select("*")
        .eq("stripe_subscription_id", sub.id)
        .maybeSingle();
      return raced;
    }
    console.error(`[webhook] failed to recover subscription ${sub.id}: ${error.message}`);
    return null;
  }
  console.error(`[webhook] recovered subscription ${sub.id} for ${email}`);
  return inserted;
}

async function handleSubscriptionDeleted(
  db: ReturnType<typeof supabaseAdmin>,
  sub: Stripe.Subscription,
) {
  // conditional flip: the first delivery wins and sends the goodbye email once
  const { data: flipped } = await db
    .from("subscriptions")
    .update({ status: "canceled", cancel_at_period_end: false })
    .eq("stripe_subscription_id", sub.id)
    .neq("status", "canceled")
    .select("id")
    .maybeSingle();
  if (flipped) {
    const { sendSubscriptionCanceledEmail } = await import("@/lib/email/notify");
    await sendSubscriptionCanceledEmail(db, flipped.id);
  }
}
