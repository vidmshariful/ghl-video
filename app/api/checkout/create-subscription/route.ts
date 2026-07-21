import { NextResponse } from "next/server";
import { getActiveProductBySku } from "@/lib/checkout/products";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { stripe } from "@/lib/checkout/stripe";

export const runtime = "nodejs";

/*
 * Starts a subscription for an editing plan, on-domain. Creates the Stripe
 * subscription in default_incomplete so its first invoice yields a
 * PaymentIntent we confirm with the Payment Element (same on-domain UX as
 * the one-time checkout). The subscription row is written incomplete; the
 * webhook flips it to active once the first invoice is paid.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const asStr = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const sku = asStr(payload.sku);
  const email = asStr(payload.email).toLowerCase();
  const name = asStr(payload.name);
  const company = asStr(payload.company) || null;
  const phone = asStr(payload.phone) || null;

  if (!sku) return NextResponse.json({ error: "Missing plan." }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (sku.length > 64 || name.length > 120 || email.length > 254 || (company?.length ?? 0) > 120 || (phone?.length ?? 0) > 32) {
    return NextResponse.json({ error: "One of the fields is too long." }, { status: 400 });
  }

  const product = await getActiveProductBySku(sku);
  if (!product || product.type !== "subscription") {
    return NextResponse.json({ error: "That plan is not available." }, { status: 404 });
  }
  const priceId = product.metadata?.stripe_price_id as string | undefined;
  if (!priceId) return NextResponse.json({ error: "Plan is not configured." }, { status: 500 });

  const db = supabaseAdmin();
  await db.from("customers").upsert({ email, name, company, phone }, { onConflict: "email", ignoreDuplicates: true });
  const { data: customer } = await db.from("customers").select("*").eq("email", email).single();
  if (!customer) return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });

  let stripeCustomerId: string | null = customer.stripe_customer_id;
  if (!stripeCustomerId) {
    const sc = await stripe().customers.create({ email, name, phone: phone ?? undefined, metadata: { supabase_customer_id: customer.id } });
    stripeCustomerId = sc.id;
    await db.from("customers").update({ stripe_customer_id: stripeCustomerId }).eq("id", customer.id);
  }

  const sub = await stripe().subscriptions.create({
    customer: stripeCustomerId,
    items: [{ price: priceId }],
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    expand: ["latest_invoice.confirmation_secret"],
    metadata: { sku, customer_email: email },
  });

  // Current Stripe API (2026-...) carries the first invoice's client secret
  // on confirmation_secret, which the Payment Element confirms on-domain.
  const invoice = sub.latest_invoice as unknown as {
    confirmation_secret?: { client_secret?: string };
  } | null;
  const clientSecret = invoice?.confirmation_secret?.client_secret;
  if (!clientSecret) {
    return NextResponse.json({ error: "Could not start the subscription." }, { status: 500 });
  }

  await db.from("subscriptions").insert({
    customer_id: customer.id,
    customer_email: email,
    product_id: product.id,
    stripe_subscription_id: sub.id,
    stripe_customer_id: stripeCustomerId,
    status: sub.status,
    plan_name: product.name,
    amount_cents: product.price_cents,
    currency: product.currency,
    interval: "month",
    metadata: { sku },
  });

  return NextResponse.json({ clientSecret, planName: product.name });
}
