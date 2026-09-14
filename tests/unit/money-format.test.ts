import { test } from "node:test";
import assert from "node:assert/strict";
import { money } from "../../lib/money-format";

test("whole dollars print clean, fractional amounts keep both cents digits", () => {
  assert.equal(money(44550), "$445.50");
  assert.equal(money(49500), "$495");
  assert.equal(money(0), "$0");
  assert.equal(money(1100000), "$11,000");
});

test("the currency code is accepted in either case, as the portal sends it", () => {
  assert.equal(money(49500, "usd"), "$495");
  assert.equal(money(44550, "USD"), "$445.50");
});
