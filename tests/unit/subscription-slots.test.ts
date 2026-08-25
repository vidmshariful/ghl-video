import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  creditsUsed,
  cycleWindow,
  describeCredits,
  overPlanWarning,
  promisedFrom,
  queueOrder,
} from "@/lib/subscription-slots";
import { creditCost, tierForMinutes } from "@/lib/editing-credits";

/*
 * Editing plan credits. Both failure directions are expensive: count too
 * generously and the studio owes work it never sold, count too meanly and a
 * client is refused something they already paid for.
 */

/* Growth, the plan Extendly is on */
const GROWTH = 20;
const v = (creditCost: number) => ({ creditCost });

describe("counting a month", () => {
  test("an empty month has the whole plan left", () => {
    const u = creditsUsed([], GROWTH);
    assert.equal(u.left, 20);
    assert.equal(u.spent, 0);
    assert.equal(u.overPlan, false);
  });

  test("credits are one pool, whatever shape the work was", () => {
    const u = creditsUsed([v(3), v(3), v(1)], GROWTH);
    assert.equal(u.spent, 7);
    assert.equal(u.planLeft, 13);
  });

  test("a full month is at zero, and is not over plan", () => {
    const u = creditsUsed([v(10), v(10)], GROWTH);
    assert.equal(u.planLeft, 0);
    assert.equal(u.overPlan, false, "exactly at the limit is still within it");
  });

  test("over-asking never reads as a negative remaining", () => {
    const u = creditsUsed([v(15), v(10)], GROWTH);
    assert.equal(u.spent, 25);
    assert.equal(u.planLeft, 0, "not minus five");
    assert.equal(u.overPlan, true);
  });

  test("a request with no cost recorded spends nothing", () => {
    const u = creditsUsed([{ creditCost: null }, v(3)], GROWTH);
    assert.equal(u.spent, 3);
  });

  test("bought credits sit on top of the monthly grant", () => {
    const u = creditsUsed([v(20)], GROWTH, 5);
    assert.equal(u.planLeft, 0);
    assert.equal(u.topupLeft, 5);
    assert.equal(u.left, 5, "the month is spent but the bought credits remain");
  });
});

describe("what somebody is told before they ask for one more", () => {
  test("inside the plan, nothing is said", () => {
    const u = creditsUsed([v(3)], GROWTH);
    assert.equal(overPlanWarning(u, 3, "Growth"), null);
  });

  test("at the limit, they are warned and offered both ways forward", () => {
    const u = creditsUsed([v(20)], GROWTH);
    const w = overPlanWarning(u, 3, "Growth");
    assert.ok(w, "there should be a warning");
    assert.match(w!, /no credits left this month/);
    assert.match(w!, /still take it/, "it must not read as a refusal");
    assert.match(w!, /top up your credits or move up a plan/);
  });

  test("a request that exactly fits the remainder is not warned about", () => {
    const u = creditsUsed([v(18)], GROWTH);
    assert.equal(overPlanWarning(u, 2, "Growth"), null);
  });

  test("bought credits stop the warning", () => {
    const u = creditsUsed([v(20)], GROWTH, 5);
    assert.equal(overPlanWarning(u, 3, "Growth"), null);
  });

  test("the warning says how far over it is", () => {
    const u = creditsUsed([v(18)], GROWTH);
    assert.match(overPlanWarning(u, 5, "Growth")!, /it is 3 over/);
  });
});

describe("the counter in words", () => {
  test("says what the month has spent", () => {
    assert.equal(describeCredits(creditsUsed([v(3), v(1)], GROWTH)), "4 of 20 credits used");
  });

  test("bought credits are named separately, because they do not reset", () => {
    assert.equal(
      describeCredits(creditsUsed([v(3)], GROWTH, 6)),
      "3 of 20 credits used, plus 6 bought",
    );
  });

  test("a plan with no credits says so rather than showing zeros", () => {
    assert.equal(describeCredits(creditsUsed([], 0)), "No credits on this plan");
  });
});

describe("what a piece of work costs", () => {
  test("the three video tiers are flat", () => {
    assert.equal(creditCost("short"), 1);
    assert.equal(creditCost("mid"), 2);
    assert.equal(creditCost("long"), 3);
  });

  test("a video tier ignores runtime, because the tier already names its ceiling", () => {
    assert.equal(creditCost("mid", 1), 2);
    assert.equal(creditCost("mid", 5), 2);
  });

  test("a podcast is priced on finished runtime, in half hour blocks", () => {
    assert.equal(creditCost("podcast_standard", 30), 3);
    assert.equal(creditCost("podcast_standard", 60), 5, "the published hourly rate");
    assert.equal(creditCost("podcast_standard", 90), 8);
    assert.equal(creditCost("podcast_standard", 120), 10);
  });

  test("the advanced rate is the published one too", () => {
    assert.equal(creditCost("podcast_advanced", 30), 4);
    assert.equal(creditCost("podcast_advanced", 60), 8);
    assert.equal(creditCost("podcast_advanced", 120), 16);
  });

  test("a part block rounds up, so 61 minutes costs more than 60", () => {
    assert.equal(creditCost("podcast_standard", 61), 8);
  });

  test("the price never goes backwards as the episode gets longer", () => {
    let prev = 0;
    for (let m = 1; m <= 240; m += 1) {
      const c = creditCost("podcast_standard", m);
      assert.ok(c >= prev, `${m} minutes cost less than ${m - 1}`);
      prev = c;
    }
  });

  test("an unknown shape costs nothing rather than guessing", () => {
    assert.equal(creditCost("nonsense"), 0);
  });

  test("a length suggests the tier it belongs in", () => {
    assert.equal(tierForMinutes(1), "short");
    assert.equal(tierForMinutes(1.5), "short");
    assert.equal(tierForMinutes(5), "mid", "the five minute video that started all this");
    assert.equal(tierForMinutes(12), "long");
  });
});

