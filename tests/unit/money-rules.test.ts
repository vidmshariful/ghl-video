import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  couponProblem,
  discountFor,
  isAmountMismatch,
  isPlausibleCouponCode,
  minimumChargeProblem,
  orderTotalCents,
  type CouponTerms,
} from "@/lib/checkout/money-rules";

/*
 * The money path, where being wrong costs real money.
 *
 * These test the rules the live code runs, not a copy of them: coupons.ts,
 * settle.ts and the finalize route all call the same functions. A test that
 * re-implements the thing it is testing proves only that it can add up.
 *
 * The cases are chosen to be the ones somebody would actually hit or attempt,
 * not for coverage: the second before a coupon opens, the last redemption,
 * a fixed discount larger than the product, a tampered amount.
 *
 *   npm test
 */

const coupon = (over: Partial<CouponTerms> = {}): CouponTerms => ({
  active: true,
  percent_off: null,
  amount_off_cents: null,
  sku: null,
  valid_from: null,
  valid_until: null,
  max_redemptions: null,
  redemption_count: 0,
  ...over,
});

const NOW = Date.parse("2026-08-17T12:00:00Z");

describe("which coupons may be used", () => {
  test("a plain active coupon is fine", () => {
    assert.equal(couponProblem(coupon(), "exp-004", NOW), null);
  });

  test("a code nobody has heard of is refused", () => {
    assert.equal(couponProblem(null, "exp-004", NOW), "That code is not valid.");
  });

  test("switching a coupon off in admin takes effect", () => {
    assert.equal(
      couponProblem(coupon({ active: false }), "exp-004", NOW),
      "That code is not valid.",
    );
  });

  test("a campaign that has not opened yet says so", () => {
    const c = coupon({ valid_from: "2026-09-01T00:00:00Z" });
    assert.equal(couponProblem(c, "exp-004", NOW), "That code is not active yet.");
  });

  test("it opens exactly on its start, not a moment after", () => {
    const opensAt = "2026-09-01T00:00:00Z";
    const c = coupon({ valid_from: opensAt });
    assert.equal(couponProblem(c, "exp-004", Date.parse(opensAt) - 1), "That code is not active yet.");
    assert.equal(couponProblem(c, "exp-004", Date.parse(opensAt)), null);
  });

  test("an expired code says expired, rather than just invalid", () => {
    const c = coupon({ valid_until: "2026-08-01T00:00:00Z" });
    assert.equal(couponProblem(c, "exp-004", NOW), "That code has expired.");
  });

  test("the last second of a sale still works", () => {
    const endsAt = "2026-09-01T00:00:00Z";
    const c = coupon({ valid_until: endsAt });
    assert.equal(couponProblem(c, "exp-004", Date.parse(endsAt)), null);
    assert.equal(couponProblem(c, "exp-004", Date.parse(endsAt) + 1), "That code has expired.");
  });

  test("a code tied to one product will not work on another", () => {
    const c = coupon({ sku: "pack-001" });
    assert.equal(
      couponProblem(c, "exp-004", NOW),
      "That code does not apply to this product.",
    );
    assert.equal(couponProblem(c, "pack-001", NOW), null);
  });

  test("no sku means it works on everything", () => {
    assert.equal(couponProblem(coupon({ sku: null }), "anything", NOW), null);
  });

  test("a capped code stops at its cap, and the last one still gets in", () => {
    const nearly = coupon({ max_redemptions: 50, redemption_count: 49 });
    assert.equal(couponProblem(nearly, "exp-004", NOW), null);
    const full = coupon({ max_redemptions: 50, redemption_count: 50 });
    assert.equal(couponProblem(full, "exp-004", NOW), "That code has been fully redeemed.");
  });

  test("an uncapped code is never fully redeemed", () => {
    const c = coupon({ max_redemptions: null, redemption_count: 9999 });
    assert.equal(couponProblem(c, "exp-004", NOW), null);
  });

  test("a code too short to be real never reaches the database", () => {
    assert.equal(isPlausibleCouponCode("AB"), false);
    assert.equal(isPlausibleCouponCode("ABC"), true);
  });
});

