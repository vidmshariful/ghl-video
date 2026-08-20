/*
 * What an editing plan promises each month, and what is left of it.
 *
 * Import-free so the rules can be tested directly. They decide what a paying
 * client is told about their own plan, and the failure modes are opposite and
 * both bad: count too generously and the studio is committed to work it never
 * sold, count too meanly and a client is refused something they paid for.
 *
 * The decisions encoded here, all settled with Shariful:
 *
 *   - Slots reset every month. Nothing rolls over. A month starts fresh
 *     whether the client used everything or nothing.
 *   - Long form and short form are counted separately, because the plans
 *     promise them separately and one does not substitute for the other.
 *   - A request is NEVER refused. The client can ask for as much as they
 *     like; we work through them one at a time against the monthly plan.
 *     What over-asking earns is a plain warning and an offer to upgrade,
 *     not a closed door.
 *   - A cancelled or approved video still counts against its month. The work
 *     was done; deleting the count would let a month be spent twice.
 */

export type Form = "long" | "short";

export type Allowance = { longForm: number; shortForm: number };

export type SlotUse = {
  longUsed: number;
  shortUsed: number;
  longLeft: number;
  shortLeft: number;
  longAllowed: number;
  shortAllowed: number;
  /** asked for more than the month holds, in either form */
  overPlan: boolean;
};

/** A request, as far as counting is concerned. */
export type Countable = { form: Form | null; cancelledAt?: string | null };

/** Count what a month has already committed. Cancelled requests do not. */
export function slotsUsed(items: Countable[], allowance: Allowance): SlotUse {
  const live = items.filter((i) => !i.cancelledAt);
  const longUsed = live.filter((i) => i.form === "long").length;
  const shortUsed = live.filter((i) => i.form === "short").length;
  return {
    longUsed,
    shortUsed,
    longAllowed: allowance.longForm,
    shortAllowed: allowance.shortForm,
    /* never negative: a client who has over-asked is at zero left, not at
     * minus two, and "minus two remaining" is not a sentence */
    longLeft: Math.max(0, allowance.longForm - longUsed),
    shortLeft: Math.max(0, allowance.shortForm - shortUsed),
    overPlan: longUsed > allowance.longForm || shortUsed > allowance.shortForm,
  };
}

/**
 * What to tell somebody about to ask for one more.
 *
 * Returns null when the request sits inside the plan, and a sentence when it
 * does not. The sentence is shown BEFORE they submit and never blocks it:
 * they are told what the plan holds and offered the upgrade, then the request
 * goes through either way.
 */
export function overPlanWarning(
  use: SlotUse,
  form: Form,
  planName: string,
): string | null {
  const left = form === "long" ? use.longLeft : use.shortLeft;
  if (left > 0) return null;
  const allowed = form === "long" ? use.longAllowed : use.shortAllowed;
  const kind = form === "long" ? "long form" : "short form";
  const already = form === "long" ? use.longUsed : use.shortUsed;
  return (
    `Your ${planName} plan covers ${allowed} ${kind} ${allowed === 1 ? "video" : "videos"} a month, ` +
    `and you have ${already} this month. We will still take this one and work through your ` +
    `requests in order, but it will run into next month unless you move up a plan.`
  );
}

/** Plain words for the counter, e.g. "3 of 4 long form used". */
export function describeSlots(use: SlotUse): string {
  const bits: string[] = [];
  if (use.longAllowed) bits.push(`${use.longUsed} of ${use.longAllowed} long form`);
  if (use.shortAllowed) bits.push(`${use.shortUsed} of ${use.shortAllowed} short form`);
  return bits.length ? `${bits.join(", ")} used` : "No videos included in this plan";
}

/**
 * The billing month a date falls in, given when the plan renews.
 *
 * Cycles are anchored to the renewal date rather than to the calendar, so a
 * plan that renews on the 18th runs the 18th to the 18th. Counting by
 * calendar month would give a client who joined on the 28th four days of
 * their first month's videos.
 */
export function cycleWindow(periodEnd: Date): { start: Date; end: Date } {
  const start = new Date(periodEnd);
  start.setMonth(start.getMonth() - 1);
  return { start, end: periodEnd };
}

/*
 * When a video is promised, counted from the moment footage lands.
 *
 * The editing page publishes "2 to 3 business days per video", so that is
 * what this returns: three business days, which is the end of the window we
 * sell rather than the start of it. Promising the optimistic end of a range
 * is how a studio is late on a date it chose itself.
 *
 * Weekends are skipped because business days are what was advertised. Public
 * holidays are not, deliberately: the studio is not in one country and a
 * holiday table that goes stale is worse than a date somebody can adjust by
 * hand, which they can, on the card.
 */
export const TURNAROUND_BUSINESS_DAYS = 3;

export function promisedFrom(assetsLandedAt: Date, businessDays = TURNAROUND_BUSINESS_DAYS): Date {
  const d = new Date(assetsLandedAt);
  let left = businessDays;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) left--;
  }
  return d;
}

/*
 * The order the studio works in.
 *
 * Scale subscribers jump the line, which the editing page sells in as many
 * words, so it has to be true here and not just in the copy. After plan
 * comes the date the client asked for, then the order they arrived in.
 * Requests still waiting on footage sort last whatever plan they are on:
 * nobody can edit a video that is not there.
 */
export type Queued = {
  planPriority: number;
  assetsReadyAt: string | null;
  requestedDueAt: string | null;
  createdAt: string;
};

export function queueOrder(a: Queued, b: Queued): number {
  const waiting = (q: Queued) => (q.assetsReadyAt ? 0 : 1);
  if (waiting(a) !== waiting(b)) return waiting(a) - waiting(b);
  if (a.planPriority !== b.planPriority) return a.planPriority - b.planPriority;
  const due = (q: Queued) => (q.requestedDueAt ? Date.parse(q.requestedDueAt) : Infinity);
  if (due(a) !== due(b)) return due(a) - due(b);
  return Date.parse(a.createdAt) - Date.parse(b.createdAt);
}
