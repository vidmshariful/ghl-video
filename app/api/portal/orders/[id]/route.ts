import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/account/session";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";

export const runtime = "nodejs";

/* One order's detail for the portal. The ownership check (order email must
 * equal the session email) is the gate; a mismatch returns 404 so the route
 * never confirms another customer's order even exists. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const email = await getSessionEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const db = supabaseAdmin();
  const { data: o } = await db
    .from("orders")
    .select("*, product:products(name, sku, metadata)")
    .eq("id", id)
    .maybeSingle();
  if (!o || o.customer_email !== email) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { data: updates } = await db
    .from("order_updates")
    .select("body, created_at")
    .eq("order_id", id)
    .order("created_at", { ascending: false });

  const product = o.product as unknown as {
    name: string;
    sku: string;
    metadata: { code?: string } | null;
  } | null;
  return NextResponse.json({
    order: {
      id: o.id,
      productName: product?.name ?? null,
      productCode: product?.metadata?.code ?? product?.sku?.toUpperCase() ?? null,
      amountCents: o.amount_cents,
      currency: o.currency,
      status: o.status,
      stage: o.fulfillment_stage,
      manager: o.assigned_manager,
      // never surface a delivery link on a refunded order
      deliveryUrl: o.status === "refunded" ? null : o.delivery_url,
      invoiceNumber: o.invoice_number,
      intakeCompleted: o.intake_completed,
      createdAt: o.created_at,
      paidAt: o.paid_at,
    },
    updates: (updates ?? []).map((u) => ({ body: u.body, createdAt: u.created_at })),
  });
}
