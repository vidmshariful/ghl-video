/*
 * A client's handle: /admin/editing/extendly rather than a row of hex.
 *
 * Taken from the company name, then the person's name, then the part of the
 * email before the @, because every account has at least one of those. The
 * same rule as migration 0075's backfill, so a slug made here and a slug made
 * there agree. Client-safe, import-free, tested.
 */

const MAX = 60;

/** The stem a slug is built from, before any uniqueness suffix. */
export function slugStem(
  company: string | null | undefined,
  name: string | null | undefined,
  email: string,
): string {
  /* each candidate in turn, so a company made of punctuation falls through
     to the name rather than to nothing */
  for (const source of [company ?? "", name ?? "", email.split("@")[0] ?? ""]) {
    const stem = source
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, MAX)
      .replace(/-+$/g, "");
    if (stem) return stem;
  }
  return "client";
}

/** "extendly", then "extendly-2", "extendly-3": the first is the bare stem. */
export function slugWithSuffix(stem: string, n: number): string {
  return n <= 1 ? stem : `${stem}-${n}`;
}

/** The first handle not already taken, given every taken one that starts with the stem. */
export function freeSlug(stem: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  for (let n = 1; n < 10000; n += 1) {
    const candidate = slugWithSuffix(stem, n);
    if (!used.has(candidate)) return candidate;
  }
  return `${stem}-${Date.now()}`;
}
