import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { lifetimeValue, serviceTags, type MoneySource } from "@/lib/customer-record";
import { completeness, getBrandKit } from "@/lib/brand-kit";
import { orderKind, type InvoiceLink } from "@/lib/order-kind";

export const runtime = "nodejs";

/*
 * Everything about one client, in one response.
 *
 * The point of this screen is that nobody has to open five tabs to answer a
 * question about a customer, so the route gathers all of it rather than
 * making the browser stitch it together. Ten reads sounds like a lot until
 * you compare it with the ten screens it replaces.
 */

type Row = Record<string, unknown>;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const db = supabaseAdmin();
  const { data: c } = await db.from("customers").select("*").eq("id", id).maybeSingle();
  if (!c) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const email = String(c.email).toLowerCase();

  const [
    { data: orders },
    { data: subs },
    { data: invoices },
    { data: members },
    { data: notes },
    { data: convos },
    { data: contacts },
  ] = await Promise.all([
    db
      .from("orders")
      .select(
        "id, product_id, amount_cents, currency, status, fulfillment_stage, invoice_number, created_at, paid_at, intake_completed, product:products(name, sku, metadata)",
      )
      .ilike("customer_email", email)
      .order("created_at", { ascending: false }),
    db
      .from("subscriptions")
      .select("id, amount_cents, status, created_at, current_period_end, cancel_at_period_end, plan_name, metadata, product:products(name, sku)")
      .ilike("customer_email", email)
      .order("created_at", { ascending: false }),
    db
      .from("invoices")
      .select("id, number, token, total_cents, status, due_date, sent_at, created_at, product_sku, product_id, parent_order_id, line_items")
      .ilike("customer_email", email)
      .order("created_at", { ascending: false }),
    db
      .from("account_members")
      .select("id, member_email, member_name, features, status, created_at")
      .eq("account_type", "customer")
      .ilike("owner_email", email),
    db
      .from("customer_notes")
      .select("id, author, body, created_at")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    db
      .from("conversations")
      .select("id, order_id, last_message_at, last_message_preview, last_sender_role")
      .ilike("customer_email", email)
      .order("last_message_at", { ascending: false, nullsFirst: false }),
    db
      .from("customer_contacts")
      .select("id, name, email, phone, role, title, notes, created_at")
      .eq("customer_id", id)
      .order("role"),
  ]);

  const orderIds = ((orders ?? []) as Row[]).map((o) => String(o.id));
  const { data: videos } = orderIds.length
    ? await db
        .from("order_deliverables")
        .select("id, order_id, title, status, due_at, ready_at, approved_at, position")
        .in("order_id", orderIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const kit = await getBrandKit(db, id);

  const paidSkus = new Set(
    ((orders ?? []) as Row[])
      .filter((o) => String(o.status) === "paid")
      .map((o) => String((o.product as { sku?: unknown } | null)?.sku ?? "")),
  );
  /* which product each invoice bills through, so an order can say what it was */
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
  const kindOf = (o: Row) =>
    orderKind(
      (o.product_id as string | null) ?? null,
      ((o.product as { metadata?: { invoice?: unknown } } | null)?.metadata ?? null),
      invoiceByProduct,
    );

  const money: MoneySource = {
    orders: ((orders ?? []) as Row[]).map((o) => ({
      amountCents: Number(o.amount_cents),
      status: String(o.status),
      kind: kindOf(o),
    })),
    subscriptions: ((subs ?? []) as Row[]).map((s) => ({
      amountCents: s.amount_cents == null ? null : Number(s.amount_cents),
      status: String(s.status),
      createdAt: String(s.created_at),
      currentPeriodEnd: (s.current_period_end as string | null) ?? null,
    })),
    openInvoices: ((invoices ?? []) as Row[])
      .filter((i) => i.status === "open" && !paidSkus.has(String(i.product_sku)))
      .map((i) => ({ totalCents: Number(i.total_cents) })),
  };
  const value = lifetimeValue(money, new Date());

  return NextResponse.json({
    customer: {
      id,
      email: String(c.email),
      name: (c.name as string | null) ?? null,
      company: (c.company as string | null) ?? null,
      phone: (c.phone as string | null) ?? null,
      tags: (c.tags as string[] | null) ?? [],
      hiddenSections: (c.hidden_sections as string[] | null) ?? [],
      lastSeenAt: (c.last_seen_at as string | null) ?? null,
      createdAt: String(c.created_at),
      highlevelContactId: (c.highlevel_contact_id as string | null) ?? null,
    },
    value,
    services: serviceTags({
      paidOrders: money.orders.filter((o) => o.status === "paid" && o.kind !== "custom").length,
      /* an add-on never makes somebody a custom client */
      projects: money.orders.filter((o) => o.status === "paid" && o.kind === "custom").length,
      liveSubscriptions: money.subscriptions.filter((s) =>
        ["active", "trialing", "past_due"].includes(s.status),
      ).length,
    }),
    orders: ((orders ?? []) as Row[]).map((o) => ({
      id: String(o.id),
      productName: (o.product as { name?: string } | null)?.name ?? null,
      productSku: (o.product as { sku?: string } | null)?.sku ?? null,
      kind: kindOf(o),
      /* an add-on hangs under the order it topped up */
      parentOrderId:
        ((invoices ?? []) as Row[]).find((i) => i.product_id === o.product_id)?.parent_order_id ??
        null,
      amountCents: Number(o.amount_cents),
      status: String(o.status),
      stage: String(o.fulfillment_stage),
      invoiceNumber: (o.invoice_number as string | null) ?? null,
      intakeCompleted: Boolean(o.intake_completed),
      createdAt: String(o.created_at),
    })),
    subscriptions: ((subs ?? []) as Row[]).map((s) => ({
      id: String(s.id),
      planName: (s.plan_name as string | null) ?? (s.product as { name?: string } | null)?.name ?? null,
      sku: (s.product as { sku?: string } | null)?.sku ?? null,
      amountCents: s.amount_cents == null ? null : Number(s.amount_cents),
      status: String(s.status),
      currentPeriodEnd: (s.current_period_end as string | null) ?? null,
      cancelAtPeriodEnd: Boolean(s.cancel_at_period_end),
      createdAt: String(s.created_at),
    })),
    invoices: ((invoices ?? []) as Row[]).map((i) => ({
      id: String(i.id),
      number: String(i.number),
      token: String(i.token),
      totalCents: Number(i.total_cents),
      status: String(i.status),
      paid: paidSkus.has(String(i.product_sku)),
      parentOrderId: (i.parent_order_id as string | null) ?? null,
      dueDate: (i.due_date as string | null) ?? null,
      sentAt: (i.sent_at as string | null) ?? null,
      createdAt: String(i.created_at),
    })),
    videos: ((videos ?? []) as Row[]).map((v) => ({
      id: String(v.id),
      orderId: String(v.order_id),
      title: String(v.title),
      status: String(v.status),
      dueAt: (v.due_at as string | null) ?? null,
    })),
    team: ((members ?? []) as Row[]).map((m) => ({
      id: String(m.id),
      email: String(m.member_email),
      name: (m.member_name as string | null) ?? null,
      features: (m.features as string[] | null) ?? null,
      status: String(m.status),
    })),
    notes: ((notes ?? []) as Row[]).map((n) => ({
      id: String(n.id),
      author: String(n.author),
      body: String(n.body),
      createdAt: String(n.created_at),
    })),
    conversations: ((convos ?? []) as Row[]).map((v) => ({
      id: String(v.id),
      orderId: (v.order_id as string | null) ?? null,
      lastMessageAt: (v.last_message_at as string | null) ?? null,
      preview: (v.last_message_preview as string | null) ?? null,
      lastSender: (v.last_sender_role as string | null) ?? null,
    })),
    contacts: ((contacts ?? []) as Row[]).map((c) => ({
      id: String(c.id),
      name: String(c.name),
      email: (c.email as string | null) ?? null,
      phone: (c.phone as string | null) ?? null,
      role: String(c.role),
      title: (c.title as string | null) ?? null,
      notes: (c.notes as string | null) ?? null,
    })),
    brandKit: kit ? { kit, completeness: completeness(kit) } : { kit: null, completeness: completeness(null) },
  });
}

/** Tags, hidden sections and notes: the three things admin edits here. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = supabaseAdmin();

  if (typeof b.note === "string" && b.note.trim()) {
    const { error } = await db.from("customer_notes").insert({
      customer_id: id,
      author: admin.email,
      body: b.note.trim().slice(0, 4000),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const patch: Record<string, unknown> = {};
  if (Array.isArray(b.tags)) {
    patch.tags = (b.tags as unknown[])
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .map((t) => t.trim().slice(0, 40))
      .slice(0, 20);
  }
  if (Array.isArray(b.hiddenSections)) {
    patch.hidden_sections = (b.hiddenSections as unknown[])
      .filter((t): t is string => typeof t === "string")
      .slice(0, 30);
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const { error } = await db.from("customers").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
