import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { lifetimeValue, serviceTags, type MoneySource } from "@/lib/customer-record";
import { orderKind, type InvoiceLink } from "@/lib/order-kind";

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
        .select(
          "customer_email, product_id, amount_cents, status, created_at, product:products(sku, metadata)",
        ),
      db
        .from("subscriptions")
        .select("customer_email, amount_cents, status, created_at, current_period_end"),
      /* Only the unpaid ones. A paid invoice already appears as an order,
       * because invoices are settled through the ordinary checkout, so
       * carrying them here as well would count that money twice. */
      db
        .from("invoices")
        .select("customer_email, total_cents, status, product_sku, product_id, parent_order_id"),
    ]);

  /* every client's people, so a picker can show who to talk to rather than
   * an email address nobody recognises */
  const { data: contacts } = await db
    .from("customer_contacts")
    .select("id, customer_id, name, email, role, title")
    .order("role");

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

  /* which product each invoice bills through, so an order can say whether it
   * was a shelf purchase, an add-on to earlier work, or bespoke */
  const invoiceByProduct = new Map<string, InvoiceLink>(
    ((invoices ?? []) as Row[])
      .filter((i) => i.product_id)
      .map((i) => [
        String(i.product_id),
        {
          productId: String(i.product_id),
          parentOrderId: (i.parent_order_id as string | null) ?? null,
        },
      ]),
  );

  const now = new Date();
  const items = ((customers ?? []) as Row[]).map((c) => {
    const k = key(c.email);
    const mine: MoneySource = {
      orders: (ordersBy.get(k) ?? []).map((o) => ({
        amountCents: Number(o.amount_cents),
        status: String(o.status),
        kind: orderKind(
          (o.product_id as string | null) ?? null,
          ((o.product as { metadata?: { invoice?: unknown } } | null)?.metadata ?? null),
          invoiceByProduct,
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
        paidOrders: mine.orders.filter((o) => o.status === "paid" && o.kind !== "custom").length,
        /* an add-on tops up existing work, so it never makes a client custom */
        projects: mine.orders.filter((o) => o.status === "paid" && o.kind === "custom").length,
        liveSubscriptions: mine.subscriptions.filter((s) =>
          ["active", "trialing", "past_due"].includes(s.status),
        ).length,
      }),
      contacts: ((contacts ?? []) as Row[])
        .filter((x) => String(x.customer_id) === String(c.id))
        .map((x) => ({
          id: String(x.id),
          name: String(x.name),
          email: (x.email as string | null) ?? null,
          role: String(x.role),
          title: (x.title as string | null) ?? null,
        })),
      counts: {
        orders: mine.orders.filter((o) => o.status === "paid" && o.kind === "premade").length,
        addOns: mine.orders.filter((o) => o.status === "paid" && o.kind === "addon").length,
        projects: mine.orders.filter((o) => o.status === "paid" && o.kind === "custom").length,
        subscriptions: mine.subscriptions.length,
        openInvoices: mine.openInvoices.length,
      },
    };
  });

  return NextResponse.json({ customers: items });
}


/*
 * Add a client by hand.
 *
 * Until now a customer row only ever appeared when somebody paid, which made
 * the custom video process backwards: you cannot scope a project for a client
 * who does not exist yet, and the first real step of that work is agreeing it
 * with a named person at a company. So a client can be created before any
 * money moves, and their contacts with them.
 */
export async function POST(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown, max: number) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
  const email = str(b.email, 200)?.toLowerCase() ?? null;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A real email address, please." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: existing } = await db
    .from("customers")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "That email already belongs to a client.", id: existing.id },
      { status: 409 },
    );
  }

  const { data, error } = await db
    .from("customers")
    .insert({
      email,
      name: str(b.name, 160),
      company: str(b.company, 160),
      phone: str(b.phone, 40),
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  /* the person we actually deal with, created alongside so a new client is
   * never a bare email nobody can put a name to */
  const contactName = str(b.contactName, 160);
  if (contactName) {
    await db.from("customer_contacts").insert({
      customer_id: data.id,
      name: contactName,
      email: str(b.contactEmail, 200)?.toLowerCase() ?? email,
      phone: str(b.contactPhone, 40),
      title: str(b.contactTitle, 120),
      role: "primary",
    });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
