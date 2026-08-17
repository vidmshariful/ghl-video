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

  const orders = (data ?? []).map((o) => {
    const product = o.product as unknown as {
      name: string;
      sku: string;
      metadata: { code?: string } | null;
    } | null;
    return {
      id: o.id,
      productName: product?.name ?? null,
      productCode: product?.metadata?.code ?? product?.sku?.toUpperCase() ?? null,
      amountCents: o.amount_cents,
      currency: o.currency,
      status: o.status,
      stage: o.fulfillment_stage,
      invoiceNumber: o.invoice_number,
      createdAt: o.created_at,
      /* the dashboard needs this to say "waiting on your brief", which is the
         most actionable thing it can tell somebody */
      intakeCompleted: Boolean(o.intake_completed),
    };
  });
  return NextResponse.json({ email, orders });
}
