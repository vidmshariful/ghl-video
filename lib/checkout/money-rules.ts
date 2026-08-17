/*
 * The rules that decide money, with nothing else in the room.
 *
 * Every function here is pure: no database, no Stripe, no `server-only`, no
 * clock of its own. That is the point rather than a style preference. These
 * few decisions are the ones where being wrong costs real money, and they
 * used to be inline expressions inside functions that could not run outside
 * a request, which meant they could not be tested at all.
 *
 * `now` is passed in for the same reason: a rule that reads the clock itself
 * cannot be asked what it does the second before a coupon expires.
 *
 * The callers (coupons.ts, settle.ts, the finalize route) fetch the rows and
 * then ask this file what to do about them. Behaviour is unchanged from when
 * these lived inline; they were lifted, not rewritten.
 */

/** Only the fields the rules actually read. */
export type CouponTerms = {
  active: boolean;
  percent_off: number | null;
  amount_off_cents: number | null;
  sku: string | null;
  valid_from: string | null;
  valid_until: string | null;
  max_redemptions: number | null;
  redemption_count: number;
};

/** Long enough to be worth a database lookup. */
export const isPlausibleCouponCode = (code: string) => code.length >= 3;

/**
 * Why this coupon cannot be used, or null if it can.
 *
 * Returns the sentence shown to the buyer, so the order of these checks is
 * the order of usefulness: a buyer whose code expired should be told that,
 * not the first thing that happens to be false.
 */
export function couponProblem(
  c: CouponTerms | null,
  sku: string,
  now: number,
): string | null {
  if (!c || !c.active) return "That code is not valid.";
  if (c.valid_from && now < Date.parse(c.valid_from)) {
    return "That code is not active yet.";
  }
  if (c.valid_until && now > Date.parse(c.valid_until)) {
    return "That code has expired.";
  }
  /* A null sku means the coupon applies to everything. */
  if (c.sku && c.sku !== sku) {
    return "That code does not apply to this product.";
  }
  if (c.max_redemptions != null && c.redemption_count >= c.max_redemptions) {
    return "That code has been fully redeemed.";
  }
  return null;
}

/**
 * What this coupon takes off a base price, in cents.
 *
 * A fixed-amount coupon is capped at the price: $50 off a $30 product is $30
 * off, never a $20 refund. Percentages round to the nearest cent.
 */
export function discountFor(c: CouponTerms, baseCents: number): number {
  if (c.percent_off != null) return Math.round((baseCents * c.percent_off) / 100);
  return Math.min(c.amount_off_cents ?? 0, baseCents);
}

/**
 * What an order costs. The one place the total is worked out.
 *
 * The discount applies to the base price only, never to the bumps, which is
 * why it cannot simply be subtracted from the sum: a percentage coupon large
 * enough would otherwise start discounting the add-ons too.
 */
export function orderTotalCents(parts: {
  basePriceCents: number;
  bumpsCents: number;
  discountCents: number;
}): number {
  return parts.basePriceCents + parts.bumpsCents - parts.discountCents;
}

/**
 * Does what Stripe charged disagree with what the order says?
 *
 * This is the check that catches a tampered price. The server re-derives the
 * total and stamps it on the payment intent before the order row is written,
 * so agreement is the normal state and disagreement means either a bug in the
 * pricing path or somebody having a go at it.
 *
 * Currency is compared case-insensitively because Stripe returns it lowercase
 * and our rows do not always store it that way. Comparing raw strings would
 * make every order look tampered with, which is the failure mode that trains
 * people to ignore the alarm.
 */
export function isAmountMismatch(a: {
  chargedCents: number;
  expectedCents: number;
  chargedCurrency: string | null;
  expectedCurrency: string | null;
}): boolean {
  if (a.chargedCents !== a.expectedCents) return true;
  const charged = (a.chargedCurrency ?? "usd").toLowerCase();
  const expected = (a.expectedCurrency ?? "usd").toLowerCase();
  return charged !== expected;
}
