/*
 * A date with no time on it, read in the reader's own day.
 *
 * Postgres `date` columns (an invoice's due date, a quote's valid-until, a
 * decision's day) arrive as "2026-09-15". Handed to `new Date()` that is
 * UTC midnight, which is the evening of the 14th for anyone in the Americas,
 * so every date-only value printed a day early for a US reader. Building the
 * date from its three parts makes it local midnight instead. A full
 * timestamp already carries its own zone and passes straight through.
 */
export function dayOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Sep 15" by default; pass Intl options (year, weekday) to say more. */
export function formatDayOnly(
  value: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = {},
): string {
  const d = dayOnly(value);
  return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...opts }) : "";
}
