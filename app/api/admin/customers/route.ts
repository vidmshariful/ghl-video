import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { lifetimeValue, serviceTags, type MoneySource } from "@/lib/customer-record";
import { invoiceOpen, invoiceSettled } from "@/lib/invoice-state";
import { orderKind, type InvoiceLink } from "@/lib/order-kind";
import { ensureAccount } from "@/lib/accounts";
import { likeLiteral } from "@/lib/pg-pattern";

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
        .select("id, email, name, company, phone, tags, hidden_sections, last_seen_at, created_at, internal, source, retainer, can_submit_projects")
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
        .select("customer_email, total_cents, status, product_sku, product_id, parent_order_id, paid_at, hl_status, kind, amount_paid_cents"),
    ]);

  /* every client's people, so a picker can show who to talk to rather than
   * an email address nobody recognises */
  const { data: contacts } = await db
    .from("customer_contacts")
    .select("id, customer_id, name, email, role, title")
    .order("role");

  /* the people who have asked and not yet bought: leads belong in the same
     list as clients, one stage earlier, rather than on another screen */
  const { data: enquiries } = await db
    .from("project_requests")
    .select("id, name, email, company, status, created_at")
    .in("status", ["new", "contacted", "quoted"])
    .order("created_at", { ascending: false });

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
        .filter((i) => invoiceOpen(i))
        .map((i) => ({ totalCents: Number(i.total_cents) })),
      /* paid in HighLevel with no order behind it */
      paidInvoices: (invBy.get(k) ?? [])
        .filter((i) => !i.product_id && invoiceSettled(i))
        .map((i) => ({
          amountCents: Number(i.amount_paid_cents || i.total_cents),
          kind: (["custom", "addon", "retainer", "premade", "plan"].includes(String(i.kind)) ? String(i.kind) : "custom") as
            | "custom"
            | "addon"
            | "retainer"
            | "premade"
            | "plan",
        })),
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
      /* a studio-owned account: out of the list and the sums by default */
      internal: Boolean(c.internal),
      source: (c.source as string | null) ?? null,
      /* how they pay for custom work, when it is not per quote */
      arrangement: c.retainer ? "retainer" : c.can_submit_projects ? "direct" : null,
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

  const known = new Set(items.map((c) => c.email.toLowerCase()));
  return NextResponse.json({
    customers: items,
    leads: ((enquiries ?? []) as Row[]).map((e) => ({
      id: String(e.id),
      name: (e.name as string | null) ?? null,
      email: String(e.email),
      company: (e.company as string | null) ?? null,
      status: String(e.status),
      createdAt: String(e.created_at),
      /* an existing client asking for more is not a new lead */
      isClient: known.has(String(e.email).toLowerCase()),
    })),
  });
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
    .ilike("email", likeLiteral(email))
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "That email already belongs to a client.", id: existing.id },
      { status: 409 },
    );
  }

  /* through the one door every path uses: handle and login included. The
     welcome stays with the screen, which sends it on its own say-so. */
  const data = await ensureAccount(db, {
    email,
    name: str(b.name, 160),
    company: str(b.company, 160),
    phone: str(b.phone, 40),
    source: str(b.fromRequestId, 64) ? "enquiry" : "admin",
    welcome: false,
  });
  if (!data) return NextResponse.json({ error: "Could not create the client." }, { status: 400 });

  /* what they are here for decides how they brief us: a direct-brief or
     retainer account skips the quote, everyone else asks for one */
  if (typeof b.canSubmitProjects === "boolean")
    await db.from("customers").update({ can_submit_projects: b.canSubmitProjects }).eq("id", data.id);

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
