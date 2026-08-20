import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { stripe } from "@/lib/checkout/stripe";

export const runtime = "nodejs";

/*
 * Change what a plan costs from the next renewal.
 *
 * Two situations this exists for, and they pull in opposite directions: a
 * client who was promised a discount and never used it, and a client who has
 * agreed to pay more for extra videos each month. Both are "this plan should
 * bill a different number from now on", so both are one control.
 *
 * NOTHING IS PRORATED, ON PURPOSE
 * -------------------------------
 * proration_behavior is "none", so the current month is left exactly as the
 * client agreed to it and the new amount starts at the next renewal. The
 * alternative is charging or crediting somebody mid-month for a change they
 * did not initiate, which is how a goodwill discount turns into a surprise
 * line on a card statement.
 *
 * A new Stripe Price is created rather than editing the old one, because
 * Stripe prices are immutable by design: editing would rewrite what every
 * past invoice claims to have charged. The old price object stays exactly as
 * it was, which is what keeps historic invoices honest.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const newCents = Number(b.amountCents);
  const reason =
    typeof b.reason === "string" && b.reason.trim()
      ? b.reason.trim().slice(0, 500)
      : "We agreed this change with you.";

  if (!Number.isFinite(newCents) || newCents < 0 || newCents > 10_000_00) {
    return NextResponse.json(
      { error: "Give a monthly amount between $0 and $10,000." },
      { status: 400 },
    );
  }

  const db = supabaseAdmin();
  const { data: row } = await db
    .from("subscriptions")
    .select("id, customer_email, amount_cents, currency, status, stripe_subscription_id, metadata, plan_name")
    .eq("id", id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!row.stripe_subscription_id) {
    return NextResponse.json(
      { error: "This plan has no Stripe subscription behind it, so there is nothing to reprice." },
      { status: 400 },
    );
  }
  const oldCents = Number(row.amount_cents ?? 0);
  if (oldCents === newCents) {
    return NextResponse.json({ error: "That is already the price." }, { status: 400 });
  }

  const s = stripe();
  let effective: string;
  try {
    const sub = await s.subscriptions.retrieve(row.stripe_subscription_id as string);
    if (sub.status === "canceled") {
      return NextResponse.json(
        { error: "That plan is cancelled, so there is no next renewal to change." },
        { status: 400 },
      );
    }
    const item = sub.items.data[0];
    if (!item) {
      return NextResponse.json({ error: "That plan has no billable item." }, { status: 400 });
    }

    /* a fresh price on the SAME product, so reporting still groups it with
     * the plan it belongs to */
    const price = await s.prices.create({
      product: typeof item.price.product === "string" ? item.price.product : item.price.product.id,
      currency: item.price.currency,
      unit_amount: newCents,
      recurring: { interval: item.price.recurring?.interval ?? "month" },
      metadata: { adjusted_by: admin.email, previous_price: item.price.id },
    });

    await s.subscriptions.update(row.stripe_subscription_id as string, {
      items: [{ id: item.id, price: price.id }],
      proration_behavior: "none",
    });

    const endsAt = item.current_period_end ?? sub.billing_cycle_anchor;
    effective = new Date(endsAt * 1000).toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Stripe refused the change: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  /* our copy, plus a trail of who changed what and why. A plan billing an
   * odd number a year from now should be able to explain itself. */
  const meta = (row.metadata as Record<string, unknown> | null) ?? {};
  const history = Array.isArray(meta.price_history) ? meta.price_history : [];
  await db
    .from("subscriptions")
    .update({
      amount_cents: newCents,
      metadata: {
        ...meta,
        price_history: [
          ...history,
          { at: new Date().toISOString(), by: admin.email, from: oldCents, to: newCents, reason },
        ],
      },
    })
    .eq("id", id);

  /* told, not discovered on a bank statement. Fail-soft: the change is
   * already made, and a mail outage must not hide that from the record. */
  try {
    const { sendSubscriptionPriceChangedEmail } = await import("@/lib/email/notify");
    await sendSubscriptionPriceChangedEmail(db, id, {
      oldCents,
      newCents,
      effective,
      reason,
    });
  } catch (e) {
    console.error("[subscription] price change email failed:", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({ ok: true, oldCents, newCents, effective });
}
