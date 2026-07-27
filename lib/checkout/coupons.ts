import "server-only";
import { supabaseAdmin } from "./supabase-admin";

/*
 * Coupon validation and discount math, the only place either happens.
 * Both the validate endpoint (display) and /finalize (the charge) call
 * this, so what the buyer sees and what the card is charged can never
 * disagree. The discount applies to the BASE product price only, never
 * to order bumps: bumps are already discounted offers.
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
};

export type CouponCheck =
  | { ok: true; code: string; label: string; discountFor: (baseCents: number) => number }
  | { ok: false; reason: string };

export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase().slice(0, 32);
}

export async function checkCoupon(
  rawCode: string,
  sku: string,
): Promise<CouponCheck> {
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

  const label =
    c.percent_off != null
      ? `${c.percent_off}% off`
      : `$${(c.amount_off_cents! / 100).toLocaleString("en-US")} off`;
  const discountFor = (baseCents: number) =>
    c.percent_off != null
      ? Math.round((baseCents * c.percent_off) / 100)
      : Math.min(c.amount_off_cents!, baseCents);

  return { ok: true, code: c.code, label, discountFor };
}
