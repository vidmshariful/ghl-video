/*
 * The five pips on a client's order page, worked out from what is true
 * rather than from the order's stored stage alone.
 *
 * The second pip used to be "Intake", a stage the stored value could only
 * reach when somebody picked it by hand in admin, which nobody did: the
 * tracker jumped from Paid to In production on every real order. The brief
 * is a fact the order carries, so the pip reads that fact (Premade review,
 * 16 September 2026).
 */

export const ORDER_PIPS = [
  { key: "paid", label: "Paid" },
  { key: "brief", label: "Brief" },
  { key: "production", label: "In production" },
  { key: "review", label: "Review" },
  { key: "delivered", label: "Delivered" },
] as const;

export type OrderPipKey = (typeof ORDER_PIPS)[number]["key"];

/** Which pips are done, given the stored stage and whether the brief is in. */
export function orderProgress(stage: string, briefIn: boolean): { done: OrderPipKey[]; current: OrderPipKey } {
  const past = (s: string) => ["production", "review", "delivered"].includes(s);
  const done: OrderPipKey[] = ["paid"];
  if (briefIn) done.push("brief");
  if (past(stage)) done.push("production");
  if (stage === "review" || stage === "delivered") done.push("review");
  if (stage === "delivered") done.push("delivered");
  const current = ORDER_PIPS.find((p) => !done.includes(p.key))?.key ?? "delivered";
  return { done, current };
}
