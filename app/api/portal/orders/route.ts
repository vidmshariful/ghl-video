import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { contextCan, resolvePortalContext } from "@/lib/account-team";

export const runtime = "nodejs";

/* The acting account's orders: the owner, or a team member the owner
 * granted the orders area. Data is always scoped to the owner's email. */
export async function GET(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });
  if (!contextCan(ctx, "orders"))
    return NextResponse.json({ error: "You do not have access to orders." }, { status: 403 });
  const email = ctx.ownerEmail;

  const { data } = await db
    .from("orders")
    .select(
      "id, amount_cents, currency, status, fulfillment_stage, invoice_number, created_at, intake_completed, product:products(name, sku, metadata)",
    )
    .eq("customer_email", email)
    .order("created_at", { ascending: false });

  /*
   * An invoice payment is a payment, not an order for videos. It used to
   * read as one here, with a "waiting on your brief" chip and a branding
   * brief nobody asked for. It carries its kind and the bill it paid now,
   * so every screen can say what it was.
   */
  const rows = data ?? [];
  const invoiceSkus = rows
    .filter((o) => (o.product as { metadata?: { invoice?: unknown } } | null)?.metadata?.invoice)
    .map((o) => String((o.product as { sku?: string } | null)?.sku ?? ""));
  const { data: bills } = invoiceSkus.length
    ? await db.from("invoices").select("number, product_sku").in("product_sku", invoiceSkus)
    : { data: [] };
  const billBySku = new Map((bills ?? []).map((b) => [String(b.product_sku), String(b.number)]));

  const orders = rows.map((o) => {
    const product = o.product as unknown as {
      name: string;
      sku: string;
      metadata: { code?: string; invoice?: unknown } | null;
    } | null;
    const invoice = Boolean(product?.metadata?.invoice);
    return {
      id: o.id,
      productName: product?.name ?? null,
      productCode: invoice ? null : (product?.metadata?.code ?? product?.sku?.toUpperCase() ?? null),
      amountCents: o.amount_cents,
      currency: o.currency,
      status: o.status,
      stage: o.fulfillment_stage,
      invoiceNumber: o.invoice_number,
      createdAt: o.created_at,
      /* the dashboard needs this to say "waiting on your brief", which is the
         most actionable thing it can tell somebody */
      intakeCompleted: Boolean(o.intake_completed),
      kind: invoice ? ("invoice" as const) : ("premade" as const),
      /* the bill this payment settled, by its own number */
      paysInvoice: invoice ? (billBySku.get(String(product?.sku ?? "")) ?? null) : null,
    };
  });
  return NextResponse.json({ email, orders });
}
