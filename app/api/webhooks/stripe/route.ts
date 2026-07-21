import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/checkout/stripe";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { getActiveProductBySku } from "@/lib/checkout/products";
import { syncOrderToHighLevel } from "@/lib/checkout/highlevel";

export const runtime = "nodejs";

/*
 * Stripe webhook. Every event is signature-verified. Fulfillment is
 * idempotent at two levels: a processed-events table skips duplicate
 * event ids, and the order is claimed with a conditional status update so
 * only one delivery ever runs the HighLevel sync. A HighLevel failure is
 * caught, logged, and flagged for retry; it never fails the payment.
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

  // Event-level idempotency: if we have already recorded this event id, ack.
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
    }
    await db.from("stripe_events").insert({ id: event.id, type: event.type });
  } catch (err) {
    // Do not record the event, so Stripe retries. A captured payment is
    // never reversed here; the worst case is a retried fulfillment.
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleSucceeded(
  db: ReturnType<typeof supabaseAdmin>,
  pi: Stripe.PaymentIntent,
) {
  // Claim the order: only the delivery that flips pending/failed -> paid
  // proceeds to fulfillment. A duplicate finds it already paid and stops.
  const { data: claimed } = await db
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("stripe_payment_intent_id", pi.id)
    .neq("status", "paid")
    .select()
    .maybeSingle();

  if (!claimed) return; // unknown intent or already paid

  await db.from("order_events").insert({
    order_id: claimed.id,
    event_type: "payment_succeeded",
    payload: { stripe_payment_intent_id: pi.id, amount_cents: pi.amount },
  });

  // HighLevel sync, decoupled: failure is logged and retryable.
  try {
    const product = await getActiveProductBySku((claimed.metadata?.sku as string) ?? "");
    const tags = (product?.metadata?.hl_tags as string[]) ?? ["ghlv-purchase"];
    const { data: customer } = await db
      .from("customers")
      .select("name, phone, company")
      .eq("id", claimed.customer_id)
      .maybeSingle();

    const { contactId, opportunityId } = await syncOrderToHighLevel({
      email: claimed.customer_email,
      name: customer?.name ?? undefined,
      phone: customer?.phone ?? undefined,
      company: customer?.company ?? undefined,
      tags,
      opportunityName: `${product?.name ?? "Order"} - ${claimed.customer_email}`,
      amountDollars: Math.round(claimed.amount_cents) / 100,
    });

    await db
      .from("orders")
      .update({ highlevel_contact_id: contactId, highlevel_opportunity_id: opportunityId })
      .eq("id", claimed.id);
    await db
      .from("customers")
      .update({ highlevel_contact_id: contactId })
      .eq("id", claimed.customer_id);
    await db.from("order_events").insert({
      order_id: claimed.id,
      event_type: "hl_synced",
      payload: { contactId, opportunityId, tags },
    });
  } catch (err) {
    await db
      .from("orders")
      .update({ metadata: { ...(claimed.metadata ?? {}), hl_sync_failed: true } })
      .eq("id", claimed.id);
    await db.from("order_events").insert({
      order_id: claimed.id,
      event_type: "hl_sync_failed",
      payload: { error: (err as Error).message },
    });
  }
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
