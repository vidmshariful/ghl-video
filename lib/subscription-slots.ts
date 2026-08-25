/*
 * What an editing plan grants each month, and what is left of it.
 *
 * Import-free so the rules can be tested directly. They decide what a paying
 * client is told about their own plan, and the failure modes are opposite and
 * both bad: count too generously and the studio is committed to work it never
 * sold, count too meanly and a client is refused something they paid for.
 *
 * The decisions encoded here, all settled with Shariful:
 *
 *   - Work is priced in CREDITS, by what it actually is, not by sorting it
 *     into two fixed video shapes. See lib/editing-credits.ts for why.
 *   - Plan credits reset every month and do NOT roll over. A month starts
 *     fresh whether the client used everything or nothing.
 *   - Top-up credits, bought separately, DO carry until they are used. They
 *     were paid for on their own and expiring them at a month boundary would
 *     be taking back something already sold.
 *   - A request is NEVER refused. The client can ask for as much as they
 *     like; we work through them one at a time against the monthly plan.
 *     What over-asking earns is a plain warning, an offer to top up and an
 *     offer to upgrade, not a closed door.
 *   - A cancelled request returns its credits. The work was not done, so
 *     charging for it would be charging for nothing.
 */

export type CreditUse = {
  /** credits committed this month */
  spent: number;
  /** what the plan granted this month */
  allowed: number;
  /** plan credits still unspent this month, never negative */
  planLeft: number;
  /** bought credits still unspent, net of every month's overflow */
  topupLeft: number;
  /** everything they can still spend right now */
  left: number;
  /** this month's spend went past what the plan granted */
  overPlan: boolean;
};

/** A request, as far as counting is concerned. */
export type Countable = { creditCost?: number | null; cancelledAt?: string | null };

/**
 * Count what a month has already committed.
 *
 * `topupLeft` arrives already net of every month's overflow, worked out
 * server-side where the grants and the closed cycles can both be read. Doing
 * that arithmetic here would mean this function needed the client's whole
 * history to answer a question about one month.
 */
export function creditsUsed(
  items: Countable[],
  allowed: number,
  topupLeft = 0,
): CreditUse {
  const spent = items
    .filter((i) => !i.cancelledAt)
    .reduce((sum, i) => sum + Math.max(0, Number(i.creditCost ?? 0)), 0);
  /* never negative: a client who has over-asked is at zero left, not at
   * minus two, and "minus two remaining" is not a sentence */
  const planLeft = Math.max(0, allowed - spent);
  const topup = Math.max(0, topupLeft);
  return {
    spent,
    allowed,
    planLeft,
    topupLeft: topup,
    left: planLeft + topup,
    overPlan: spent > allowed,
  };
}

/**
 * What to tell somebody about to spend more than they have.
 *
 * Returns null when the request fits, and a sentence when it does not. The
 * sentence is shown BEFORE they submit and never blocks it: they are told
 * what is left, offered the two ways forward, then the request goes through
 * either way.
 */
export function overPlanWarning(
  use: CreditUse,
  cost: number,
  planName: string,
): string | null {
  if (cost <= use.left) return null;
  const short = cost - use.left;
  const have =
    use.left === 0
      ? "no credits left this month"
      : `${use.left} ${use.left === 1 ? "credit" : "credits"} left this month`;
  return (
    `This one costs ${cost} ${cost === 1 ? "credit" : "credits"} and your ${planName} plan has ${have}, ` +
    `so it is ${short} over. We will still take it and work through your requests in order. ` +
    `To have it sooner, top up your credits or move up a plan.`
  );
}

/** Plain words for the counter, e.g. "6 of 20 credits used". */
export function describeCredits(use: CreditUse): string {
  if (!use.allowed && !use.topupLeft) return "No credits on this plan";
  const base = `${use.spent} of ${use.allowed} credits used`;
  return use.topupLeft > 0 ? `${base}, plus ${use.topupLeft} bought` : base;
}

/**
 * The billing month a date falls in, given when the plan renews.
 *
 * Cycles are anchored to the renewal date rather than to the calendar, so a
 * plan that renews on the 18th runs the 18th to the 18th. Counting by
 * calendar month would give a client who joined on the 28th four days of
 * their first month's videos.
 *
 * Built by subtracting a month from the END rather than by `setMonth`, which
 * overflows: setMonth(-1) on 31 March lands on 3 March, because 31 February
 * does not exist and the Date rolls forward. That put a 28 day window on
 * every plan renewing on a 29th, 30th or 31st, and told those clients their
 * month started three days late.
 */
export function cycleWindow(periodEnd: Date): { start: Date; end: Date } {
  const end = new Date(periodEnd);
  const y = end.getUTCFullYear();
  const m = end.getUTCMonth();
  const day = end.getUTCDate();
  /* the last day of the previous month, so a 31st clamps to the 28th, 29th
     or 30th rather than rolling into this month */
  const daysInPrev = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const start = new Date(end);
  start.setUTCFullYear(y, m - 1, Math.min(day, daysInPrev));
  return { start, end };
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
