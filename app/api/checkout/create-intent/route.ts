import { NextResponse } from "next/server";
import { getActiveProductBySku } from "@/lib/checkout/products";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { stripe } from "@/lib/checkout/stripe";

export const runtime = "nodejs";

/*
 * Creates the PaymentIntent for a SKU. The amount is read from the product
 * row server-side (never from the client). Writes a pending order, then
 * returns only the client_secret and the order id.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Coerce defensively: a non-string field becomes "" rather than throwing.
  const asStr = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const sku = asStr(payload.sku);
  const email = asStr(payload.email).toLowerCase();
  const name = asStr(payload.name);
  const company = asStr(payload.company) || null;
  const phone = asStr(payload.phone) || null;

  if (!sku) return NextResponse.json({ error: "Missing product." }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  // Length caps: reject before any DB or Stripe object is created.
  if (
    sku.length > 64 ||
    name.length > 120 ||
    email.length > 254 ||
    (company?.length ?? 0) > 120 ||
    (phone?.length ?? 0) > 32
  ) {
    return NextResponse.json({ error: "One of the fields is too long." }, { status: 400 });
  }

  const product = await getActiveProductBySku(sku);
  if (!product) {
    return NextResponse.json({ error: "That product is not available." }, { status: 404 });
  }

  const db = supabaseAdmin();

  // Insert the customer if new, but do NOT overwrite an existing row's
  // profile: the email is not proven to belong to the caller, so an
  // unverified request must not clobber a real customer's stored details.
  await db
    .from("customers")
    .upsert({ email, name, company, phone }, { onConflict: "email", ignoreDuplicates: true });
  const { data: customer, error: custErr } = await db
    .from("customers")
    .select("*")
    .eq("email", email)
    .single();
  if (custErr || !customer) {
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }

  // Reuse or create the Stripe customer.
  let stripeCustomerId: string | null = customer.stripe_customer_id;
  if (!stripeCustomerId) {
    const sc = await stripe().customers.create({
      email,
      name,
      phone: phone ?? undefined,
      metadata: { supabase_customer_id: customer.id },
    });
    stripeCustomerId = sc.id;
    await db.from("customers").update({ stripe_customer_id: stripeCustomerId }).eq("id", customer.id);
  }

  // Pending order first, so its id can ride in the PaymentIntent metadata.
  const { data: order, error: orderErr } = await db
    .from("orders")
    .insert({
      product_id: product.id,
      customer_id: customer.id,
      customer_email: email,
      amount_cents: product.price_cents,
      currency: product.currency,
      status: "pending",
      metadata: { sku: product.sku },
    })
    .select()
    .single();
  if (orderErr || !order) {
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }

  const intent = await stripe().paymentIntents.create({
    amount: product.price_cents,
    currency: product.currency,
    customer: stripeCustomerId,
    automatic_payment_methods: { enabled: true },
    metadata: { order_id: order.id, sku: product.sku, customer_email: email },
  });

  await db
    .from("orders")
    .update({ stripe_payment_intent_id: intent.id })
    .eq("id", order.id);

  await db.from("order_events").insert({
    order_id: order.id,
    event_type: "intent_created",
    payload: { stripe_payment_intent_id: intent.id, amount_cents: product.price_cents },
  });

  return NextResponse.json({ clientSecret: intent.client_secret, orderId: order.id });
}
