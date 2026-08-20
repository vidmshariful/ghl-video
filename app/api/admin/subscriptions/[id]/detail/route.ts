import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { cycleHistory, planFeatures, planNameFor } from "@/lib/subscription-cycles";

export const runtime = "nodejs";

/*
 * One subscription, everything about the money and the plan.
 *
 * Deliberately not the work. Subscriptions is the commercial record, the way
 * Orders is for one-time sales: what they bought, what it covers, what they
 * have paid and what is coming. The editing itself is managed in Production,
 * because a video request is production work and belongs on a board with the
 * rest of it.
 */

type Row = Record<string, unknown>;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const db = supabaseAdmin();

  const { data: sub } = await db
    .from("subscriptions")
    .select(
      "id, customer_email, customer_id, plan_name, status, amount_cents, currency, interval, current_period_end, cancel_at_period_end, created_at, updated_at, stripe_subscription_id, metadata, product:products(name, sku), customer:customers(name, company, phone)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!sub) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const sku =
    (sub.product as { sku?: string } | null)?.sku ??
    ((sub.metadata as { sku?: string } | null)?.sku ?? null);

  /* every charge that actually succeeded, newest first */
  const { data: payments } = await db
    .from("subscription_payments")
    .select("amount_cents, currency, paid_at, stripe_invoice_id, stripe_payment_intent_id, plan_name")
    .eq("subscription_id", id)
    .order("paid_at", { ascending: false });

  /* the months, and what was used in each */
  const months = await cycleHistory(db, id);
  const { data: made } = months.length
    ? await db
        .from("order_deliverables")
        .select("cycle_id, form, status, cancelled_at")
        .in("cycle_id", months.map((m) => m.id))
    : { data: [] };

  const paid = (payments ?? []) as Row[];

  return NextResponse.json({
    subscription: {
      id: String(sub.id),
      email: String(sub.customer_email),
      customerId: (sub.customer_id as string | null) ?? null,
      name: (sub.customer as { name?: string } | null)?.name ?? null,
      company: (sub.customer as { company?: string } | null)?.company ?? null,
      phone: (sub.customer as { phone?: string } | null)?.phone ?? null,
      planName: (sub.plan_name as string | null) ?? planNameFor(sku),
      sku,
      /* what the pack promises, straight from the catalogue */
      includes: planFeatures(sku),
      status: String(sub.status),
      amountCents: Number(sub.amount_cents ?? 0),
      currency: String(sub.currency ?? "usd"),
      interval: String(sub.interval ?? "month"),
      startedAt: String(sub.created_at),
      renewsAt: (sub.current_period_end as string | null) ?? null,
      endingAtPeriodEnd: Boolean(sub.cancel_at_period_end),
      stripeId: (sub.stripe_subscription_id as string | null) ?? null,
    },
    /* lifetime value is the charges we actually took, never an estimate */
    paidToDateCents: paid.reduce((s, p) => s + Number(p.amount_cents ?? 0), 0),
    payments: paid.map((p) => ({
      amountCents: Number(p.amount_cents ?? 0),
      currency: String(p.currency ?? "usd"),
      paidAt: String(p.paid_at),
      invoiceId: (p.stripe_invoice_id as string | null) ?? null,
      planName: (p.plan_name as string | null) ?? null,
    })),
    months: months.map((m) => {
      const mine = ((made ?? []) as Row[]).filter(
        (d) => String(d.cycle_id) === m.id && !d.cancelled_at,
      );
      return {
        id: m.id,
        startsAt: m.periodStart,
        endsAt: m.periodEnd,
        longUsed: mine.filter((d) => d.form === "long").length,
        shortUsed: mine.filter((d) => d.form === "short").length,
        longAllowed: m.longFormAllowed,
        shortAllowed: m.shortFormAllowed,
        delivered: mine.filter((d) => d.status === "approved").length,
      };
    }),
  });
}
