/*
 * The platform's own follow-ups, decided without HighLevel workflows
 * (owner decision, 14 September 2026): the brief reminder, the review
 * nudge and the retainer's quarterly check-in run from our morning sweep,
 * through the same timing rules as the custom-project chase, and go out
 * through HighLevel's thread like every other client email. Import-free,
 * so the rules are tested rather than trusted.
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Is the check-in date today or already behind us? Dates as YYYY-MM-DD. */
export function checkInDue(checkInOn: string | null | undefined, today: string): boolean {
  if (!checkInOn || !DAY.test(checkInOn) || !DAY.test(today)) return false;
  return checkInOn <= today;
}

/**
 * The next check-in, a quarter on, on the same day of the month where the
 * month has it (the 31st of a short month lands on its last day).
 */
export function nextCheckIn(checkInOn: string, months = 3): string {
  const [y, m, d] = checkInOn.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The ledger's own answer: sent already for this exact check-in date? */
export function checkInSent(ledger: { meta?: unknown }[], customerId: string, checkInOn: string): boolean {
  return ledger.some((r) => {
    const m = (r.meta ?? {}) as Record<string, unknown>;
    return m.customerId === customerId && m.checkInOn === checkInOn;
  });
}

const DAY_MS = 86_400_000;
export const REVIEW_AFTER_DAYS = 2;
export const REVIEW_AGAIN_AFTER_DAYS = 180;

/**
 * Ask for a review two days after the client's first finished job, once,
 * and again only after six months. A finished job is a delivered order or
 * a closed project; the earliest of them is the one that counts.
 */
export function reviewDue(firstDoneIso: string | null, lastAskedIso: string | null, nowIso: string): boolean {
  if (!firstDoneIso) return false;
  const now = Date.parse(nowIso);
  const done = Date.parse(firstDoneIso);
  if (!Number.isFinite(done) || now - done < REVIEW_AFTER_DAYS * DAY_MS) return false;
  if (lastAskedIso && now - Date.parse(lastAskedIso) < REVIEW_AGAIN_AFTER_DAYS * DAY_MS) return false;
  return true;
}

/** How far back the sweep looks. Anything that became due before this is a phone call, not a mail. */
export const CHASE_WINDOW_DAYS = 14;

/**
 * Did this become due recently enough for the sweep to act on it? The sweep
 * started for real on 16 September 2026 with months of history behind it;
 * without a window its first morning would have chased every old thing at
 * once (audit, 15 September 2026).
 */
export function withinWindow(atIso: string | null | undefined, nowIso: string, days = CHASE_WINDOW_DAYS): boolean {
  if (!atIso) return false;
  const at = Date.parse(atIso);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(at) || !Number.isFinite(now)) return false;
  return now - at <= days * DAY_MS;
}

/**
 * Prior chases for one piece and station, read from the email log. A row
 * is either one nudge about one piece (deliverableId and station on the
 * row) or one email about several (an items list); both count.
 */
export function priorChases(
  ledger: { meta?: unknown; created_at?: unknown }[],
  deliverableId: string,
  station: string,
): { count: number; lastAtIso: string | null } {
  const mine = ledger
    .filter((r) => {
      const m = (r.meta ?? {}) as Record<string, unknown>;
      if (m.deliverableId === deliverableId && m.station === station) return true;
      const items = Array.isArray(m.items) ? (m.items as Record<string, unknown>[]) : [];
      return items.some((i) => i.deliverableId === deliverableId && i.station === station);
    })
    .map((r) => String(r.created_at))
    .sort();
  return { count: mine.length, lastAtIso: mine[mine.length - 1] ?? null };
}
