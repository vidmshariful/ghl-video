import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";

export const runtime = "nodejs";

/*
 * Order status for the thank-you page. The order id is an unguessable
 * UUID acting as a capability token; even so, this returns only the few
 * non-sensitive fields the confirmation screen needs, never PII or the
 * Stripe/HighLevel ids.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { data, error } = await supabaseAdmin()
    .from("orders")
    .select("status, amount_cents, currency, metadata, product:products(name)")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const product = data.product as unknown as { name: string } | null;
  return NextResponse.json({
    status: data.status,
    amountCents: data.amount_cents,
    currency: data.currency,
    productName: product?.name ?? null,
  });
}
