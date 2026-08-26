import "server-only";
import type Stripe from "stripe";
import type { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { syncPaidOrderToHighLevel } from "@/lib/checkout/fulfill";
import { isAmountMismatch } from "@/lib/checkout/money-rules";

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
    const mismatch = isAmountMismatch({
      chargedCents,
      expectedCents: order.amount_cents as number,
      chargedCurrency: pi.currency,
      expectedCurrency: order.currency as string | null,
    });
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
      // The winner of the flip is the exactly-once place for the customer
      // confirmation + team alert. Fail-soft inside; never blocks settlement.
      const { sendOrderPaidEmails } = await import("@/lib/email/notify");
      await sendOrderPaidEmails(db, order.id as string);

      /*
       * Tell Affixo a sale happened, so a partner gets paid for it.
       *
       * We do this ourselves rather than letting Affixo's Stripe listener
       * find it: our checkout builds PaymentIntents by hand, and their
       * listener is watching for Checkout Sessions and invoices that this
       * flow never creates. Every one-time order in the catalogue would
       * otherwise attribute to nobody.
       *
       * Sits inside the flip, which is the exactly-once branch, and is
       * idempotent on the order id at their end too, so a Stripe retry
       * cannot pay a partner twice. Fail-soft on purpose: a commission is
       * not worth failing a customer's paid order over, and an order that
       * did not reach Affixo can be replayed by hand from the record.
       */
      try {
        const { trackSale } = await import("@/lib/affixo");
        const m = (pi.metadata ?? {}) as Record<string, string | undefined>;
        const sent = await trackSale({
          orderId: order.id as string,
          amountCents: chargedCents,
          currency: pi.currency,
          ref: m.ref ?? null,
          email: (order.customer_email as string | null) ?? m.customer_email ?? null,
          visitorId: m.sa_vid ?? null,
        });
        if (sent) {
          await db.from("order_events").insert({
            order_id: order.id,
            event_type: "affiliate_sale_recorded",
            payload: { platform: "affixo", ref: m.ref ?? null },
          });
        }
      } catch (e) {
        console.error(`[settle] affixo sale failed for order ${order.id}:`, e);
      }

      /*
       * A credit pack buys credits, not videos. Idempotent by order id, so a
       * webhook retry cannot hand out the same pack twice, and loud when it
       * fails: money has been taken for credits, and nothing else in this
       * flow will come back and grant them later.
       */
      try {
        const { grantCreditsForOrder } = await import("@/lib/subscription-cycles");
        const granted = await grantCreditsForOrder(db, order.id as string);
        if (granted) {
          await db.from("order_events").insert({
            order_id: order.id,
            event_type: "editing_credits_granted",
            payload: { credits: granted },
          });
        }
      } catch (e) {
        console.error(`[settle] credit grant failed for order ${order.id}:`, e);
        const { ALARM_KINDS, raise } = await import("@/lib/alarm");
        await raise(db, {
          kind: ALARM_KINDS.CREDITS_NOT_GRANTED,
          severity: "critical",
          message: `Editing credits were paid for but not granted on order ${order.id}. Add them by hand on the client's plan.`,
          fingerprint: `${ALARM_KINDS.CREDITS_NOT_GRANTED}:${order.id}`,
          context: { orderId: order.id, error: e instanceof Error ? e.message : String(e) },
        });
      }

      // Expand what they bought into one row per video, so the studio has a
      // work list and the customer has a My Videos list. Deliberately never
      // throws: a paid order must settle even if the expansion has a bad day,
      // and the backfill script can always rebuild a missing list afterwards.
      try {
        const { createDeliverablesForOrder } = await import("@/lib/deliverables");
        const { created, reason } = await createDeliverablesForOrder(db, order.id as string);
        await db.from("order_events").insert({
          order_id: order.id,
          event_type: created ? "deliverables_created" : "deliverables_skipped",
          payload: { count: created, ...(reason ? { reason } : {}) },
        });
      } catch (e) {
        console.error(`[settle] deliverables failed for order ${order.id}:`, e);
        await db.from("order_events").insert({
          order_id: order.id,
          event_type: "deliverables_failed",
          payload: { error: e instanceof Error ? e.message : String(e) },
        });
        /*
         * Critical, and told on the first occurrence, because the swallow
         * above is exactly what makes this dangerous. Everything else on the
         * money path either retries itself or refuses to complete. This one
         * completes: the order is paid, the customer is happy, and the work
         * list is empty. Nothing will ever come back and fix it on its own.
         *
         * Per order, since each one needs npm run backfill:deliverables run
         * against it and they do not fix as a batch.
         */
        const { ALARM_KINDS, raise } = await import("@/lib/alarm");
        await raise(db, {
          kind: ALARM_KINDS.DELIVERABLES_FAILED,
          fingerprint: `${ALARM_KINDS.DELIVERABLES_FAILED}:${order.id}`,
          severity: "critical",
          message: `Order ${order.id} is paid but its videos were not created, so it will not appear on the studio board or in the customer's video list. Run npm run backfill:deliverables to rebuild it.`,
          context: {
            orderId: order.id as string,
            error: e instanceof Error ? e.message : String(e),
          },
        });
      }
      // (coupon redemption is now reserved atomically at finalize, before the
      // charge, via reserve_coupon_redemption; nothing to count here.)
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
        /*
         * The price is re-derived on the server and stamped on the intent
         * before the order is written, so the two agreeing is the normal
         * state and disagreeing should be impossible. That is exactly why it
         * is critical and told at once: it means either a real bug in the
         * pricing path or somebody having a go at it, and both are things to
         * look at today rather than in the weekly numbers.
         */
        const { ALARM_KINDS, raise } = await import("@/lib/alarm");
        await raise(db, {
          kind: ALARM_KINDS.AMOUNT_MISMATCH,
          fingerprint: `${ALARM_KINDS.AMOUNT_MISMATCH}:${order.id}`,
          severity: "critical",
          message: `Order ${order.id} expected ${(Number(order.amount_cents) / 100).toFixed(2)} ${String(order.currency).toUpperCase()} but ${(chargedCents / 100).toFixed(2)} ${pi.currency.toUpperCase()} was charged.`,
          context: {
            orderId: order.id as string,
            expected: `${(Number(order.amount_cents) / 100).toFixed(2)} ${String(order.currency).toUpperCase()}`,
            charged: `${(chargedCents / 100).toFixed(2)} ${pi.currency.toUpperCase()}`,
            paymentIntent: pi.id,
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
