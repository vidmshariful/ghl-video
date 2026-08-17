import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TURNAROUND_DAYS,
  daysUntil,
  describeDue,
  dueAtFrom,
  turnaroundDays,
} from "@/lib/delivery-dates";

/*
 * The promised date, and whether we have missed it.
 *
 * Worth testing carefully because every case here is a sentence a paying
 * client reads. Getting "1 days late" or a video that claims to be due
 * tomorrow when it was due last week is the kind of small wrongness that
 * costs more trust than the delay itself.
 */

const at = (s: string) => Date.parse(s);

describe("how long we have", () => {
  test("a product carrying its own turnaround uses it", () => {
    assert.equal(turnaroundDays({ delivery_days: 14 }), 14);
  });

  test("everything else gets the published window's outside edge", () => {
    // the public copy says five to seven days, so seven keeps the promise
    // even on the slow end rather than only on the fast one
    assert.equal(turnaroundDays({}), DEFAULT_TURNAROUND_DAYS);
    assert.equal(turnaroundDays(null), DEFAULT_TURNAROUND_DAYS);
    assert.equal(turnaroundDays({ kind: "video" }), DEFAULT_TURNAROUND_DAYS);
  });

  test("a nonsense turnaround falls back rather than promising nonsense", () => {
    // a zero would promise delivery the moment the brief lands
    for (const bad of [0, -3, "soon", null, NaN]) {
      assert.equal(turnaroundDays({ delivery_days: bad }), DEFAULT_TURNAROUND_DAYS, String(bad));
    }
  });
});

describe("the date we promise", () => {
  test("counts calendar days from the brief", () => {
    assert.equal(dueAtFrom("2026-08-17T10:00:00.000Z", 7), "2026-08-24T10:00:00.000Z");
  });

  test("crosses a month end without drama", () => {
    assert.equal(dueAtFrom("2026-08-28T00:00:00.000Z", 7), "2026-09-04T00:00:00.000Z");
  });

  test("and a leap day", () => {
    assert.equal(dueAtFrom("2028-02-26T00:00:00.000Z", 7), "2028-03-04T00:00:00.000Z");
  });
});

describe("late or not", () => {
  test("due tomorrow is one day away", () => {
    assert.equal(daysUntil("2026-08-18T09:00:00Z", at("2026-08-17T09:00:00Z")), 1);
  });

  test("something due today reads as today all day, not late by teatime", () => {
    // compared date to date on purpose: a video due this morning should not
    // flip to "late" at lunchtime while the studio is still working on it
    const due = "2026-08-17T09:00:00Z";
    assert.equal(daysUntil(due, at("2026-08-17T08:00:00Z")), 0);
    assert.equal(daysUntil(due, at("2026-08-17T23:30:00Z")), 0);
  });

  test("yesterday is one day late, not zero", () => {
    assert.equal(daysUntil("2026-08-16T09:00:00Z", at("2026-08-17T01:00:00Z")), -1);
  });
});

describe("what the client is told", () => {
  const now = at("2026-08-17T12:00:00Z");
  const base = { status: "queued", briefLandedAt: "2026-08-10T12:00:00Z" };

  test("before the brief arrives, the ball is visibly in their court", () => {
    const d = describeDue({ ...base, briefLandedAt: null, dueAt: null }, now);
    assert.equal(d.tone, "waiting");
    assert.match(d.text, /brief/i);
  });

  test("an upcoming video shows the date, not a countdown", () => {
    const d = describeDue({ ...base, dueAt: "2026-08-24T12:00:00Z" }, now);
    assert.equal(d.tone, "soon");
    assert.equal(d.text, "Expected 24 Aug");
  });

  test("due today says today", () => {
    const d = describeDue({ ...base, dueAt: "2026-08-17T18:00:00Z" }, now);
    assert.equal(d.tone, "today");
    assert.equal(d.text, "Expected today");
  });

  test("a late video admits it rather than going quiet", () => {
    // the alternative is a card that says nothing, which is exactly what
    // makes somebody open a chat window to ask
    const d = describeDue({ ...base, dueAt: "2026-08-14T12:00:00Z" }, now);
    assert.equal(d.tone, "late");
    assert.equal(d.text, "Was expected 14 Aug");
  });

  test("a finished video promises nothing further", () => {
    for (const status of ["approved", "delivered"]) {
      const d = describeDue({ ...base, status, dueAt: "2026-08-14T12:00:00Z" }, now);
      assert.equal(d.tone, "done");
      assert.equal(d.text, "");
    }
  });

  test("a video already handed over is not late, however long ago it went", () => {
    // found on real data: a video delivered on time and left unwatched for a
    // fortnight was being reported as fourteen days late, which blames us for
    // the client's inbox and teaches everyone to ignore the red
    const d = describeDue({ ...base, status: "ready", dueAt: "2026-08-03T12:00:00Z" }, now);
    assert.equal(d.tone, "done");
    assert.equal(d.text, "");
    assert.equal(describeDue({ ...base, status: "ready", dueAt: "2026-08-03T12:00:00Z" }, now, "studio").text, "");
  });
});

describe("what the studio is told", () => {
  const now = at("2026-08-17T12:00:00Z");
  const base = { status: "queued", briefLandedAt: "2026-08-10T12:00:00Z" };
  const studio = (dueAt: string) => describeDue({ ...base, dueAt }, now, "studio");

  test("lateness is counted, because that is the thing to act on", () => {
    assert.equal(studio("2026-08-14T12:00:00Z").text, "3 days late");
  });

  test("one day late reads as one day, not one days", () => {
    assert.equal(studio("2026-08-16T12:00:00Z").text, "1 day late");
  });

  test("the nearly due show how long is left", () => {
    assert.equal(studio("2026-08-18T12:00:00Z").text, "Due 18 Aug, 1 day left");
    assert.equal(studio("2026-08-19T12:00:00Z").text, "Due 19 Aug, 2 days left");
  });

  test("further out is just a date", () => {
    assert.equal(studio("2026-08-24T12:00:00Z").text, "Due 24 Aug");
  });

  test("the studio sees a missing brief as a blocker on us to chase", () => {
    const d = describeDue({ ...base, briefLandedAt: null, dueAt: null }, now, "studio");
    assert.equal(d.text, "Waiting on brief");
  });
});
