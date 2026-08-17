/*
 * When a video is promised, and whether it is late.
 *
 * Most "where is my video" messages are really "when is my video". Answering
 * that on the screen, before anyone has to ask, is the whole point.
 *
 * The clock starts when the BRIEF lands, not when the money does. We cannot
 * begin without the client's logo, colours and notes, so dating from payment
 * would promise a day we might have no way of hitting, through no fault of
 * ours or theirs. It also puts the incentive the right way round: a client
 * who wants their video sooner sends the brief sooner.
 *
 * Pure and clock-injected, like the money rules: `now` is passed in so the
 * behaviour on the due day itself can be asked about rather than guessed.
 */

/*
 * What we promise when a product does not say otherwise.
 *
 * The public copy says five to seven days, so seven is the number to date
 * from: promising the outside of a published window means the promise is kept
 * even on the slow end of it. Only the bundles carry their own turnaround
 * today; everything else lands here.
 */
export const DEFAULT_TURNAROUND_DAYS = 7;

/** Days from brief to delivery for a product, from its stored metadata. */
export function turnaroundDays(metadata: unknown): number {
  const m = (metadata ?? {}) as Record<string, unknown>;
  const raw = Number(m.delivery_days);
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : DEFAULT_TURNAROUND_DAYS;
}

/**
 * The moment a video is due, given when the brief landed.
 *
 * Calendar days rather than working days, deliberately: the public promise is
 * written in plain days, and a client counting on their fingers should reach
 * the same date we do. Quietly meaning something else would make every
 * delivery look a day or two late to them and on time to us.
 */
export function dueAtFrom(briefLandedIso: string, days: number): string {
  const d = new Date(briefLandedIso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

const DAY_MS = 86_400_000;

/** Whole days from now until due. Negative means it is late. */
export function daysUntil(dueIso: string, now: number): number {
  const due = Date.parse(dueIso);
  /* Compared date to date rather than instant to instant, so something due
   * "today" reads as today all day instead of flipping to late at lunchtime. */
  const dayOf = (t: number) => Math.floor(t / DAY_MS);
  return dayOf(due) - dayOf(now);
}

export type DueTone = "none" | "waiting" | "soon" | "today" | "late" | "done";

export type DueLabel = { text: string; tone: DueTone };

/**
 * How a due date reads on a screen.
 *
 * `audience` changes the wording but never the facts. A client sees the date
 * they were promised even when we have missed it: a video that says nothing
 * once it is late is the version that generates the message this feature
 * exists to prevent.
 */
export function describeDue(
  input: {
    dueAt: string | null;
    status: string;
    /** null until the client sends their brief */
    briefLandedAt: string | null;
  },
  now: number,
  audience: "client" | "studio" = "client",
): DueLabel {
  /*
   * The promise is kept the moment the video is handed over, so anything from
   * `ready` onwards has no date left to show.
   *
   * `ready` belongs here and it is the case that matters: it means the client
   * has the video and we are waiting on them to watch it. Counting the days
   * since against us would put "14 days late" on work that went out on time,
   * which is both untrue and the fastest way to teach the studio that the red
   * text means nothing. How long a client has been sitting on a video is a
   * real thing to chase, and the queue already tracks it separately.
   */
  if (input.status === "approved" || input.status === "delivered" || input.status === "ready") {
    return { text: "", tone: "done" };
  }

  if (!input.briefLandedAt) {
    return {
      text: audience === "client" ? "Starts when your brief arrives" : "Waiting on brief",
      tone: "waiting",
    };
  }

  if (!input.dueAt) return { text: "", tone: "none" };

  const days = daysUntil(input.dueAt, now);
  const on = formatDay(input.dueAt);

  if (days < 0) {
    const late = Math.abs(days);
    const howLate = `${late} day${late === 1 ? "" : "s"} late`;
    return {
      text: audience === "client" ? `Was expected ${on}` : howLate,
      tone: "late",
    };
  }
  if (days === 0) {
    return { text: audience === "client" ? "Expected today" : "Due today", tone: "today" };
  }
  if (days <= 2) {
    return {
      text: audience === "client" ? `Expected ${on}` : `Due ${on}, ${days} day${days === 1 ? "" : "s"} left`,
      tone: "soon",
    };
  }
  return { text: audience === "client" ? `Expected ${on}` : `Due ${on}`, tone: "soon" };
}

/** "24 Aug", the shortest form that is never ambiguous between date formats. */
export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
