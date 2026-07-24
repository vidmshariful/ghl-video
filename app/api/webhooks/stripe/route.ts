import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/checkout/stripe";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { syncSubscriptionToHighLevel } from "@/lib/checkout/fulfill";
import { settlePaidIntent } from "@/lib/checkout/settle";

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
    const recovered = await recoverOrphanPaidIntent(db, pi);
    if (recovered) {
      ({ syncError } = await settlePaidIntent(db, pi, { fulfill: true }));
    }
  }

  if (syncError) throw new Error(syncError);
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
    console.error(
      `[webhook] paid intent ${pi.id} has no order and no recognizable sku ("${sku}"); not recovered`,
    );
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
      metadata: { sku: product.sku, base_cents: product.price_cents, recovered: true },
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
  const { data: row } = await db
    .from("subscriptions")
    .select("*")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle();
  if (!row) return; // created outside our flow

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
    if (claimed) await syncSubscriptionToHighLevel(db, row);
  }
}

async function handleSubscriptionDeleted(
  db: ReturnType<typeof supabaseAdmin>,
  sub: Stripe.Subscription,
) {
  await db
    .from("subscriptions")
    .update({ status: "canceled", cancel_at_period_end: false })
    .eq("stripe_subscription_id", sub.id);
}
