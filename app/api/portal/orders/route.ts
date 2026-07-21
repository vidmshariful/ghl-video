import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/account/session";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";

export const runtime = "nodejs";

/* The signed-in customer's own orders. Filtered by their verified email; a
 * customer can never see another customer's orders. Returns only the fields
 * the portal shows. */
export async function GET(req: Request) {
  const email = await getSessionEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { data } = await supabaseAdmin()
    .from("orders")
    .select(
      "id, amount_cents, currency, status, fulfillment_stage, invoice_number, created_at, product:products(name)",
    )
    .eq("customer_email", email)
    .order("created_at", { ascending: false });

  const orders = (data ?? []).map((o) => {
    const product = o.product as unknown as { name: string } | null;
    return {
      id: o.id,
      productName: product?.name ?? null,
      amountCents: o.amount_cents,
      currency: o.currency,
      status: o.status,
      stage: o.fulfillment_stage,
      invoiceNumber: o.invoice_number,
      createdAt: o.created_at,
    };
  });
  return NextResponse.json({ email, orders });
}
