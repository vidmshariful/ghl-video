import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  countLine,
  monthKey,
  monthLabel,
  monthSummary,
  parseRetainer,
  retainerMonths,
} from "@/lib/retainer";

/*
 * The retainer arithmetic, on the shape of HighLevel's real month: three
 * jobs briefed in September, one of them a small animation, two in
 * production, plus an August job that is not under the retainer at all.
 */
const HL = { monthlyCents: 1100000, videosMin: 8, videosMax: 12, startedOn: "2026-09-01" };

describe("parseRetainer", () => {
  test("no fee means no retainer, whatever else is there", () => {
    assert.equal(parseRetainer(null), null);
    assert.equal(parseRetainer({}), null);
    assert.equal(parseRetainer({ monthlyCents: 0, videosMin: 8 }), null);
  });

  test("HighLevel's terms parse, with the defaults filled in", () => {
    const r = parseRetainer(HL);
    assert.ok(r);
    assert.equal(r.monthlyCents, 1100000);
    assert.equal(r.videosMin, 8);
    assert.equal(r.videosMax, 12);
    assert.equal(r.activeMax, 2);
    assert.equal(r.turnaroundDays, 3);
    assert.equal(r.whiteLabel, true);
    assert.equal(r.startedOn, "2026-09-01");
    assert.equal(r.checkInOn, null);
    assert.equal(r.name, "Retainer partnership");
  });

  test("a maximum below the minimum is lifted to it, and bad dates are dropped", () => {
    const r = parseRetainer({ ...HL, videosMax: 3, checkInOn: "soon", startedOn: "2026-9-1" });
    assert.ok(r);
    assert.equal(r.videosMax, 8);
    assert.equal(r.checkInOn, null);
    assert.match(r.startedOn, /^\d{4}-\d{2}-01$/);
  });
});

describe("months", () => {
  test("the key is the UTC month and the label is the month's name", () => {
    assert.equal(monthKey(new Date("2026-09-12T03:00:00Z")), "2026-09");
    assert.equal(monthLabel("2026-09"), "September 2026");
    assert.equal(monthLabel("2027-01"), "January 2027");
  });

  test("history runs from the first month to now, newest first, across a year end", () => {
    assert.deepEqual(retainerMonths("2026-11-01", new Date("2027-01-15T00:00:00Z")), [
      "2027-01",
      "2026-12",
      "2026-11",
    ]);
    assert.deepEqual(retainerMonths("2026-09-01", new Date("2026-09-12T00:00:00Z")), ["2026-09"]);
  });
});

describe("monthSummary", () => {
  const jobs = [
    { retainerMonth: "2026-09", retainerKind: "video" as const, status: "review" },
    { retainerMonth: "2026-09", retainerKind: "video" as const, status: "planning" },
    { retainerMonth: "2026-09", retainerKind: "animation" as const, status: "backlog" },
    { retainerMonth: "2026-09", retainerKind: "video" as const, status: "cancelled" },
    { retainerMonth: null, retainerKind: null, status: "in_progress" },
    { retainerMonth: "2026-08", retainerKind: "video" as const, status: "in_progress" },
  ];

  test("September counts its videos, not its animation, not the cancelled one", () => {
    const s = monthSummary(jobs, "2026-09");
    assert.equal(s.counted, 2);
    assert.equal(s.inProduction, 2);
    assert.equal(s.delivered, 0);
    assert.equal(s.queued, 0);
    assert.equal(s.animations, 1);
  });

  test("active now spans months but ignores work outside the retainer", () => {
    assert.equal(monthSummary(jobs, "2026-09").activeNow, 3);
  });

  test("a month with nothing in it is all zeros", () => {
    const s = monthSummary(jobs, "2026-10");
    assert.deepEqual([s.counted, s.delivered, s.inProduction, s.animations], [0, 0, 0, 0]);
  });

  test("the count line reads as a sentence", () => {
    const r = parseRetainer(HL)!;
    assert.equal(
      countLine(monthSummary(jobs, "2026-09"), r),
      "2 videos briefed of 8 to 12, 1 small animation included.",
    );
    assert.equal(countLine(monthSummary(jobs, "2026-10"), r), "0 videos briefed of 8 to 12.");
  });
});
