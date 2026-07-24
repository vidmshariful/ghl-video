import "server-only";
import type Stripe from "stripe";
import type { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { syncPaidOrderToHighLevel } from "@/lib/checkout/fulfill";

type DB = ReturnType<typeof supabaseAdmin>;

/* Sentinel stored in highlevel_opportunity_id while a sync is in flight, so
 * the claim is a single conditional update. A crash mid-sync can strand it;
 * the admin resync action treats it as not-synced and recovers. */
export const HL_SYNC_CLAIM = "sync-in-progress";

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
 *
 * The flip verifies the money actually captured against the order's amount.
 * A divergence (an intent confirmed against a stale amount) still records the
 * payment, but flags the order (metadata.amount_mismatch + an audit event) and
 * holds auto-fulfillment for admin review via the resync action, so the wrong
 * thing is never silently delivered.
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
    const chargedCents = pi.amount_received || pi.amount;
    const mismatch =
      chargedCents !== order.amount_cents ||
      (pi.currency ?? "usd").toLowerCase() !==
        ((order.currency as string | null) ?? "usd").toLowerCase();
    const meta = (order.metadata as Record<string, unknown> | null) ?? {};

    const { data: flipped } = await db
      .from("orders")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        invoice_number:
          order.invoice_number ??
          `GV-${(order.id as string).replace(/-/g, "").slice(0, 8).toUpperCase()}`,
        ...(mismatch
          ? {
              metadata: {
                ...meta,
                amount_mismatch: {
                  expected_cents: order.amount_cents,
                  charged_cents: chargedCents,
                  currency: pi.currency,
                },
              },
            }
          : {}),
      })
      .eq("id", order.id)
      .neq("status", "paid")
      .select()
      .maybeSingle();
    if (flipped) {
      order.status = "paid";
      order.highlevel_opportunity_id = flipped.highlevel_opportunity_id;
      order.metadata = flipped.metadata;
      await db.from("order_events").insert({
        order_id: order.id,
        event_type: "payment_succeeded",
        payload: { stripe_payment_intent_id: pi.id, amount_cents: chargedCents },
      });
      if (mismatch) {
        console.error(
          `[settle] amount mismatch on order ${order.id}: expected ${order.amount_cents} ${order.currency}, charged ${chargedCents} ${pi.currency}`,
        );
        await db.from("order_events").insert({
          order_id: order.id,
          event_type: "amount_mismatch",
          payload: {
            expected_cents: order.amount_cents,
            charged_cents: chargedCents,
            currency: pi.currency,
          },
        });
      }
    } else {
      // lost the flip to a concurrent caller: re-read the settled truth so the
      // fulfillment gate below sees the real status and opportunity id.
      const { data: fresh } = await db
        .from("orders")
        .select("status, highlevel_opportunity_id, metadata")
        .eq("id", order.id)
        .maybeSingle();
      if (fresh) {
        order.status = fresh.status;
        order.highlevel_opportunity_id = fresh.highlevel_opportunity_id;
        order.metadata = fresh.metadata;
      }
    }
  }

  let syncError: string | null = null;
  const flaggedMismatch = Boolean(
    (order.metadata as Record<string, unknown> | null)?.amount_mismatch,
  );
  if (
    fulfill &&
    order.status === "paid" &&
    !order.highlevel_opportunity_id &&
    !flaggedMismatch
  ) {
    // Claim the sync atomically before running it: two concurrent deliveries
    // of the same event would both pass a plain read check, and HighLevel
    // would get two opportunities. Only the claim winner syncs; a failed sync
    // releases the claim so the next delivery retries.
    const { data: claimed } = await db
      .from("orders")
      .update({ highlevel_opportunity_id: HL_SYNC_CLAIM })
      .eq("id", order.id)
      .is("highlevel_opportunity_id", null)
      .select("id")
      .maybeSingle();
    if (claimed) {
      try {
        const result = await syncPaidOrderToHighLevel(db, order);
        if (!result.ok) syncError = result.error;
      } catch (err) {
        syncError = (err as Error).message;
      }
      if (syncError) {
        await db
          .from("orders")
          .update({ highlevel_opportunity_id: null })
          .eq("id", order.id)
          .eq("highlevel_opportunity_id", HL_SYNC_CLAIM);
      }
    }
  }

  return { status: order.status as string, syncError };
}
