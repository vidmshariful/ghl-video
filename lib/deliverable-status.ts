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

/**
 * How many rounds of changes a video includes.
 *
 * One, by owner's decision. The client is told this before they ask, so they
 * gather all their notes first instead of sending three separate requests and
 * being surprised later. Anything beyond it is a conversation, not a button.
 */
export const REVISIONS_INCLUDED = 1;

/** Can the client still ask for changes, or have they used their round? */
export function canRequestChanges(status: DeliverableStatus, roundsUsed: number): boolean {
  if (status === "approved") return false;
  return roundsUsed < REVISIONS_INCLUDED;
}

/**
 * Is the review screen open to the client at all?
 *
 * Closed once they approve. An approved video is finished, and re-opening it
 * from their side would make "approved" mean nothing. If they need something
 * after that, they message the studio and we re-open it from admin.
 */
export function canReview(status: DeliverableStatus): boolean {
  return status === "ready" || status === "revisions";
}