describe("what a coupon takes off", () => {
  test("a percentage comes off the base price", () => {
    assert.equal(discountFor(coupon({ percent_off: 30 }), 49500), 14850);
  });

  test("an awkward percentage rounds to the nearest cent", () => {
    // 33% of $97 is 3201.0 exactly; 15% of $97.01 is not
    assert.equal(discountFor(coupon({ percent_off: 33 }), 9700), 3201);
    assert.equal(discountFor(coupon({ percent_off: 15 }), 9701), 1455);
  });

  test("a fixed amount comes off as given", () => {
    assert.equal(discountFor(coupon({ amount_off_cents: 5000 }), 49500), 5000);
  });

  test("$50 off a $30 product is $30 off, never a refund", () => {
    // the one that would hand money back if it were subtraction
    assert.equal(discountFor(coupon({ amount_off_cents: 5000 }), 3000), 3000);
  });

  test("100% off is free, and not less than free", () => {
    assert.equal(discountFor(coupon({ percent_off: 100 }), 49500), 49500);
  });
});

describe("what an order costs", () => {
  test("base plus bumps", () => {
    assert.equal(
      orderTotalCents({ basePriceCents: 49500, bumpsCents: 9700, discountCents: 0 }),
      59200,
    );
  });

  test("the discount comes off the base, and leaves the bumps alone", () => {
    // 30% of the $495 base is $148.50. The $97 bump is NOT discounted, so the
    // total is 495 - 148.50 + 97 = 443.50. Discounting the bump too would make
    // it 414.40, which is the mistake this guards.
    const discountCents = discountFor(coupon({ percent_off: 30 }), 49500);
    assert.equal(
      orderTotalCents({ basePriceCents: 49500, bumpsCents: 9700, discountCents }),
      44350,
    );
  });

  test("a fully discounted product still charges for its bumps", () => {
    const discountCents = discountFor(coupon({ percent_off: 100 }), 49500);
    assert.equal(
      orderTotalCents({ basePriceCents: 49500, bumpsCents: 9700, discountCents }),
      9700,
    );
  });
});

describe("catching a charge that does not match the order", () => {
  const base = {
    chargedCents: 49500,
    expectedCents: 49500,
    chargedCurrency: "usd",
    expectedCurrency: "USD",
  };

  test("the ordinary case is not flagged", () => {
    assert.equal(isAmountMismatch(base), false);
  });

  test("currency case alone is not a mismatch", () => {
    // Stripe returns lowercase, our rows do not always. Comparing raw strings
    // would flag every single order and train everybody to ignore the alarm.
    assert.equal(isAmountMismatch({ ...base, chargedCurrency: "USD", expectedCurrency: "usd" }), false);
  });

  test("paying less than the order says is caught", () => {
    assert.equal(isAmountMismatch({ ...base, chargedCents: 100 }), true);
  });

  test("paying more than the order says is caught too", () => {
    // not just underpayment: an overcharge is our bug and the customer's money
    assert.equal(isAmountMismatch({ ...base, chargedCents: 99000 }), true);
  });

  test("one cent out is still out", () => {
    assert.equal(isAmountMismatch({ ...base, chargedCents: 49499 }), true);
  });

  test("the right number in the wrong currency is caught", () => {
    assert.equal(isAmountMismatch({ ...base, chargedCurrency: "inr" }), true);
  });

  test("missing currency on either side is treated as usd, not as a mismatch", () => {
    assert.equal(
      isAmountMismatch({ ...base, chargedCurrency: null, expectedCurrency: null }),
      false,
    );
    assert.equal(isAmountMismatch({ ...base, expectedCurrency: null }), false);
  });
});

/*
 * $96 off a $97 product worked; $97 off did not, with a generic error. The
 * floor is Stripe's 50 cent minimum, judged on the resulting total.
 */
describe("minimumChargeProblem", () => {
  test("$96 off $97 leaves a dollar and passes", () => {
    assert.equal(minimumChargeProblem(9700, 9600), null);
  });
  test("$97 off $97 leaves nothing and is refused with a reason", () => {
    const why = minimumChargeProblem(9700, 9700);
    assert.ok(why && /\$0\.50/.test(why));
  });
  test("exactly 50 cents left is allowed, 49 is not", () => {
    assert.equal(minimumChargeProblem(9700, 9650), null);
    assert.ok(minimumChargeProblem(9700, 9651));
  });
  test("a 90% code on the cheapest product still passes", () => {
    assert.equal(minimumChargeProblem(9700, discountFor({ percent_off: 90 } as CouponTerms, 9700)), null);
  });
});
