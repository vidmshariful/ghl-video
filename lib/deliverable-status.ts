/*
 * The five states a video moves through, and their human labels.
 *
 * Deliberately its own file with no imports. Admin, the customer portal and
 * the server all need this vocabulary, and the two portals are client
 * components: importing it from lib/deliverables.ts would pull the whole
 * catalog and bundle content into their browser bundles just to render a
 * word. One source of truth, no payload.
 */
export type DeliverableStatus =
  | "queued"
  | "in_production"
  | "ready"
  | "revisions"
  | "approved";

export const DELIVERABLE_STATUSES: DeliverableStatus[] = [
  "queued",
  "in_production",
  "ready",
  "revisions",
  "approved",
];

/* Shariful's words for the board, and words a client reads without needing a
 * translation. Never phrase these differently in one surface. */
export const STATUS_LABEL: Record<DeliverableStatus, string> = {
  queued: "Queued",
  in_production: "In production",
  ready: "Ready to review",
  revisions: "Revisions requested",
  approved: "Approved",
};

/** True once the client can actually watch it. */
export function isWatchable(status: DeliverableStatus): boolean {
  return status === "ready" || status === "revisions" || status === "approved";
}
