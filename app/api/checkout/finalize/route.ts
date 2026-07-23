import { NextResponse } from "next/server";
import { getActiveProductBySku } from "@/lib/checkout/products";
import { resolveSelectedBumps } from "@/lib/checkout/bumps";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { stripe } from "@/lib/checkout/stripe";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/*
 * Called the moment the buyer pays, just before Stripe confirmation. It turns
 * the on-load PaymentIntent into a real order: re-derives the price server-side
 * (base + valid bumps), creates/links the customer, writes the pending order
 * keyed to the intent, and stamps the intent's final amount + receipt email.
 * The webhook then flips the order to paid by the intent id (unchanged).
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const rl = rateLimit(`finalize:${clientIp(req)}`, 12, 60_000);
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

  const asStr = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const paymentIntentId = asStr(payload.paymentIntentId);
  const name = asStr(payload.name);
  const email = asStr(payload.email).toLowerCase();
  const company = asStr(payload.company) || null;
  const phone = asStr(payload.phone) || null;
  const bumpIds = Array.isArray(payload.bumpIds)
    ? (payload.bumpIds as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 10)
    : [];

  if (!paymentIntentId.startsWith("pi_")) {
    return NextResponse.json({ error: "Missing payment." }, { status: 400 });
  }
  if (!name) return NextResponse.json({ error: "Your name is required." }, { status: 400 });
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (name.length > 120 || email.length > 254 || (company?.length ?? 0) > 120 || (phone?.length ?? 0) > 32) {
    return NextResponse.json({ error: "One of the fields is too long." }, { status: 400 });
  }

  // The intent (created on load) is the source of the sku; the client can't
  // swap it. Re-derive the product and price from it.
  const intent = await stripe().paymentIntents.retrieve(paymentIntentId);
  const sku = typeof intent.metadata?.sku === "string" ? intent.metadata.sku : "";
  const product = await getActiveProductBySku(sku);
  if (!product) {
    return NextResponse.json({ error: "That product is not available." }, { status: 404 });
  }

  const { bumps, totalCents: bumpsCents } = await resolveSelectedBumps(product, bumpIds);
  const amountCents = product.price_cents + bumpsCents;

  const db = supabaseAdmin();

  // Idempotent: a double-submit (or a retry) reuses the order already made for
  // this intent instead of violating the unique intent-id constraint.
  const { data: existing } = await db
    .from("orders")
    .select("id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();
  if (existing) return NextResponse.json({ orderId: existing.id });

  // Upsert the customer, but never overwrite an existing row's details with an
  // unverified request.
  await db
    .from("customers")
    .upsert({ email, name, company, phone }, { onConflict: "email", ignoreDuplicates: true });
  const { data: customer, error: custErr } = await db
    .from("customers")
    .select("*")
    .eq("email", email)
    .single();
  if (custErr || !customer) {
    return NextResponse.json({ error: "Could not complete checkout." }, { status: 500 });
  }

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

  const { data: order, error: orderErr } = await db
    .from("orders")
    .insert({
      product_id: product.id,
      customer_id: customer.id,
      customer_email: email,
      amount_cents: amountCents,
      currency: product.currency,
      status: "pending",
      stripe_payment_intent_id: paymentIntentId,
      metadata: {
        sku: product.sku,
        base_cents: product.price_cents,
        bumps: bumps.map((b) => ({ id: b.id, name: b.name, price_cents: b.priceCents })),
      },
    })
    .select()
    .single();
  if (orderErr || !order) {
    return NextResponse.json({ error: "Could not complete checkout." }, { status: 500 });
  }

  // Stamp the intent with the authoritative amount, the customer, and the order
  // id so wallets charge the right total and receipts land.
  await stripe().paymentIntents.update(paymentIntentId, {
    amount: amountCents,
    customer: stripeCustomerId,
    receipt_email: email,
    metadata: {
      sku: product.sku,
      order_id: order.id,
      customer_email: email,
      bump_cents: String(bumpsCents),
    },
  });

  await db.from("order_events").insert({
    order_id: order.id,
    event_type: "intent_finalized",
    payload: { stripe_payment_intent_id: paymentIntentId, amount_cents: amountCents },
  });

  return NextResponse.json({ orderId: order.id });
}
