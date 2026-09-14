/*
 * One money formatter for every screen.
 *
 * Whole dollars stay clean ($495) and a fractional amount keeps BOTH cents
 * digits, so a partner-discounted $445.50 never renders as the typo-looking
 * "$445.5". The admin had this rule in app/admin/client.ts; the portal had
 * five formatters of its own with no maximum, which is how "$445.5" reached
 * a client's screen. Money is integer cents everywhere in this codebase.
 */
export function money(cents: number, currency = "USD"): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}
