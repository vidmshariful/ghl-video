import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  VISIT_GAP_MS,
  collapseVisits,
  isNewVisit,
  type ActivityEvent,
} from "@/lib/portal-activity";

/*
 * The portal activity log answers one question: has this client been in, and
 * when. It answered it badly. Supabase fires SIGNED_IN on every token refresh,
 * every new tab and every remount, and the log recorded each one, so Emma's
 * single eight minute visit to the HighLevel portal went in as sixteen sign
 * ins. The writer now skips the repeats; this covers the reader, which still
 * has to make sense of everything written before it did.
 */

const MIN = 60 * 1000;
let seq = 0;
/* a fixed base, because a test that reads the clock fails on its own schedule */
const BASE = Date.parse("2026-08-27T15:00:00.000Z");

function ev(email: string, kind: ActivityEvent["kind"], offsetMs: number): ActivityEvent {
  return { id: `e${seq++}`, email, kind, at: new Date(BASE + offsetMs).toISOString() };
}

/* the reader hands the screen newest first, so assertions read that way too */
function times(events: ActivityEvent[]): number[] {
  return events.map((e) => Date.parse(e.at) - BASE);
}

describe("one visit is one line", () => {
  test("a burst of sign ins collapses to the moment they arrived", () => {
    const burst = [0, 120, 900, 1100, 9_000].map((ms) => ev("emma@x.com", "signed_in", ms));
    const out = collapseVisits(burst);
    assert.equal(out.length, 1);
    assert.equal(times(out)[0], 0, "keeps the earliest, which is when she turned up");
  });

  test("Emma's real shape: sixteen rows across eight minutes is one visit", () => {
    /* the actual spacing from portal_activity on 27 August */
    const offsets = [
      0, 147, 770, 813, 9_545, 9_661, 9_957, 10_863, 156_000, 156_002,
      363_442, 364_018, 496_650, 496_788, 499_110, 499_695,
    ];
    const out = collapseVisits(offsets.map((ms) => ev("emma@x.com", "signed_in", ms)));
    assert.equal(out.length, 1, "sixteen rows, one arrival");
  });

  test("a gap longer than the visit window is a new visit", () => {
    const out = collapseVisits([
      ev("emma@x.com", "signed_in", 0),
      ev("emma@x.com", "signed_in", VISIT_GAP_MS + MIN),
    ]);
    assert.equal(out.length, 2);
    assert.deepEqual(times(out), [VISIT_GAP_MS + MIN, 0], "newest first");
  });

  test("a tab left open all day stays one visit, however often it refreshes", () => {
    /* each refresh is inside the window OF THE ONE BEFORE IT, never of the
       first: the run has to extend or an all day session splits into pieces */
    const all: ActivityEvent[] = [];
    for (let i = 0; i < 40; i++) all.push(ev("emma@x.com", "signed_in", i * 20 * MIN));
    assert.equal(collapseVisits(all).length, 1);
  });
});

describe("what must not be collapsed", () => {
  test("signing out ends the visit, so signing back in counts again", () => {
    const out = collapseVisits([
      ev("emma@x.com", "signed_in", 0),
      ev("emma@x.com", "signed_out", MIN),
      ev("emma@x.com", "signed_in", 2 * MIN),
    ]);
    assert.equal(out.length, 3, "in, out, in again");
    assert.deepEqual(
      out.map((e) => e.kind),
      ["signed_in", "signed_out", "signed_in"].reverse(),
    );
  });

  test("two people are never folded into one another", () => {
    const out = collapseVisits([
      ev("emma@x.com", "signed_in", 0),
      ev("chase@x.com", "signed_in", MIN),
      ev("emma@x.com", "signed_in", 2 * MIN),
    ]);
    assert.equal(out.length, 2, "one arrival each, and Emma's repeat dropped");
    assert.deepEqual(
      out.map((e) => e.email),
      ["chase@x.com", "emma@x.com"],
    );
  });

  test("every sign out survives, they are never repeats", () => {
    const out = collapseVisits([
      ev("emma@x.com", "signed_out", 0),
      ev("emma@x.com", "signed_out", MIN),
    ]);
    assert.equal(out.length, 2);
  });
});

describe("what the writer decides to record", () => {
  const at = (offsetMs: number) => new Date(BASE + offsetMs).toISOString();

  test("somebody never seen before is always an arrival", () => {
    assert.equal(isNewVisit(null, BASE), true);
  });

  test("the token refresh that caused all this is not an arrival", () => {
    /* Emma's second row landed 147ms after her first */
    assert.equal(isNewVisit({ kind: "signed_in", at: at(0) }, BASE + 147), false);
  });

  test("a second tab is not an arrival", () => {
    assert.equal(isNewVisit({ kind: "signed_in", at: at(0) }, BASE + 30 * 1000), false);
  });

  test("coming back after the visit window is an arrival", () => {
    assert.equal(isNewVisit({ kind: "signed_in", at: at(0) }, BASE + VISIT_GAP_MS), true);
  });

  test("signing in right after signing out is an arrival", () => {
    assert.equal(isNewVisit({ kind: "signed_out", at: at(0) }, BASE + 1000), true);
  });

  test("the writer and the reader agree on the same run", () => {
    /* whatever collapseVisits keeps, isNewVisit would have recorded */
    const offsets = [0, 147, 9_545, 156_000, 499_695];
    const events = offsets.map((ms) => ev("emma@x.com", "signed_in", ms));
    const kept = collapseVisits(events).length;

    let recorded = 0;
    let last: { kind: string; at: string } | null = null;
    for (const e of events) {
      if (isNewVisit(last, Date.parse(e.at))) recorded++;
      last = { kind: e.kind, at: e.at };
    }
    assert.equal(recorded, kept, "one definition of a visit, not two");
    assert.equal(recorded, 1);
  });
});

describe("the shape the screen relies on", () => {
  test("input order does not change the answer", () => {
    const rows = [
      ev("emma@x.com", "signed_in", 0),
      ev("emma@x.com", "signed_in", MIN),
      ev("emma@x.com", "signed_out", 2 * MIN),
    ];
    const forwards = collapseVisits(rows);
    const backwards = collapseVisits([...rows].reverse());
    assert.deepEqual(times(forwards), times(backwards));
  });

  test("comes back newest first, whatever went in", () => {
    const out = collapseVisits([
      ev("emma@x.com", "signed_in", 0),
      ev("chase@x.com", "signed_in", 5 * MIN),
    ]);
    assert.deepEqual(times(out), [5 * MIN, 0]);
  });

  test("nothing in, nothing out", () => {
    assert.deepEqual(collapseVisits([]), []);
  });

  test("the caller's array is left alone", () => {
    const rows = [ev("emma@x.com", "signed_in", MIN), ev("emma@x.com", "signed_in", 0)];
    const before = rows.map((e) => e.id);
    collapseVisits(rows);
    assert.deepEqual(
      rows.map((e) => e.id),
      before,
      "sorting in place would reorder the screen's own copy",
    );
  });
});
