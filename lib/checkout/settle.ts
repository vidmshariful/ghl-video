import "server-only";
import type Stripe from "stripe";
import type { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { syncPaidOrderToHighLevel } from "@/lib/checkout/fulfill";

type DB = ReturnType<typeof supabaseAdmin>;

/*
 * Settle a succeeded PaymentIntent onto its order. This is the ONE place that
 * turns a paid intent into a paid order, shared by two callers so they can
 * never drift:
 *
 *  - the Stripe webhook (`fulfill: true`): marks paid AND syncs to HighLevel,
 *    surfacing a sync failure so the handler can return non-2xx and let Stripe
 *    re-deliver.
 *  - the confirmation page's status endpoint (`fulfill: false`): a reconcile
 *    that only marks paid, so the buyer sees success even when the webhook is
 *    slow, missed, or (in local dev) can't reach the server at all. HighLevel
 *    sync stays the webhook's job, so a local test never writes to HighLevel.
 *
 * Marking paid is idempotent (a conditional flip that wins only once) and
 * re-reads on a lost flip, so a webhook and a reconcile racing the same intent
 * settle to one paid order with exactly one fulfillment attempt.
 */
export async function settlePaidIntent(
  db: DB,
  pi: Stripe.PaymentIntent,
  opts: { fulfill?: boolean } = {},
): Promise<{ status: string; syncError: string | null }> {
  const fulfill = opts.fulfill ?? true;

  const { data: order } = await db
    .from("orders")
    .select("*")
    .eq("stripe_payment_intent_id", pi.id)
    .maybeSingle();
  if (!order) return { status: "unknown", syncError: null };

  if (order.status !== "paid") {
    const { data: flipped } = await db
      .from("orders")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        invoice_number:
          order.invoice_number ??
          `GV-${(order.id as string).replace(/-/g, "").slice(0, 8).toUpperCase()}`,
      })
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
    } else {
      // lost the flip to a concurrent caller: re-read the settled truth so the
      // fulfillment gate below sees the real status and opportunity id.
      const { data: fresh } = await db
        .from("orders")
        .select("status, highlevel_opportunity_id")
        .eq("id", order.id)
        .maybeSingle();
      if (fresh) {
        order.status = fresh.status;
        order.highlevel_opportunity_id = fresh.highlevel_opportunity_id;
      }
    }
  }

  let syncError: string | null = null;
  if (fulfill && order.status === "paid" && !order.highlevel_opportunity_id) {
    try {
      const result = await syncPaidOrderToHighLevel(db, order);
      if (!result.ok) syncError = result.error;
    } catch (err) {
      syncError = (err as Error).message;
    }
  }

  return { status: order.status as string, syncError };
}
