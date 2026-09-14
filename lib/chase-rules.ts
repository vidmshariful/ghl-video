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
