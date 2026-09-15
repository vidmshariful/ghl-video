import { test } from "node:test";
import assert from "node:assert/strict";
import { approvedOnBehalfLine, quietForApproval } from "@/lib/quiet-client";

const now = "2026-09-30T09:00:00.000Z";

test("no reminders yet, or only one, is never quiet enough", () => {
  assert.equal(quietForApproval({ count: 0, lastAtIso: null }, now), false);
  assert.equal(quietForApproval({ count: 1, lastAtIso: "2026-09-10T09:00:00.000Z" }, now), false);
});

test("two reminders and a week of silence is", () => {
  assert.equal(quietForApproval({ count: 2, lastAtIso: "2026-09-23T09:00:00.000Z" }, now), true);
  assert.equal(quietForApproval({ count: 2, lastAtIso: "2026-09-01T09:00:00.000Z" }, now), true);
});

test("two reminders but the week is not up yet is not", () => {
  assert.equal(quietForApproval({ count: 2, lastAtIso: "2026-09-24T09:00:00.000Z" }, now), false);
  assert.equal(quietForApproval({ count: 2, lastAtIso: "not a date" }, now), false);
});

test("the line the client reads names what was approved", () => {
  assert.match(approvedOnBehalfLine(["Content AI"]), /approved Content AI on your behalf/);
  assert.match(approvedOnBehalfLine(["A", "B", "C"]), /approved 3 videos \(A, B, C\) on your behalf/);
  assert.match(approvedOnBehalfLine(["A"]), /reopen it/);
});
