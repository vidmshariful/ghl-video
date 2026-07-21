import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/checkout/stripe";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { syncPaidOrderToHighLevel } from "@/lib/checkout/fulfill";

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
  const { data: order } = await db
    .from("orders")
    .select("*")
    .eq("stripe_payment_intent_id", pi.id)
    .maybeSingle();
  if (!order) return; // unknown intent

  // Mark paid exactly once. The conditional update flips only on the first
  // delivery; the payment_succeeded event is logged the same one time.
  if (order.status !== "paid") {
    const { data: flipped } = await db
      .from("orders")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", order.id)
      .neq("status", "paid")
      .select()
      .maybeSingle();
    if (flipped) {
      order.status = "paid";
      order.highlevel_opportunity_id = flipped.highlevel_opportunity_id;
      await db.from("order_events").insert({
        order_id: order.id,
        event_type: "payment_succeeded",
        payload: { stripe_payment_intent_id: pi.id, amount_cents: pi.amount },
      });
    }
  }

  // Fulfill: re-entrant, gated on the opportunity not yet existing. A retry
  // that finds the order paid-but-unsynced re-runs this idempotently. On
  // failure, throw so the webhook returns non-2xx and Stripe re-delivers.
  if (order.status === "paid" && !order.highlevel_opportunity_id) {
    const result = await syncPaidOrderToHighLevel(db, order);
    if (!result.ok) throw new Error(result.error);
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
