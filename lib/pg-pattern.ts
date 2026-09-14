/*
 * A value for PostgREST's `ilike` that means itself.
 *
 * `ilike` is used all over the platform for case-insensitive email matches,
 * and PostgREST does not escape the pattern: an underscore matches any one
 * character and a percent sign matches anything. A login named
 * `j_hn@x.com` therefore matched `john@x.com` in every ownership check
 * (found in the audit of 15 September 2026). Every `ilike` on a value that
 * came from a person goes through this, so it matches only that value.
 */
export function likeLiteral(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
