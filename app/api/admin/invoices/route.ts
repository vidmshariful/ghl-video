import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { parseInvoiceInput, type InvoiceLineItem } from "@/lib/invoices";
import { ensureAccount } from "@/lib/accounts";
import { invoiceDisplayNumber, invoicePayUrl, invoiceSettled, invoiceStatusWord } from "@/lib/invoice-state";
import { nudgeInvoice } from "@/lib/highlevel/nudge";

export const runtime = "nodejs";

/*
 * Invoices. Since phase 3 (September 2026) an invoice is raised here and
 * made in HighLevel by the sync, where the client pays it; this table is the
 * mirror and paid_at is the one test for paid. The throwaway product per
 * invoice is gone: only legacy rows still carry one. Admin-gated (allowlist).
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
  hl_invoice_id: string | null;
  hl_number: string | null;
  hl_status: string | null;
  hl_url: string | null;
  hl_sent_at: string | null;
  paid_at: string | null;
  amount_paid_cents: number | null;
  kind: string | null;
  source: string | null;
};

function shape(inv: InvoiceRow) {
  const paid = invoiceSettled(inv);
  return {
    id: inv.id,
    number: inv.number,
    /* the number the client sees: HighLevel's once it has one */
    displayNumber: invoiceDisplayNumber(inv),
    token: inv.token,
    status: invoiceStatusWord(inv),
    paidAt: inv.paid_at,
    amountPaidCents: inv.amount_paid_cents ?? (paid ? inv.total_cents : 0),
    kind: inv.kind ?? "custom",
    source: inv.source ?? "platform",
    /* a legacy invoice still bills through checkout; the rest pay on HighLevel's page */
    legacy: Boolean(inv.product_id),
    highlevel: inv.hl_invoice_id
      ? { id: inv.hl_invoice_id, number: inv.hl_number, status: inv.hl_status, url: inv.hl_url, sentAt: inv.hl_sent_at }
      : null,
    payUrl: invoicePayUrl(inv),
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
  return NextResponse.json({ invoices: invoices.map(shape) });
}

export async function POST(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseInvoiceInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const inv = parsed.invoice;

  const db = supabaseAdmin();
  /* an invoice to a new email is a door: the account and its login exist
     from here, so the invoice email's "lives in your portal" is true. The
     invoice itself is the welcome, so none is sent. */
  if (inv.customerEmail) {
    await ensureAccount(db, {
      email: inv.customerEmail,
      name: inv.customerName || null,
      company: inv.customerCompany || null,
      source: "invoice",
      welcome: false,
    });
  }

  /* no product, no checkout: the invoice is made in HighLevel by the sync
     and paid on HighLevel's page. An add-on to an order is still an add-on. */
  const { data: invoice, error: iErr } = await db
    .from("invoices")
    .insert({
      kind: inv.parentOrderId ? "addon" : "custom",
      source: "platform",
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

  /* straight across, so the pay link exists before the screen refreshes; the
     outbox row the trigger wrote finds it unchanged a minute later */
  const synced = await nudgeInvoice(db, String(invoice.id));
  return NextResponse.json({ invoice: shape((synced ?? invoice) as InvoiceRow) });
}
