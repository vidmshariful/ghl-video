import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQuoteInput, quoteOpen, quoteStatusWord, signatureOk } from "../../lib/quotes";
import { needsFreshAgreement, parseRetainer } from "../../lib/retainer";

test("a quote re-derives every figure from its lines", () => {
  const r = parseQuoteInput({
    customerEmail: "Chase@HighLevel.com",
    title: "G2 Momentum explainer",
    lineItems: [
      { description: "Ninety second explainer", unitCents: 250000, quantity: 1 },
      { description: "Square cut", unitCents: 15000, quantity: 2 },
      { description: "", unitCents: 999 },
    ],
    discountKind: "percent",
    discountValue: 10,
    validUntil: "2026-10-14",
    scope: "Script, voice, animation, two rounds.",
  });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.quote.customerEmail, "chase@highlevel.com");
  assert.equal(r.quote.lineItems.length, 2);
  assert.equal(r.quote.subtotalCents, 280000);
  assert.equal(r.quote.totalCents, 252000);
  assert.equal(r.quote.validUntil, "2026-10-14");
});

test("a quote needs an email, a title and a line", () => {
  assert.equal(parseQuoteInput({ title: "x", lineItems: [{ description: "a", unitCents: 100 }] }).ok, false);
  assert.equal(parseQuoteInput({ customerEmail: "a@b.co", lineItems: [{ description: "a", unitCents: 100 }] }).ok, false);
  assert.equal(parseQuoteInput({ customerEmail: "a@b.co", title: "x", lineItems: [] }).ok, false);
  const floor = parseQuoteInput({ customerEmail: "a@b.co", title: "x", lineItems: [{ description: "a", unitCents: 100 }], discountKind: "flat", discountValue: 90 });
  assert.equal(floor.ok, false);
});

test("a sent quote is open until its date, then expired", () => {
  assert.equal(quoteOpen({ status: "sent", valid_until: "2026-10-01" }, "2026-09-14"), true);
  assert.equal(quoteOpen({ status: "sent", valid_until: "2026-09-13" }, "2026-09-14"), false);
  assert.equal(quoteOpen({ status: "sent", valid_until: null }, "2026-09-14"), true);
  assert.equal(quoteOpen({ status: "accepted" }, "2026-09-14"), false);
  assert.equal(quoteStatusWord({ status: "sent", valid_until: "2026-09-13" }, "2026-09-14"), "expired");
  assert.equal(quoteStatusWord({ status: "draft" }), "draft");
});

test("a typed signature is a real name", () => {
  assert.equal(signatureOk("Chase Buckner"), true);
  assert.equal(signatureOk(" C "), false);
  assert.equal(signatureOk(42), false);
});

test("the agreement survives an edit that does not change the deal, and not one that does", () => {
  const signed = parseRetainer({ monthlyCents: 1100000, videosMin: 8, videosMax: 12, agreedOn: "2026-09-10T10:00:00Z", agreedBy: "Chase Buckner", checkInOn: "2026-12-01" });
  assert.ok(signed);
  assert.equal(signed!.agreedBy, "Chase Buckner");
  const moved = parseRetainer({ ...signed, checkInOn: "2027-01-01", note: "moved the check-in" });
  assert.equal(needsFreshAgreement(signed, moved!), false);
  const repriced = parseRetainer({ ...signed, monthlyCents: 1200000 });
  assert.equal(needsFreshAgreement(signed, repriced!), true);
  assert.equal(needsFreshAgreement(null, repriced!), true);
});
