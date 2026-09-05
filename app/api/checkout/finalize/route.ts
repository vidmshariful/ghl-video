import { NextResponse } from "next/server";
import { getActiveProductBySku } from "@/lib/checkout/products";
import { resolveSelectedBumps } from "@/lib/checkout/bumps";
import { checkCoupon } from "@/lib/checkout/coupons";
import { orderTotalCents, MIN_CHARGE_CENTS, minimumChargeProblem } from "@/lib/checkout/money-rules";
import {
  fpTidFromCookieHeader,
  refFromCookieHeader,
  saVidFromCookieHeader,
} from "@/lib/affiliates";
import { firstTouchFromCookieHeader } from "@/lib/first-touch";
import { ensureAuthAccount } from "@/lib/checkout/account";
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

  // First-touch affiliate ref (set as a cookie by the middleware from a ?ref=
  // link). Recorded on the order for attribution; it never affects the price.
  let ref = refFromCookieHeader(req.headers.get("cookie"));
  /* the page this buyer first landed on, weeks ago or minutes ago. Null for
     anyone whose first visit predates this feature, which is expected. */
  const firstTouch = firstTouchFromCookieHeader(req.headers.get("cookie"));
  const firstTouchColumns = firstTouch
    ? {
        first_landing_path: firstTouch.path,
        first_referrer: firstTouch.referrer,
        first_campaign: firstTouch.campaign,
        first_seen_at: new Date(firstTouch.at * 1000).toISOString(),
      }
    : {};
  // FirstPromoter's visitor id: stamped on Stripe so FP attributes the sale
  // to the clicked link (fp_ref rides along as the fallback match).
  let fpTid = fpTidFromCookieHeader(req.headers.get("cookie"));
  /* Affixo's visitor id, stamped so the webhook can attribute the sale. It
     is read here and never validated: an id we cannot match just means the
     sale attributes on ref or email instead, which is Affixo's job to sort. */
  const saVid = saVidFromCookieHeader(req.headers.get("cookie"));

  // No self-referral (program rule): a partner's own link never applies to
  // their own order. Drop the attribution entirely so neither our records
  // nor FirstPromoter credit the sale.
  if (ref) {
    try {
      const { partnerByRef } = await import("@/lib/partners");
      const selfPartner = await partnerByRef(ref);
      if (selfPartner?.email && selfPartner.email.toLowerCase() === email) {
        console.warn(`[finalize] self-referral blocked: ${ref} bought with own link`);
        ref = null;
        fpTid = null;
      }
    } catch {
      /* attribution stays; the rule is best-effort, never blocks checkout */
    }
  }

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

  // A coupon is re-validated at pay time; an invalid or expired code fails
  // loudly here instead of silently charging the undiscounted price the
  // buyer was not shown. The discount applies to the base price only.
  const couponCode = asStr(payload.couponCode);
  let discountCents = 0;
  let couponMeta: { code: string; label: string; discount_cents: number } | null = null;
  if (couponCode) {
    const chk = await checkCoupon(couponCode, product.sku);
    if (!chk.ok) {
      return NextResponse.json({ error: chk.reason }, { status: 400 });
    }
    // a partner's own audience coupon never discounts their own order
    const { data: couponOwner } = await supabaseAdmin()
      .from("partners")
      .select("email")
      .eq("coupon_code", chk.code)
      .maybeSingle();
    if (couponOwner?.email && (couponOwner.email as string).toLowerCase() === email) {
      return NextResponse.json(
        { error: "Your own partner code does not apply to your own orders." },
        { status: 400 },
      );
    }
    discountCents = chk.discountFor(product.price_cents);
    couponMeta = { code: chk.code, label: chk.label, discount_cents: discountCents };
  }

  const amountCents = orderTotalCents({
    basePriceCents: product.price_cents,
    bumpsCents,
    discountCents,
  });
  if (amountCents < MIN_CHARGE_CENTS) {
    // Stripe's charge minimum. The old note here called this unreachable
    // because of the database's discount bounds. Percent codes are capped
    // at 90% there; a fixed amount is not capped against any price, so it
    // was reachable all along, and it answered with nothing to go on. The
    // coupon route now refuses such a code when it is applied; this stays
    // as the hard floor and says the same thing if anything slips past.
    return NextResponse.json(
      { error: minimumChargeProblem(amountCents + Math.max(0, discountCents), discountCents) ?? "Could not complete checkout." },
      { status: 400 },
    );
  }

  const db = supabaseAdmin();

  // Idempotent: a double-submit (or a retry) reuses the order already made for
  // this intent instead of violating the unique intent-id constraint. A retry
  // may carry different bumps, so a still-unpaid order is re-derived and the
  // intent re-stamped; the intent can never be confirmed against a stale total.
  const { data: existing } = await db
    .from("orders")
    .select("id, status, amount_cents")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();
  if (existing) {
    if (existing.status === "pending" || existing.status === "failed") {
      await db
        .from("orders")
        .update({
          amount_cents: amountCents,
          metadata: {
            sku: product.sku,
            base_cents: product.price_cents,
            bumps: bumps.map((b) => ({ id: b.id, name: b.name, price_cents: b.priceCents })),
            ...(couponMeta ? { coupon: couponMeta } : {}),
            ...(ref ? { ref } : {}),
          },
          ...firstTouchColumns,
        })
        .eq("id", existing.id)
        .in("status", ["pending", "failed"]);
      try {
        await stripe().paymentIntents.update(paymentIntentId, {
          amount: amountCents,
          receipt_email: email,
          metadata: {
            sku: product.sku,
            customer_email: email,
            bump_cents: String(bumpsCents),
            // empty string deletes the key on a retry that dropped the code
            coupon_code: couponMeta?.code ?? "",
            discount_cents: couponMeta ? String(discountCents) : "",
            ...(ref ? { ref } : {}),
          },
        });
      } catch {
        // The intent may have reached a terminal state in the meantime; the
        // settle-time amount check catches any real divergence.
      }
      if (existing.amount_cents !== amountCents) {
        await db.from("order_events").insert({
          order_id: existing.id,
          event_type: "intent_restamped",
          payload: { from_cents: existing.amount_cents, to_cents: amountCents },
        });
      }
    }
    return NextResponse.json({ orderId: existing.id });
  }

  // New order for this intent. Reserve a coupon redemption slot atomically
  // BEFORE charging, so a capped code cannot be over-redeemed by a burst (the
  // old settle-time increment lagged the pay step). Released below if the order
  // is not written (e.g. a concurrent double-submit loses the insert race). On
  // a reserve-infra error we do NOT block the sale; the cap simply is not
  // enforced until the migration is in place.
  if (couponMeta) {
    const { data: reserved, error: reserveErr } = await db.rpc("reserve_coupon_redemption", {
      p_code: couponMeta.code,
    });
    if (reserveErr) {
      console.error(`[finalize] coupon reserve failed for ${couponMeta.code}: ${reserveErr.message}`);
    } else if (reserved === false) {
      return NextResponse.json({ error: "That code has been fully redeemed." }, { status: 400 });
    }
  }

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

  /* Give the buyer a portal account keyed to this email, with the password
   * they chose at checkout, so they can sign in the moment they have paid
   * instead of meeting a reset screen. Best-effort: never blocks the order.
   *
   * A repeat buyer keeps the password they already had. See account.ts for
   * why overwriting it would be an account takeover hole. */
  const account = await ensureAuthAccount(email, asStr(payload.password) || null);

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
    // live there too; but never overwrite an existing fp_tid, because a
    // client is attributed to a partner once, permanently.
    try {
      const existing = await stripe().customers.retrieve(stripeCustomerId);
      const meta = (existing as { metadata?: Record<string, string> }).metadata ?? {};
      if (!meta.fp_tid) {
        await stripe().customers.update(stripeCustomerId, {
          metadata: { fp_tid: fpTid, ...(ref ? { fp_ref: ref } : {}) },
        });
      }
    } catch (e) {
      console.error("[finalize] fp_tid customer stamp failed:", (e as Error).message);
    }
  }

  // Stamp the intent with the authoritative amount, the customer, and the
  // buyer's email BEFORE the order exists. Order matters: if this update
  // fails, no order is written and the retry re-stamps, so a buyer can never
  // confirm an intent carrying a stale (base-only) amount. Stamping the email
  // here also means a paid intent always identifies its buyer, even if the
  // order insert below fails and webhook recovery has to reconstruct it.
  await stripe().paymentIntents.update(paymentIntentId, {
    amount: amountCents,
    customer: stripeCustomerId,
    receipt_email: email,
    metadata: {
      sku: product.sku,
      customer_email: email,
      bump_cents: String(bumpsCents),
      coupon_code: couponMeta?.code ?? "",
      discount_cents: couponMeta ? String(discountCents) : "",
      ...(ref ? { ref, fp_ref: ref } : {}),
      ...(fpTid ? { fp_tid: fpTid } : {}),
      ...(saVid ? { sa_vid: saVid } : {}),
    },
  });

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
        ...(couponMeta ? { coupon: couponMeta } : {}),
        ...(ref ? { ref } : {}),
      },
      ...firstTouchColumns,
    })
    .select()
    .single();
  if (orderErr || !order) {
    // We reserved a coupon slot above but no order row was written; release it
    // so the count stays balanced (the winner of a race reserved its own).
    if (couponMeta) {
      try {
        await db.rpc("release_coupon_redemption", { p_code: couponMeta.code });
      } catch {}
    }
    // A concurrent double-submit can race past the existing-order check and
    // lose on the unique intent-id constraint; reuse the winner's order.
    if (orderErr?.code === "23505") {
      const { data: raced } = await db
        .from("orders")
        .select("id")
        .eq("stripe_payment_intent_id", paymentIntentId)
        .maybeSingle();
      if (raced) return NextResponse.json({ orderId: raced.id });
    }
    return NextResponse.json({ error: "Could not complete checkout." }, { status: 500 });
  }

  // Best-effort back-link (Stripe merges metadata keys); never blocks checkout.
  try {
    await stripe().paymentIntents.update(paymentIntentId, {
      metadata: { order_id: order.id },
    });
  } catch {}

  await db.from("order_events").insert({
    order_id: order.id,
    event_type: "intent_finalized",
    payload: {
      stripe_payment_intent_id: paymentIntentId,
      amount_cents: amountCents,
      ...(couponMeta ? { coupon_code: couponMeta.code, discount_cents: discountCents } : {}),
    },
  });

  /* accountReady tells the thank-you page whether the password just typed
   * actually works. False for a repeat buyer, who signs in with the one they
   * already have, so we can word the next step honestly either way. */
  return NextResponse.json({ orderId: order.id, accountReady: account.passwordSet });
}
