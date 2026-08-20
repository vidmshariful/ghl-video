import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  cycleWindow,
  describeSlots,
  overPlanWarning,
  slotsUsed,
  type Allowance,
} from "@/lib/subscription-slots";

/*
 * Editing plan slots. Both failure directions are expensive: count too
 * generously and the studio owes work it never sold, count too meanly and a
 * client is refused something they already paid for.
 */

/* Growth, the plan Extendly is on */
const GROWTH: Allowance = { longForm: 4, shortForm: 8 };
const v = (form: "long" | "short" | null) => ({ form });

describe("counting a month", () => {
  test("an empty month has the whole plan left", () => {
    const u = slotsUsed([], GROWTH);
    assert.equal(u.longLeft, 4);
    assert.equal(u.shortLeft, 8);
    assert.equal(u.overPlan, false);
  });

  test("long and short are counted separately, never substituted", () => {
    const u = slotsUsed([v("long"), v("long"), v("short")], GROWTH);
    assert.equal(u.longUsed, 2);
    assert.equal(u.shortUsed, 1);
    assert.equal(u.longLeft, 2);
    assert.equal(u.shortLeft, 7);
  });

  test("a full month is at zero, and is not over plan", () => {
    const u = slotsUsed([...Array(4)].map(() => v("long")), GROWTH);
    assert.equal(u.longLeft, 0);
    assert.equal(u.overPlan, false, "exactly at the limit is still within it");
  });

  test("over-asking never reads as a negative remaining", () => {
    const u = slotsUsed([...Array(6)].map(() => v("long")), GROWTH);
    assert.equal(u.longUsed, 6);
    assert.equal(u.longLeft, 0, "not minus two");
    assert.equal(u.overPlan, true);
  });

  test("a video with no form recorded counts against neither", () => {
    const u = slotsUsed([v(null), v("long")], GROWTH);
    assert.equal(u.longUsed, 1);
    assert.equal(u.shortUsed, 0);
  });
});

describe("what somebody is told before they ask for one more", () => {
  test("inside the plan, nothing is said", () => {
    const u = slotsUsed([v("long")], GROWTH);
    assert.equal(overPlanWarning(u, "long", "Growth"), null);
    assert.equal(overPlanWarning(u, "short", "Growth"), null);
  });

  test("at the limit, they are warned and offered the upgrade", () => {
    const u = slotsUsed([...Array(4)].map(() => v("long")), GROWTH);
    const w = overPlanWarning(u, "long", "Growth");
    assert.ok(w, "there should be a warning");
    assert.match(w!, /4 long form videos a month/);
    assert.match(w!, /still take this one/, "it must not read as a refusal");
    assert.match(w!, /move up a plan/);
  });

  test("running out of one form does not warn about the other", () => {
    const u = slotsUsed([...Array(4)].map(() => v("long")), GROWTH);
    assert.equal(overPlanWarning(u, "short", "Growth"), null);
  });

  test("the warning names the plan the client is actually on", () => {
    const starter: Allowance = { longForm: 2, shortForm: 4 };
    const u = slotsUsed([v("long"), v("long")], starter);
    assert.match(overPlanWarning(u, "long", "Starter")!, /Starter plan covers 2 long form videos/);
  });

  test("one video reads as video, not videos", () => {
    const u = slotsUsed([v("long")], { longForm: 1, shortForm: 0 });
    assert.match(overPlanWarning(u, "long", "Solo")!, /1 long form video a month/);
  });
});

describe("the counter in words", () => {
  test("says both halves when the plan has both", () => {
    assert.equal(
      describeSlots(slotsUsed([v("long"), v("short")], GROWTH)),
      "1 of 4 long form, 1 of 8 short form used",
    );
  });

  test("a plan with no videos says so rather than showing zeros", () => {
    assert.equal(
      describeSlots(slotsUsed([], { longForm: 0, shortForm: 0 })),
      "No videos included in this plan",
    );
  });
});

describe("which month a plan is in", () => {
  test("the window runs renewal to renewal, not calendar month", () => {
    const { start, end } = cycleWindow(new Date("2026-09-18T18:33:20Z"));
    assert.equal(start.toISOString().slice(0, 10), "2026-08-18");
    assert.equal(end.toISOString().slice(0, 10), "2026-09-18");
  });

  test("it survives a month end without landing on the wrong day", () => {
    const { start } = cycleWindow(new Date("2026-03-31T12:00:00Z"));
    /* February has no 31st; the point is it stays inside February or the
     * first days of March rather than jumping a whole month */
    assert.ok(start < new Date("2026-03-31T12:00:00Z"));
    assert.ok(start > new Date("2026-02-01T00:00:00Z"));
  });
});
