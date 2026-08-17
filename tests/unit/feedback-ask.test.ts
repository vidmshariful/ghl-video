import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  oldEnoughToAsk,
  pickAsk,
  stillBlocks,
  type ApprovedVideo,
  type PriorAnswer,
} from "@/lib/feedback-ask";

/*
 * The ask timing rules. Each wrong version of these is a way to annoy a
 * paying client: asked on approval day, asked twice, or never re-asked after
 * "too early" when re-asking was the whole point of that option.
 */

const NOW = new Date("2026-08-17T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const vid = (id: string, approvedDaysAgo: number): ApprovedVideo => ({
  deliverableId: id,
  title: `Video ${id}`,
  approvedAt: daysAgo(approvedDaysAgo),
});

describe("how long a video must be out before we ask", () => {
  test("approval day is far too soon", () => {
    assert.equal(oldEnoughToAsk(daysAgo(0), NOW), false);
  });
  test("thirteen days is still too soon, fourteen is fair game", () => {
    assert.equal(oldEnoughToAsk(daysAgo(13), NOW), false);
    assert.equal(oldEnoughToAsk(daysAgo(14), NOW), true);
  });
});

describe("what a prior answer does to the question", () => {
  test("a real answer closes it for good, and so does skipping", () => {
    for (const verdict of ["working", "not_really", "skipped"] as const) {
      const a: PriorAnswer = { deliverableId: "x", verdict, answeredAt: daysAgo(200) };
      assert.equal(stillBlocks(a, NOW), true, verdict);
    }
  });
  test("too early is a rain check: blocks for 30 days, then reopens", () => {
    const fresh: PriorAnswer = { deliverableId: "x", verdict: "too_early", answeredAt: daysAgo(29) };
    const stale: PriorAnswer = { deliverableId: "x", verdict: "too_early", answeredAt: daysAgo(30) };
    assert.equal(stillBlocks(fresh, NOW), true);
    assert.equal(stillBlocks(stale, NOW), false);
  });
});

describe("which video gets asked about", () => {
  test("the one approved longest ago wins", () => {
    const pick = pickAsk([vid("new", 20), vid("old", 90)], [], NOW);
    assert.equal(pick?.deliverableId, "old");
  });

  test("answered videos are passed over, not re-asked", () => {
    const answers: PriorAnswer[] = [
      { deliverableId: "old", verdict: "working", answeredAt: daysAgo(5) },
    ];
    const pick = pickAsk([vid("new", 20), vid("old", 90)], answers, NOW);
    assert.equal(pick?.deliverableId, "new");
  });

  test("a stale rain check makes its video askable again", () => {
    const answers: PriorAnswer[] = [
      { deliverableId: "old", verdict: "too_early", answeredAt: daysAgo(45) },
    ];
    const pick = pickAsk([vid("old", 90)], answers, NOW);
    assert.equal(pick?.deliverableId, "old");
  });

  test("nothing eligible means a quiet dashboard, not a forced question", () => {
    assert.equal(pickAsk([vid("a", 3)], [], NOW), null);
    assert.equal(pickAsk([], [], NOW), null);
  });
});
