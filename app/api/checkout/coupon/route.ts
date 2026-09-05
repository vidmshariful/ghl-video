import { NextResponse } from "next/server";
import { getActiveProductBySku } from "@/lib/checkout/products";
import { checkCoupon, checkCouponForSubscription, couponLabel } from "@/lib/checkout/coupons";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { minimumChargeProblem } from "@/lib/checkout/money-rules";

export const runtime = "nodejs";

/*
 * Display-time coupon validation for the checkout page. Returns the
 * discount the buyer will see; /finalize re-runs the same check at pay
 * time, so this endpoint can never change what the card is charged.
 * Rate-limited harder than the rest of checkout: it is the one place
 * codes can be guessed.
 */
export async function POST(req: Request) {
  const rl = rateLimit(`coupon:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again in a minute." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code : "";
  const sku = typeof body.sku === "string" ? body.sku.trim() : "";
  if (!code.trim() || !sku || sku.length > 64) {
    return NextResponse.json({ error: "Missing code or product." }, { status: 400 });
  }

  const product = await getActiveProductBySku(sku);
  if (!product) {
    return NextResponse.json({ error: "That product is not available." }, { status: 404 });
  }

  // Editing subscription: return the terms so the client can display the
  // discount (and how long it lasts); create-subscription re-checks and applies.
  if (product.type === "subscription") {
    const v = await checkCouponForSubscription(code, product.sku);
    if (!v.ok) return NextResponse.json({ valid: false, reason: v.reason });
    const c = v.coupon;
    return NextResponse.json({
      valid: true,
      code: c.code,
      label: couponLabel(c),
      percentOff: c.percent_off,
      amountOffCents: c.amount_off_cents,
      subDuration: c.sub_duration,
      subDurationMonths: c.sub_duration_months,
    });
  }

  const chk = await checkCoupon(code, product.sku);
  if (!chk.ok) {
    return NextResponse.json({ valid: false, reason: chk.reason });
  }
  const discountCents = chk.discountFor(product.price_cents);
  /* the card minimum, checked on the base price alone: add-ons only ever
     add, and a code that zeroes the video is refused whatever is bolted on */
  const floor = minimumChargeProblem(product.price_cents, discountCents);
  if (floor) return NextResponse.json({ valid: false, reason: floor });
  return NextResponse.json({
    valid: true,
    code: chk.code,
    label: chk.label,
    discountCents,
  });
}
