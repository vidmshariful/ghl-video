import { test } from "node:test";
import assert from "node:assert/strict";
import { isAmountMismatch } from "../../lib/checkout/money-rules";
import { invoiceOwedCents } from "../../lib/invoice-state";

test("a charge that differs from the order in amount or currency is a mismatch", () => {
  assert.equal(isAmountMismatch({ chargedCents: 49500, expectedCents: 49500, chargedCurrency: "usd", expectedCurrency: "USD" }), false);
  assert.equal(isAmountMismatch({ chargedCents: 49500, expectedCents: 49500, chargedCurrency: null, expectedCurrency: null }), false);
  assert.equal(isAmountMismatch({ chargedCents: 49400, expectedCents: 49500, chargedCurrency: "usd", expectedCurrency: "usd" }), true);
  assert.equal(isAmountMismatch({ chargedCents: 49500, expectedCents: 49500, chargedCurrency: "eur", expectedCurrency: "usd" }), true);
});

test("what is owed is the total less what was paid, and nothing once paid or void", () => {
  assert.equal(invoiceOwedCents({ status: "open", paid_at: null, total_cents: 44100, amount_paid_cents: 0 }), 44100);
  assert.equal(invoiceOwedCents({ status: "open", paid_at: null, total_cents: 44100, amount_paid_cents: 20000 }), 24100);
  assert.equal(invoiceOwedCents({ status: "open", paid_at: "2026-09-01T00:00:00.000Z", total_cents: 44100, amount_paid_cents: 44100 }), 0);
  assert.equal(invoiceOwedCents({ status: "void", paid_at: null, total_cents: 44100, amount_paid_cents: 0 }), 0);
});
