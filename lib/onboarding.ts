/*
 * Getting started: which three steps a new client sees, and which one is live.
 *
 * Pure and import-free on purpose. The dashboard is a client component, so
 * anything it imports ships to the browser, and anything with an import chain
 * cannot be run from a plain test. Keeping the rules here means they can be
 * checked directly instead of by clicking through a portal with the right
 * shape of account in it, which is most of why this was worth extracting.
 *
 * The rules it encodes, which are the actual product decisions:
 *
 *   - Only ever one step is actionable. A list where three things are all
 *     "do this now" is a pile of chores, not a path.
 *   - The third step belongs to us, not to them. Nobody can approve a video we
 *     have not made yet, and showing an unfinishable checkbox is worse than
 *     showing no list.
 *   - When every step is done the list is finished, and the caller drops it.
 *     A checklist that survives completion is decoration.
 */

export type StepState = "done" | "now" | "later" | "ours";

export type StepKey = "brand" | "brief" | "approve";

export type OnboardingStep = {
  key: StepKey;
  title: string;
  hint: string;
  state: StepState;
};

export type OnboardingInput = {
  /** the brand kit has everything we cannot start without */
  brandReady: boolean;
  /** paid orders with no brief on them yet */
  needsBrief: number;
  /** videos sitting with them, ready to watch */
  readyToWatch: number;
  /** they have approved at least one video, ever */
  approvedAny: boolean;
};

export function gettingStartedSteps(input: OnboardingInput): OnboardingStep[] {
  const { brandReady, needsBrief, readyToWatch, approvedAny } = input;

  const steps: OnboardingStep[] = [
    {
      key: "brand",
      title: "Add your brand",
      hint: brandReady
        ? "We have your logo, colours and how your name is said."
        : "Your logo, colours and how your name is said. Every video uses it.",
      state: brandReady ? "done" : "now",
    },
    {
      key: "brief",
      title: "Send your brief",
      hint: needsBrief
        ? "Your order is paid and waiting. Nothing starts until this lands."
        : "Your orders are briefed and with us.",
      state: needsBrief ? "now" : "done",
    },
    {
      key: "approve",
      title: "Approve your first video",
      hint: approvedAny
        ? "Done. Every video after this works the same way."
        : readyToWatch
          ? "One is ready to watch now."
          : "This one is on us. It lands here the moment it is ready.",
      state: approvedAny ? "done" : readyToWatch ? "now" : "ours",
    },
  ];

  /* demote every live step after the first, so exactly one asks for anything */
  let seenLive = false;
  for (const s of steps) {
    if (s.state !== "now") continue;
    if (seenLive) s.state = "later";
    else seenLive = true;
  }
  return steps;
}

/** Is there anything left to get started with? False means drop the list. */
export function onboardingUnfinished(steps: OnboardingStep[]): boolean {
  return steps.some((s) => s.state !== "done");
}
