import { NextResponse } from "next/server";
import { getActiveProductBySku } from "@/lib/checkout/products";
import { stripe } from "@/lib/checkout/stripe";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/*
 * Creates the PaymentIntent up front, when the checkout page loads, so the
 * Stripe Payment Element can mount immediately (single-page checkout). No
 * order or customer exists yet: those are created at /finalize when the buyer
 * pays, keyed to this intent. The amount is the product's base price; bumps
 * are re-priced server-side at /finalize just before confirmation, so the
 * client display is only a preview and can never change what is charged.
 */
export async function POST(req: Request) {
  const rl = rateLimit(`create-intent:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const sku = typeof payload.sku === "string" ? payload.sku.trim() : "";
  if (!sku || sku.length > 64) {
    return NextResponse.json({ error: "Missing product." }, { status: 400 });
  }

  const product = await getActiveProductBySku(sku);
  if (!product || product.type !== "one_time") {
    return NextResponse.json({ error: "That product is not available." }, { status: 404 });
  }

  const intent = await stripe().paymentIntents.create({
    amount: product.price_cents,
    currency: product.currency,
    automatic_payment_methods: { enabled: true },
    metadata: { sku: product.sku },
  });

  return NextResponse.json({
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
    amountCents: product.price_cents,
  });
}
