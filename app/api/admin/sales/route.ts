import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { billedMonths } from "@/lib/customer-record";
import { orderKind, type InvoiceLink } from "@/lib/order-kind";

export const runtime = "nodejs";

/*
 * Every money number, in one place.
 *
 * They used to be scattered: totals on the client list, a pipeline on the
 * custom video board, revenue on the main dashboard. Four screens each
 * answering a slightly different version of "how are we doing" is how two of
 * them end up disagreeing, and it puts business figures on screens somebody
 * opened to do a job. So the aggregates live here and nowhere else.
 *
 * Every one-time sale is dated by when it was PAID, not when it was created,
 * because an order raised in March and paid in April is April's revenue.
 * Subscriptions are counted by elapsed months rather than by reading Stripe's
 * invoice list, which is within a month of the truth and costs no API call.
 */

type Row = Record<string, unknown>;

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = supabaseAdmin();
  const [{ data: orders }, { data: subs }, { data: invoices }, { data: projects }] =
    await Promise.all([
      db
        .from("orders")
        .select(
          "id, customer_email, product_id, amount_cents, status, created_at, paid_at, product:products(name, sku, metadata)",
        ),
      db
        .from("subscriptions")
        .select("customer_email, amount_cents, status, created_at, current_period_end, plan_name, product:products(name, sku)"),
      db.from("invoices").select("number, total_cents, status, product_sku, product_id, parent_order_id"),
      db.from("projects").select("id, status, quoted_cents, agreed_cents"),
    ]);

  const invoiceByProduct = new Map<string, InvoiceLink>(
    ((invoices ?? []) as Row[])
      .filter((i) => i.product_id)
      .map((i) => [
        String(i.product_id),
        { productId: String(i.product_id), parentOrderId: (i.parent_order_id as string | null) ?? null },
      ]),
  );

  const now = new Date();

  /* one-time sales, each labelled and dated by payment */
  /* which invoice a product belongs to, so a sale can name the one it settled */
  const invoiceNumberByProduct = new Map(
    ((invoices ?? []) as Row[])
      /* both halves must actually exist: String(undefined) is the string
       * "undefined", which reads as a real invoice number all the way to
       * the screen */
      .filter((i) => i.product_id && typeof i.number === "string")
      .map((i) => [String(i.product_id), i.number as string]),
  );

  const sales = ((orders ?? []) as Row[])
    .filter((o) => String(o.status) === "paid")
    .map((o) => {
      const productId = (o.product_id as string | null) ?? null;
      const invoiceNumber = productId ? (invoiceNumberByProduct.get(productId) ?? null) : null;
      return {
        kind: orderKind(
          productId,
          ((o.product as { metadata?: { invoice?: unknown } } | null)?.metadata ?? null),
          invoiceByProduct,
        ),
        amountCents: Number(o.amount_cents),
        at: String(o.paid_at ?? o.created_at),
        email: String(o.customer_email),
        name: (o.product as { name?: string } | null)?.name ?? "Order",
        /* how it was billed, which is a different question from what it was:
         * an add-on and a bespoke job are both invoiced, a shelf purchase is not */
        viaInvoice: Boolean(invoiceNumber),
        invoiceNumber,
        recurring: false,
      };
    });

  const refundedCents = ((orders ?? []) as Row[])
    .filter((o) => String(o.status) === "refunded")
    .reduce((s, o) => s + Number(o.amount_cents), 0);

  /* recurring, all time and right now */
  const BILLING = new Set(["active", "trialing", "past_due"]);
  /* a plan that never completed its first payment took no money */
  const NEVER_PAID = new Set(["incomplete", "incomplete_expired"]);
  let subscriptionCents = 0;
  let mrrCents = 0;
  const planRows: { name: string; mrrCents: number; live: number }[] = [];
  for (const s of (subs ?? []) as Row[]) {
    const amount = s.amount_cents == null ? 0 : Number(s.amount_cents);
    subscriptionCents +=
      amount *
      billedMonths(
        String(s.created_at),
        String(s.status),
        (s.current_period_end as string | null) ?? null,
        now,
      );
    if (BILLING.has(String(s.status))) {
      mrrCents += amount;
      const name =
        (s.plan_name as string | null) ??
        (s.product as { name?: string } | null)?.name ??
        "Plan";
      const hit = planRows.find((p) => p.name === name);
      if (hit) {
        hit.mrrCents += amount;
        hit.live += 1;
      } else planRows.push({ name, mrrCents: amount, live: 1 });
    }
  }

  const paidSkus = new Set(
    ((orders ?? []) as Row[])
      .filter((o) => String(o.status) === "paid")
      .map((o) => String((o.product as { sku?: unknown } | null)?.sku ?? "")),
  );
  const outstandingCents = ((invoices ?? []) as Row[])
    .filter((i) => String(i.status) === "open" && !paidSkus.has(String(i.product_sku)))
    .reduce((s, i) => s + Number(i.total_cents), 0);

  /* work agreed and not yet paid for: the pipeline */
  const OPEN = new Set(["scoped", "in_production", "review", "delivered"]);
  const pipelineCents = ((projects ?? []) as Row[])
    .filter((p) => OPEN.has(String(p.status)))
    .reduce(
      (s, p) => s + Number(p.agreed_cents ?? p.quoted_cents ?? 0),
      0,
    );

  /* the last 12 months, by stream, so a filter has something to show */
  const months: { key: string; label: string; premade: number; addon: number; custom: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-US", { month: "short" }),
      premade: 0,
      addon: 0,
      custom: 0,
    });
  }
  for (const s of sales) {
    const d = new Date(s.at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const slot = months.find((m) => m.key === key);
    if (slot) slot[s.kind] += s.amountCents;
  }

  const sum = (kind: string) =>
    sales.filter((s) => s.kind === kind).reduce((a, s) => a + s.amountCents, 0);

  /*
   * Subscriptions in the same list.
   *
   * Dated by when the plan started and shown at its monthly price, marked
   * recurring so it never reads as a one-off. We do not hold Stripe's
   * individual monthly invoices, and inventing a row per month would be
   * making up records; this says the true thing, which is that this plan
   * began here and bills this much.
   */
  const subscriptionSales = ((subs ?? []) as Row[])
    .filter((x) => !NEVER_PAID.has(String(x.status)))
    .map((x) => ({
      kind: "subscription" as const,
      amountCents: x.amount_cents == null ? 0 : Number(x.amount_cents),
      at: String(x.created_at),
      email: String(x.customer_email),
      name:
        (x.plan_name as string | null) ??
        (x.product as { name?: string } | null)?.name ??
        "Editing plan",
      viaInvoice: false,
      invoiceNumber: null,
      recurring: true,
    }));

  return NextResponse.json({
    totals: {
      allTimeCents: sum("premade") + sum("addon") + sum("custom") + subscriptionCents,
      premadeCents: sum("premade"),
      addOnCents: sum("addon"),
      customCents: sum("custom"),
      subscriptionCents,
      mrrCents,
      outstandingCents,
      pipelineCents,
      refundedCents,
    },
    counts: {
      premade: sales.filter((s) => s.kind === "premade").length,
      addon: sales.filter((s) => s.kind === "addon").length,
      custom: sales.filter((s) => s.kind === "custom").length,
      liveSubscriptions: planRows.reduce((a, p) => a + p.live, 0),
      openProjects: ((projects ?? []) as Row[]).filter((p) => OPEN.has(String(p.status))).length,
    },
    plans: planRows.sort((a, b) => b.mrrCents - a.mrrCents),
    months,
    recent: [...sales, ...subscriptionSales]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 15),
  });
}
