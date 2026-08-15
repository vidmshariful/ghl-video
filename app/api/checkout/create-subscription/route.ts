import { NextResponse } from "next/server";
import { getActiveProductBySku } from "@/lib/checkout/products";
import { ensureAuthAccount } from "@/lib/checkout/account";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { stripe } from "@/lib/checkout/stripe";
import { fpTidFromCookieHeader, normalizeRef, refFromCookieHeader } from "@/lib/affiliates";
import { checkCouponForSubscription, ensureStripeCouponId } from "@/lib/checkout/coupons";
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

  // The referring partner's ref, from the posted ref or the first-touch
  // ghlv_ref cookie. Attribution ONLY (metadata + the HighLevel affiliate
  // tag): any well-formed ref credits, known partner or not. The discount is
  // the coupon below, so a ref can never change a price.
  let ref =
    normalizeRef(asStr(payload.ref)) ??
    normalizeRef(refFromCookieHeader(req.headers.get("cookie")));
  // FirstPromoter's visitor id, stamped on Stripe for sale attribution
  let fpTid = fpTidFromCookieHeader(req.headers.get("cookie"));

  // No self-referral (program rule): a partner's own link never applies to
  // their own order.
  if (ref) {
    try {
      const { partnerByRef } = await import("@/lib/partners");
      const selfPartner = await partnerByRef(ref);
      if (selfPartner?.email && selfPartner.email.toLowerCase() === email) {
        console.warn(`[create-subscription] self-referral blocked: ${ref}`);
        ref = null;
        fpTid = null;
      }
    } catch {
      /* best-effort; never blocks checkout */
    }
  }

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
  // Stripe recurring prices are mode-specific (a test price id can't be used on
  // the live account). Prefer the price id for the running key's mode, and fall
  // back to the legacy single field so nothing breaks before a re-seed.
  // matches both standard (sk_live_) and restricted (rk_live_) live keys
  const liveMode = (process.env.STRIPE_SECRET_KEY ?? "").includes("_live_");
  const priceId =
    (liveMode ? product.metadata?.stripe_price_id_live : product.metadata?.stripe_price_id_test) ??
    product.metadata?.stripe_price_id;
  if (!priceId) {
    return NextResponse.json(
      { error: "This plan is not available right now. Please contact support." },
      { status: 503 },
    );
  }

  const db = supabaseAdmin();
  await db.from("customers").upsert({ email, name, company, phone }, { onConflict: "email", ignoreDuplicates: true });
  const { data: customer } = await db.from("customers").select("*").eq("email", email).single();
  if (!customer) return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  await ensureAuthAccount(email); // portal account, best-effort

  let stripeCustomerId: string | null = customer.stripe_customer_id;
  if (!stripeCustomerId) {
    const sc = await stripe().customers.create({
      email,
      name,
      phone: phone ?? undefined,
      metadata: {
        supabase_customer_id: customer.id,
        ...(fpTid ? { fp_tid: fpTid } : {}),
        ...(fpTid && ref ? { fp_ref: ref } : {}),
      },
    });
    stripeCustomerId = sc.id;
    await db.from("customers").update({ stripe_customer_id: stripeCustomerId }).eq("id", customer.id);
  } else if (fpTid) {
    // A returning buyer arriving via a partner link. FirstPromoter's Stripe
    // integration matches sales on CUSTOMER metadata, so the visitor id must
    // live there too; never overwrite an existing fp_tid (a client is
    // attributed to a partner once, permanently).
    try {
      const existing = await stripe().customers.retrieve(stripeCustomerId);
      const meta = (existing as { metadata?: Record<string, string> }).metadata ?? {};
      if (!meta.fp_tid) {
        await stripe().customers.update(stripeCustomerId, {
          metadata: { fp_tid: fpTid, ...(ref ? { fp_ref: ref } : {}) },
        });
      }
    } catch (e) {
      console.error("[create-subscription] fp_tid customer stamp failed:", (e as Error).message);
    }
  }

  // Idempotent on retry: a double-submit or reload reuses the still-pending
  // subscription created moments ago instead of stacking a new incomplete one
  // (Stripe would only expire the extras ~23h later).
  const { data: pending } = await db
    .from("subscriptions")
    .select("stripe_subscription_id, metadata")
    .eq("customer_email", email)
    .eq("product_id", product.id)
    .eq("status", "incomplete")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // Only reuse a still-pending sub if it carries the same affiliate ref, so a
  // buyer arriving via a partner link is never handed an earlier no-discount
  // sub (or vice versa); a mismatch falls through and creates a fresh one.
  const pendingRef = (pending?.metadata as { ref?: string } | null)?.ref ?? null;
  if (pending?.stripe_subscription_id && pendingRef === ref) {
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

  // Resolve the discount to charge, as a Stripe coupon derived server-side
  // from the entered code (the client never sets a price). The coupon is the
  // ONE discount rail; the ref only credits the partner via metadata below.
  // Done AFTER the pending-reuse check so a retry does not re-reserve a slot.
  const couponCodeRaw = asStr(payload.couponCode);
  let discountCouponId: string | null = null;
  let couponCode: string | null = null; // the applied buyer coupon, if any
  let couponReserved = false; // whether we hold its redemption slot

  if (couponCodeRaw) {
    const v = await checkCouponForSubscription(couponCodeRaw, sku);
    if (!v.ok) return NextResponse.json({ error: v.reason }, { status: 400 });
    // a partner's own audience coupon never discounts their own order
    const { data: couponOwner } = await db
      .from("partners")
      .select("email")
      .eq("coupon_code", v.coupon.code)
      .maybeSingle();
    if (couponOwner?.email && (couponOwner.email as string).toLowerCase() === email) {
      return NextResponse.json(
        { error: "Your own partner code does not apply to your own orders." },
        { status: 400 },
      );
    }
    couponCode = v.coupon.code;
    // reserve the redemption cap atomically before charging (released on failure)
    const { data: reserved, error: reserveErr } = await db.rpc("reserve_coupon_redemption", {
      p_code: couponCode,
    });
    if (reserveErr) {
      console.error(`[create-subscription] coupon reserve failed for ${couponCode}: ${reserveErr.message}`);
    } else if (reserved === false) {
      return NextResponse.json({ error: "That code has been fully redeemed." }, { status: 400 });
    } else {
      couponReserved = true;
    }
    try {
      discountCouponId = await ensureStripeCouponId(v.coupon);
    } catch (err) {
      console.error(`[create-subscription] could not build Stripe coupon for ${couponCode}: ${(err as Error).message}`);
      if (couponReserved) {
        try {
          await db.rpc("release_coupon_redemption", { p_code: couponCode });
        } catch {}
      }
      return NextResponse.json({ error: "Could not apply that code. Please try again." }, { status: 502 });
    }
  }

  let sub;
  try {
    sub = await stripe().subscriptions.create(
      {
        customer: stripeCustomerId,
        items: [{ price: priceId }],
        // The entered coupon, resolved to a Stripe coupon server-side above
        // so the client can never set a price.
        ...(discountCouponId ? { discounts: [{ coupon: discountCouponId }] } : {}),
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.confirmation_secret"],
        metadata: {
          sku,
          customer_email: email,
          ...(ref ? { ref, fp_ref: ref } : {}),
          ...(fpTid ? { fp_tid: fpTid } : {}),
          ...(couponCode ? { coupon_code: couponCode } : {}),
        },
      },
      // Same-minute duplicates (double-click racing past the reuse check above)
      // collapse onto one Stripe subscription. The ref is in the key so a no-ref
      // attempt can't mask a later ref attempt within the same minute.
      { idempotencyKey: `create-sub_${customer.id}_${sku}_${ref ?? ""}_${Math.floor(Date.now() / 60_000)}` },
    );
  } catch (err) {
    // Release the coupon slot reserved for this (now failed) attempt.
    if (couponReserved && couponCode) {
      try {
        await db.rpc("release_coupon_redemption", { p_code: couponCode });
      } catch {}
    }
    // Turn a Stripe failure (e.g. a price id from the wrong mode, or an invalid
    // coupon) into a clean JSON error instead of an empty 500 that the browser
    // would surface as "Unexpected end of JSON input".
    console.error(`[create-subscription] Stripe create failed for ${sku}: ${(err as Error).message}`);
    return NextResponse.json(
      { error: "We could not start this plan right now. Please try again, or contact support." },
      { status: 502 },
    );
  }

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
    metadata: { sku, ...(ref ? { ref } : {}), ...(couponCode ? { coupon_code: couponCode } : {}) },
  });
  if (rowErr && rowErr.code !== "23505") {
    // Not fatal to the buyer (the webhook reconstructs missing rows from the
    // subscription's metadata), but loud, because a live billing relationship
    // briefly exists with no local record.
    console.error(`[create-subscription] row insert failed for ${sub.id}: ${rowErr.message}`);
  }

  return NextResponse.json({ clientSecret, planName: product.name });
}
