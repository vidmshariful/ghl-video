import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";

export const runtime = "nodejs";

/*
 * Invoices: itemized, payable invoices backed by a one_time product so the pay
 * link runs through the normal checkout. POST creates the backing product +
 * the invoice; GET lists them with "paid" derived from a paid order on the
 * backing product. Admin-gated (allowlist).
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type LineItem = { description: string; amount_cents: number };
type InvoiceRow = {
  id: string;
  number: string;
  token: string;
  product_id: string | null;
  product_sku: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_company: string | null;
  line_items: LineItem[];
  currency: string;
  total_cents: number;
  notes: string | null;
  due_date: string | null;
  status: "open" | "void";
  sent_at: string | null;
  created_at: string;
};

function shape(inv: InvoiceRow, paid: boolean) {
  return {
    id: inv.id,
    number: inv.number,
    token: inv.token,
    status: paid ? "paid" : inv.status,
    customerName: inv.customer_name,
    customerEmail: inv.customer_email,
    customerCompany: inv.customer_company,
    lineItems: inv.line_items ?? [],
    totalCents: inv.total_cents,
    currency: inv.currency,
    notes: inv.notes,
    dueDate: inv.due_date,
    sentAt: inv.sent_at,
    createdAt: inv.created_at,
  };
}

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const db = supabaseAdmin();
  const { data } = await db.from("invoices").select("*").order("created_at", { ascending: false });
  const invoices = (data ?? []) as InvoiceRow[];

  const productIds = invoices.map((i) => i.product_id).filter((x): x is string => !!x);
  let paid = new Set<string>();
  if (productIds.length) {
    const { data: orders } = await db
      .from("orders")
      .select("product_id")
      .in("product_id", productIds)
      .eq("status", "paid");
    paid = new Set((orders ?? []).map((o) => o.product_id as string));
  }

  return NextResponse.json({
    invoices: invoices.map((i) => shape(i, !!i.product_id && paid.has(i.product_id))),
  });
}

export async function POST(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const name = str(body.customerName, 120);
  const email = str(body.customerEmail, 254).toLowerCase();
  const company = str(body.customerCompany, 120);
  const notes = str(body.notes, 4000);
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(str(body.dueDate, 10)) ? str(body.dueDate, 10) : null;
  // optional: attach this invoice (extra work) to an existing order
  const parentOrderId =
    typeof body.parentOrderId === "string" && /^[0-9a-f-]{36}$/i.test(body.parentOrderId)
      ? body.parentOrderId
      : null;

  const rawItems = Array.isArray(body.lineItems) ? body.lineItems : [];
  const lineItems: LineItem[] = rawItems
    .map((it) => {
      const r = it as Record<string, unknown>;
      return {
        description: str(r.description, 200),
        amount_cents: Math.round(Number(r.amountCents)),
      };
    })
    .filter((it) => it.description && Number.isFinite(it.amount_cents) && it.amount_cents > 0)
    .slice(0, 20);

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid client email is required." }, { status: 400 });
  }
  if (lineItems.length === 0) {
    return NextResponse.json({ error: "Add at least one line item." }, { status: 400 });
  }
  const total = lineItems.reduce((s, i) => s + i.amount_cents, 0);
  if (total < 50) {
    return NextResponse.json({ error: "The total must be at least $0.50." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const sku = `inv-${Math.random().toString(36).slice(2, 8)}`;
  const { data: product, error: pErr } = await db
    .from("products")
    .insert({
      sku,
      name: lineItems[0].description.slice(0, 120),
      price_cents: total,
      currency: "usd",
      type: "one_time",
      active: true,
      metadata: { invoice: true },
    })
    .select("id, sku")
    .single();
  if (pErr || !product) {
    return NextResponse.json({ error: "Could not create the invoice." }, { status: 500 });
  }

  const { data: invoice, error: iErr } = await db
    .from("invoices")
    .insert({
      product_id: product.id,
      product_sku: product.sku,
      customer_name: name || null,
      customer_email: email,
      customer_company: company || null,
      line_items: lineItems,
      currency: "usd",
      total_cents: total,
      notes: notes || null,
      due_date: dueDate,
      parent_order_id: parentOrderId,
      created_by: admin.email,
    })
    .select("*")
    .single();
  if (iErr || !invoice) {
    return NextResponse.json({ error: "Could not create the invoice." }, { status: 500 });
  }

  return NextResponse.json({ invoice: shape(invoice as InvoiceRow, false) });
}
