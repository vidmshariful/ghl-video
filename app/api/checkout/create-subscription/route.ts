import { NextResponse } from "next/server";
import { getActiveProductBySku } from "@/lib/checkout/products";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { stripe } from "@/lib/checkout/stripe";
import { rateLimit, clientIp } from "@/lib/rate-limit";

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
  const rl = rateLimit(`create-sub:${clientIp(req)}`, 8, 60_000);
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

  // Idempotent on retry: a double-submit or reload reuses the still-pending
  // subscription created moments ago instead of stacking a new incomplete one
  // (Stripe would only expire the extras ~23h later).
  const { data: pending } = await db
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("customer_email", email)
    .eq("product_id", product.id)
    .eq("status", "incomplete")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pending?.stripe_subscription_id) {
    try {
      const existing = await stripe().subscriptions.retrieve(pending.stripe_subscription_id, {
        expand: ["latest_invoice.confirmation_secret"],
      });
      const existingInvoice = existing.latest_invoice as unknown as {
        confirmation_secret?: { client_secret?: string };
      } | null;
      const existingSecret = existingInvoice?.confirmation_secret?.client_secret;
      if (existing.status === "incomplete" && existingSecret) {
        return NextResponse.json({ clientSecret: existingSecret, planName: product.name });
      }
    } catch {
      // fall through and create a fresh subscription
    }
  }

  const sub = await stripe().subscriptions.create(
    {
      customer: stripeCustomerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.confirmation_secret"],
      metadata: { sku, customer_email: email },
    },
    // Same-minute duplicates (double-click racing past the reuse check above)
    // collapse onto one Stripe subscription.
    { idempotencyKey: `create-sub_${customer.id}_${sku}_${Math.floor(Date.now() / 60_000)}` },
  );

  // Current Stripe API (2026-...) carries the first invoice's client secret
  // on confirmation_secret, which the Payment Element confirms on-domain.
  const invoice = sub.latest_invoice as unknown as {
    confirmation_secret?: { client_secret?: string };
  } | null;
  const clientSecret = invoice?.confirmation_secret?.client_secret;
  if (!clientSecret) {
    return NextResponse.json({ error: "Could not start the subscription." }, { status: 500 });
  }

  const { error: rowErr } = await db.from("subscriptions").insert({
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
  if (rowErr && rowErr.code !== "23505") {
    // Not fatal to the buyer (the webhook reconstructs missing rows from the
    // subscription's metadata), but loud, because a live billing relationship
    // briefly exists with no local record.
    console.error(`[create-subscription] row insert failed for ${sub.id}: ${rowErr.message}`);
  }

  return NextResponse.json({ clientSecret, planName: product.name });
}
