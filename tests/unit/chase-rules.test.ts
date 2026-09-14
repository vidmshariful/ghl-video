import { test } from "node:test";
import assert from "node:assert/strict";
import { checkInDue, checkInSent, nextCheckIn, reviewDue } from "../../lib/chase-rules";

test("a check-in is due on its day and after it, never before", () => {
  assert.equal(checkInDue("2026-12-01", "2026-11-30"), false);
  assert.equal(checkInDue("2026-12-01", "2026-12-01"), true);
  assert.equal(checkInDue("2026-12-01", "2026-12-14"), true);
  assert.equal(checkInDue(null, "2026-12-01"), false);
  assert.equal(checkInDue("soon", "2026-12-01"), false);
});

test("the next check-in is a quarter on, on the same day where the month has it", () => {
  assert.equal(nextCheckIn("2026-12-01"), "2027-03-01");
  assert.equal(nextCheckIn("2026-09-14"), "2026-12-14");
  assert.equal(nextCheckIn("2026-11-30"), "2027-02-28");
  assert.equal(nextCheckIn("2026-08-31"), "2026-11-30");
  assert.equal(nextCheckIn("2026-01-15", 12), "2027-01-15");
});

test("the ledger says whether this exact check-in already went", () => {
  const ledger = [{ meta: { customerId: "c1", checkInOn: "2026-12-01" } }, { meta: {} }];
  assert.equal(checkInSent(ledger, "c1", "2026-12-01"), true);
  assert.equal(checkInSent(ledger, "c1", "2027-03-01"), false);
  assert.equal(checkInSent(ledger, "c2", "2026-12-01"), false);
});

test("the review ask waits two days, goes once, and returns after six months", () => {
  const now = "2026-09-14T09:00:00Z";
  assert.equal(reviewDue("2026-09-13T09:00:00Z", null, now), false, "one day is too soon");
  assert.equal(reviewDue("2026-09-11T09:00:00Z", null, now), true);
  assert.equal(reviewDue("2026-09-11T09:00:00Z", "2026-09-01T09:00:00Z", now), false, "asked two weeks ago");
  assert.equal(reviewDue("2026-01-11T09:00:00Z", "2026-02-01T09:00:00Z", now), true, "asked seven months ago");
  assert.equal(reviewDue(null, null, now), false);
});
