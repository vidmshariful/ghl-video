import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { parseInvoiceInput, type InvoiceLineItem } from "@/lib/invoices";

export const runtime = "nodejs";

/*
 * Invoices: itemized, payable invoices backed by a one_time product so the pay
 * link runs through the normal checkout. POST creates the backing product +
 * the invoice; GET lists them with "paid" derived from a paid order on the
 * backing product. Admin-gated (allowlist).
 */

type LineItem = InvoiceLineItem;
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
  project_ids: string[] | null;
  subtotal_cents: number | null;
  discount_kind: "percent" | "flat" | null;
  discount_value: number | null;
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
    projectIds: inv.project_ids ?? [],
    subtotalCents: inv.subtotal_cents ?? inv.total_cents,
    discountKind: inv.discount_kind,
    discountValue: inv.discount_value,
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
  const parsed = parseInvoiceInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const inv = parsed.invoice;

  const db = supabaseAdmin();
  const sku = `inv-${Math.random().toString(36).slice(2, 8)}`;
  const { data: product, error: pErr } = await db
    .from("products")
    .insert({
      sku,
      name: inv.lineItems[0].description.slice(0, 120),
      price_cents: inv.totalCents,
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
      customer_name: inv.customerName || null,
      customer_email: inv.customerEmail,
      customer_company: inv.customerCompany || null,
      line_items: inv.lineItems,
      currency: "usd",
      subtotal_cents: inv.subtotalCents,
      discount_kind: inv.discountValue ? inv.discountKind : null,
      discount_value: inv.discountValue,
      total_cents: inv.totalCents,
      notes: inv.notes || null,
      due_date: inv.dueDate,
      parent_order_id: inv.parentOrderId,
      project_id: inv.projectId,
      project_ids: inv.projectIds.length ? inv.projectIds : inv.projectId ? [inv.projectId] : [],
      created_by: admin.email,
    })
    .select("*")
    .single();
  if (iErr || !invoice) {
    return NextResponse.json({ error: "Could not create the invoice." }, { status: 500 });
  }

  return NextResponse.json({ invoice: shape(invoice as InvoiceRow, false) });
}
