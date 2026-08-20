import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { lifetimeValue, serviceTags, type MoneySource } from "@/lib/customer-record";

export const runtime = "nodejs";

/*
 * The client list, with numbers that are true.
 *
 * The screen this serves used to sum paid orders in the browser, which is why
 * a client on a $995 a month plan showed as $0. Everything a client has ever
 * paid us is gathered here instead, in four queries rather than one per row,
 * because at twenty clients an N+1 is invisible and at two hundred it is the
 * screen not loading.
 */

type Row = Record<string, unknown>;

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = supabaseAdmin();
  const [{ data: customers }, { data: orders }, { data: subs }, { data: invoices }] =
    await Promise.all([
      db
        .from("customers")
        .select("id, email, name, company, phone, tags, hidden_sections, last_seen_at, created_at")
        .order("created_at", { ascending: false }),
      db
        .from("orders")
        .select("customer_email, amount_cents, status, created_at, product:products(sku, metadata)"),
      db
        .from("subscriptions")
        .select("customer_email, amount_cents, status, created_at, current_period_end"),
      /* Only the unpaid ones. A paid invoice already appears as an order,
       * because invoices are settled through the ordinary checkout, so
       * carrying them here as well would count that money twice. */
      db.from("invoices").select("customer_email, total_cents, status, product_sku"),
    ]);

  /* group once, by lowercased email, which is the only key all four share */
  const key = (e: unknown) => String(e ?? "").toLowerCase();
  const byEmail = <T extends Row>(rows: T[] | null, field: string) => {
    const m = new Map<string, T[]>();
    for (const r of rows ?? []) {
      const k = key(r[field]);
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return m;
  };
  const ordersBy = byEmail(orders as Row[] | null, "customer_email");
  const subsBy = byEmail(subs as Row[] | null, "customer_email");
  const invBy = byEmail(invoices as Row[] | null, "customer_email");

  /* Which invoice-backed products have actually been paid for. This is the
   * only way to know an invoice landed: the table itself has no paid state,
   * by design, because the backing order is the record of payment. */
  const paidSkus = new Set(
    ((orders ?? []) as Row[])
      .filter((o) => String(o.status) === "paid")
      .map((o) => String((o.product as { sku?: unknown } | null)?.sku ?? "")),
  );

  const now = new Date();
  const items = ((customers ?? []) as Row[]).map((c) => {
    const k = key(c.email);
    const mine: MoneySource = {
      orders: (ordersBy.get(k) ?? []).map((o) => ({
        amountCents: Number(o.amount_cents),
        status: String(o.status),
        /* invoice-backed products are how custom work is billed today */
        viaInvoice: Boolean(
          ((o.product as { metadata?: { invoice?: unknown } } | null)?.metadata ?? {}).invoice,
        ),
      })),
      subscriptions: (subsBy.get(k) ?? []).map((s) => ({
        amountCents: s.amount_cents == null ? null : Number(s.amount_cents),
        status: String(s.status),
        createdAt: String(s.created_at),
        currentPeriodEnd: (s.current_period_end as string | null) ?? null,
      })),
      openInvoices: (invBy.get(k) ?? [])
        .filter((i) => i.status === "open" && !paidSkus.has(String(i.product_sku)))
        .map((i) => ({ totalCents: Number(i.total_cents) })),
    };
    const value = lifetimeValue(mine, now);
    return {
      id: String(c.id),
      email: String(c.email),
      name: (c.name as string | null) ?? null,
      company: (c.company as string | null) ?? null,
      tags: (c.tags as string[] | null) ?? [],
      hiddenSections: (c.hidden_sections as string[] | null) ?? [],
      lastSeenAt: (c.last_seen_at as string | null) ?? null,
      createdAt: String(c.created_at),
      value,
      services: serviceTags({
        paidOrders: mine.orders.filter((o) => o.status === "paid" && !o.viaInvoice).length,
        /* today custom work shows up as an invoice-backed order; phase 3
         * gives it a project of its own and this reads that instead */
        projects: mine.orders.filter((o) => o.status === "paid" && o.viaInvoice).length,
        liveSubscriptions: mine.subscriptions.filter((s) =>
          ["active", "trialing", "past_due"].includes(s.status),
        ).length,
      }),
      counts: {
        orders: mine.orders.filter((o) => o.status === "paid" && !o.viaInvoice).length,
        projects: mine.orders.filter((o) => o.status === "paid" && o.viaInvoice).length,
        subscriptions: mine.subscriptions.length,
        openInvoices: mine.openInvoices.length,
      },
    };
  });

  return NextResponse.json({ customers: items });
}
