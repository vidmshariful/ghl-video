import { test } from "node:test";
import assert from "node:assert/strict";
import {
  gettingStartedSteps,
  onboardingUnfinished,
  type OnboardingInput,
} from "@/lib/onboarding";

/*
 * The getting started list, checked against the states a real account can be
 * in. The rule worth guarding hardest is that only one step ever asks for
 * anything: it is the difference between a path and a pile of chores, and it
 * is the kind of thing a later edit breaks without anybody noticing.
 */

const fresh: OnboardingInput = {
  brandReady: false,
  needsBrief: 1,
  readyToWatch: 0,
  approvedAny: false,
};

const state = (i: OnboardingInput) =>
  Object.fromEntries(gettingStartedSteps(i).map((s) => [s.key, s.state]));

test("a brand new client is asked for their brand, and nothing else", () => {
  assert.deepEqual(state(fresh), { brand: "now", brief: "later", approve: "ours" });
});

test("with the brand in, the brief becomes the live step", () => {
  assert.deepEqual(state({ ...fresh, brandReady: true }), {
    brand: "done",
    brief: "now",
    approve: "ours",
  });
});

test("a video waiting to be watched is the live step once the rest is done", () => {
  assert.deepEqual(
    state({ brandReady: true, needsBrief: 0, readyToWatch: 2, approvedAny: false }),
    { brand: "done", brief: "done", approve: "now" },
  );
});

test("approving one video finishes the list", () => {
  const steps = gettingStartedSteps({
    brandReady: true,
    needsBrief: 0,
    readyToWatch: 0,
    approvedAny: true,
  });
  assert.equal(onboardingUnfinished(steps), false);
  assert.ok(steps.every((s) => s.state === "done"));
});

test("never more than one step asks for something", () => {
  /* every combination, because this is the rule most likely to rot */
  for (const brandReady of [true, false]) {
    for (const needsBrief of [0, 3]) {
      for (const readyToWatch of [0, 2]) {
        for (const approvedAny of [true, false]) {
          const steps = gettingStartedSteps({ brandReady, needsBrief, readyToWatch, approvedAny });
          const live = steps.filter((s) => s.state === "now").length;
          assert.ok(
            live <= 1,
            `${live} live steps for ${JSON.stringify({ brandReady, needsBrief, readyToWatch, approvedAny })}`,
          );
        }
      }
    }
  }
});

test("a video we have not made yet is ours, never an unfinishable checkbox", () => {
  const steps = gettingStartedSteps({ ...fresh, brandReady: true, needsBrief: 0 });
  const approve = steps.find((s) => s.key === "approve")!;
  assert.equal(approve.state, "ours");
  assert.match(approve.hint, /on us/);
});

test("the list stays unfinished while anything is outstanding", () => {
  assert.equal(onboardingUnfinished(gettingStartedSteps(fresh)), true);
  assert.equal(
    onboardingUnfinished(
      gettingStartedSteps({ brandReady: true, needsBrief: 0, readyToWatch: 1, approvedAny: false }),
    ),
    true,
  );
});
