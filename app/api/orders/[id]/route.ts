import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { stripe } from "@/lib/checkout/stripe";
import { settlePaidIntent } from "@/lib/checkout/settle";

export const runtime = "nodejs";

/*
 * Order status + receipt detail for the thank-you page. The order id is an
 * unguessable UUID acting as a capability token, so this returns only what
 * the buyer's own confirmation needs (including the email they just entered)
 * and never the Stripe/HighLevel ids.
 *
 * If the order is still pending, it reconciles against Stripe before
 * answering: the webhook normally flips the order to paid, but it can lag, be
 * missed, or (in local dev) never reach the server at all, so the confirmation
 * must not depend on it. When Stripe reports the intent succeeded we settle
 * the order here (mark paid; HighLevel sync stays the webhook's job).
 */
type Meta = {
  code?: string;
  kind?: string;
  delivery_days?: number;
  video_count?: number;
};
type OrderMeta = {
  bumps?: { id: string; name: string; price_cents: number }[];
};

const SELECT =
  "status, amount_cents, currency, invoice_number, customer_email, metadata, stripe_payment_intent_id, product:products(name, sku, metadata)";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = supabaseAdmin();
  const initial = await db
    .from("orders")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();

  if (initial.error || !initial.data) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  let data = initial.data;

  // Reconcile a still-pending order against Stripe so the confirmation page
  // never waits on the webhook. Best-effort: if Stripe is unreachable or
  // unconfigured, fall through with whatever the DB already has.
  if (data.status === "pending" && data.stripe_payment_intent_id) {
    try {
      const pi = await stripe().paymentIntents.retrieve(
        data.stripe_payment_intent_id as string,
      );
      if (pi.status === "succeeded") {
        await settlePaidIntent(db, pi, { fulfill: false });
        const refreshed = await db
          .from("orders")
          .select(SELECT)
          .eq("id", id)
          .maybeSingle();
        if (refreshed.data) data = refreshed.data;
      }
    } catch {
      // Stripe unreachable/unconfigured: keep the current DB status.
    }
  }

  const product = data.product as unknown as {
    name: string;
    sku: string;
    metadata: Meta | null;
  } | null;
  const pm = product?.metadata ?? {};
  const om = (data.metadata ?? {}) as OrderMeta;
  return NextResponse.json({
    status: data.status,
    amountCents: data.amount_cents,
    currency: data.currency,
    invoiceNumber: data.invoice_number ?? null,
    email: data.customer_email ?? null,
    productName: product?.name ?? null,
    productCode: product?.metadata?.code ?? product?.sku?.toUpperCase() ?? null,
    kind: pm.kind ?? null,
    videoCount: pm.video_count ?? null,
    deliveryDays: pm.delivery_days ?? null,
    bumps: (om.bumps ?? []).map((b) => ({ name: b.name, priceCents: b.price_cents })),
  });
}