describe("which month a plan is in", () => {
  test("the window runs renewal to renewal, not calendar month", () => {
    const { start, end } = cycleWindow(new Date("2026-09-18T18:33:20Z"));
    assert.equal(start.toISOString().slice(0, 10), "2026-08-18");
    assert.equal(end.toISOString().slice(0, 10), "2026-09-18");
  });

  test("a month end renewal does not roll forward into its own month", () => {
    /* setMonth(-1) on 31 March lands on 3 March, because 31 February does not
     * exist. That gave every plan renewing on a 29th, 30th or 31st a 28 day
     * window starting three days late. */
    const { start } = cycleWindow(new Date("2026-03-31T12:00:00Z"));
    assert.equal(start.toISOString().slice(0, 10), "2026-02-28");
  });

  test("a 31st clamps to the 30th where the previous month has one", () => {
    const { start } = cycleWindow(new Date("2026-05-31T12:00:00Z"));
    assert.equal(start.toISOString().slice(0, 10), "2026-04-30");
  });
});

/* ---- the rules Shariful settled after the first build ---- */

test("a cancelled request hands its credits back", () => {
  const use = creditsUsed(
    [{ creditCost: 3 }, { creditCost: 3, cancelledAt: "2026-08-20T00:00:00Z" }, { creditCost: 1 }],
    GROWTH,
  );
  assert.equal(use.spent, 4);
  assert.equal(use.planLeft, 16);
});

test("an approved video keeps its credits", () => {
  const use = creditsUsed([{ creditCost: 3, cancelledAt: null }], GROWTH);
  assert.equal(use.spent, 3);
});

test("short cuts off a long form each spend a credit of their own", () => {
  /* one long form request carrying three cuts: the cuts are rows of their
     own, so the month sees 3 + 1 + 1 + 1 */
  const use = creditsUsed([v(3), v(1), v(1), v(1)], GROWTH);
  assert.equal(use.spent, 6);
  assert.equal(use.planLeft, 14);
  assert.equal(use.overPlan, false);
});

test("the plans are the old ones priced through the same table", () => {
  /* nobody loses anything in the move to credits: 2 long + 4 short was 10,
     4 + 8 was 20, 8 + 16 was 40 */
  assert.equal(2 * creditCost("long") + 4 * creditCost("short"), 10);
  assert.equal(4 * creditCost("long") + 8 * creditCost("short"), 20);
  assert.equal(8 * creditCost("long") + 16 * creditCost("short"), 40);
});

test("the promise is three business days and skips the weekend", () => {
  /* Thursday 2026-08-20 plus three business days is Tuesday the 25th */
  const out = promisedFrom(new Date("2026-08-20T10:00:00Z"));
  assert.equal(out.toISOString().slice(0, 10), "2026-08-25");
});

test("footage landing on a Friday is promised on Wednesday", () => {
  const out = promisedFrom(new Date("2026-08-21T10:00:00Z"));
  assert.equal(out.toISOString().slice(0, 10), "2026-08-26");
});

test("waiting on footage sorts behind everything, whatever the plan", () => {
  const scaleWaiting = {
    planPriority: 0,
    assetsReadyAt: null,
    requestedDueAt: null,
    createdAt: "2026-08-01T00:00:00Z",
  };
  const starterReady = {
    planPriority: 2,
    assetsReadyAt: "2026-08-19T00:00:00Z",
    requestedDueAt: null,
    createdAt: "2026-08-19T00:00:00Z",
  };
  assert.ok(queueOrder(scaleWaiting, starterReady) > 0);
});

test("Scale jumps the line once the footage is in", () => {
  const scale = {
    planPriority: 0,
    assetsReadyAt: "2026-08-19T00:00:00Z",
    requestedDueAt: null,
    createdAt: "2026-08-19T00:00:00Z",
  };
  const starter = {
    planPriority: 2,
    assetsReadyAt: "2026-08-10T00:00:00Z",
    requestedDueAt: null,
    createdAt: "2026-08-10T00:00:00Z",
  };
  assert.ok(queueOrder(scale, starter) < 0);
});
