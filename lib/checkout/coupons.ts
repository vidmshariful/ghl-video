import "server-only";
import { supabaseAdmin } from "./supabase-admin";
import { stripe } from "./stripe";

/*
 * Coupon validation and discount math, the only place either happens.
 * Both the validate endpoint (display) and /finalize (the charge) call
 * this, so what the buyer sees and what the card is charged can never
 * disagree. The discount applies to the BASE product price only, never
 * to order bumps: bumps are already discounted offers.
 *
 * One-time products discount via the PaymentIntent (cents off). Editing
 * SUBSCRIPTION plans need a Stripe coupon object, so a coupon opted in for
 * editing (sub_eligible) is bridged to a Stripe coupon by ensureStripeCouponId,
 * built from the coupon's own percent/amount + sub_duration.
 */
export type CouponRow = {
  id: string;
  code: string;
  percent_off: number | null;
  amount_off_cents: number | null;
  sku: string | null;
  valid_from: string | null;
  valid_until: string | null;
  max_redemptions: number | null;
  redemption_count: number;
  active: boolean;
  // subscription (editing) support
  sub_eligible: boolean;
  sub_duration: "once" | "forever" | "repeating" | null;
  sub_duration_months: number | null;
  stripe_coupon_id: string | null;
};

export type CouponCheck =
  | { ok: true; code: string; label: string; discountFor: (baseCents: number) => number }
  | { ok: false; reason: string };

export type ValidCoupon = { ok: true; coupon: CouponRow } | { ok: false; reason: string };

export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase().slice(0, 32);
}

export function couponLabel(c: CouponRow): string {
  return c.percent_off != null
    ? `${c.percent_off}% off`
    : `$${((c.amount_off_cents ?? 0) / 100).toLocaleString("en-US")} off`;
}

/* Core validation shared by the one-time and subscription paths: active, in its
 * validity window, sku-scoped, and under its redemption cap. Returns the row. */
export async function validateCoupon(rawCode: string, sku: string): Promise<ValidCoupon> {
  const code = normalizeCouponCode(rawCode);
  if (code.length < 3) return { ok: false, reason: "That code is not valid." };

  const { data, error } = await supabaseAdmin()
    .from("coupons")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (error) throw new Error(`coupon lookup failed: ${error.message}`);
  const c = data as CouponRow | null;

  if (!c || !c.active) return { ok: false, reason: "That code is not valid." };
  const now = Date.now();
  if (c.valid_from && now < Date.parse(c.valid_from)) {
    return { ok: false, reason: "That code is not active yet." };
  }
  if (c.valid_until && now > Date.parse(c.valid_until)) {
    return { ok: false, reason: "That code has expired." };
  }
  if (c.sku && c.sku !== sku) {
    return { ok: false, reason: "That code does not apply to this product." };
  }
  if (c.max_redemptions != null && c.redemption_count >= c.max_redemptions) {
    return { ok: false, reason: "That code has been fully redeemed." };
  }
  return { ok: true, coupon: c };
}

/* One-time path: returns the label + a cents-discount function for a base price. */
export async function checkCoupon(rawCode: string, sku: string): Promise<CouponCheck> {
  const v = await validateCoupon(rawCode, sku);
  if (!v.ok) return v;
  const c = v.coupon;
  const discountFor = (baseCents: number) =>
    c.percent_off != null
      ? Math.round((baseCents * c.percent_off) / 100)
      : Math.min(c.amount_off_cents!, baseCents);
  return { ok: true, code: c.code, label: couponLabel(c), discountFor };
}

/* Subscription path: same validation, plus the coupon must be opted in for
 * editing plans (sub_eligible). Returns the row so the caller can display the
 * terms and resolve the Stripe coupon. */
export async function checkCouponForSubscription(rawCode: string, sku: string): Promise<ValidCoupon> {
  const v = await validateCoupon(rawCode, sku);
  if (!v.ok) return v;
  if (!v.coupon.sub_eligible) {
    return { ok: false, reason: "That code does not apply to editing plans." };
  }
  return v;
}

/* Ensure a Stripe coupon exists that mirrors this DB coupon's discount +
 * subscription duration, and return its id (to pass to subscriptions.create).
 * The id encodes the terms, so changing the coupon in admin produces a fresh
 * Stripe coupon rather than silently reusing stale terms. Idempotent. */
export async function ensureStripeCouponId(coupon: CouponRow): Promise<string> {
  const duration: "once" | "forever" | "repeating" = coupon.sub_duration ?? "once";
  const months = duration === "repeating" ? Math.max(1, coupon.sub_duration_months ?? 1) : undefined;

  const kind = coupon.percent_off != null ? `p${coupon.percent_off}` : `a${coupon.amount_off_cents}`;
  const durKey = duration === "repeating" ? `rep${months}` : duration;
  const id = `dbc_${coupon.id.replace(/-/g, "").slice(0, 16)}_${kind}_${durKey}`;

  if (coupon.stripe_coupon_id === id) return id;

  // retrieve-or-create by the deterministic id (recreating a live id is a no-op)
  try {
    await stripe().coupons.retrieve(id);
  } catch {
    await stripe().coupons.create({
      id,
      ...(coupon.percent_off != null
        ? { percent_off: coupon.percent_off }
        : { amount_off: coupon.amount_off_cents!, currency: "usd" }),
      duration,
      ...(duration === "repeating" ? { duration_in_months: months } : {}),
      name: `${coupon.code} (editing)`,
    });
  }
  // cache for next time; best-effort, never fail the checkout over bookkeeping
  await supabaseAdmin().from("coupons").update({ stripe_coupon_id: id }).eq("id", coupon.id);
  return id;
}
