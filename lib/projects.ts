/*
 * Custom video work: the stages a job moves through, and what each means.
 *
 * Import-free so admin, the portal and the tests all read the same vocabulary.
 * The client sees a different word for some of these than the studio does,
 * which is deliberate: "scoped" is our word for agreed and not started, and a
 * client reads that as us not having begun. Both columns live here so the two
 * can never drift into saying different things about the same job.
 */

export type ProjectStatus =
  | "backlog"
  | "planning"
  | "in_progress"
  | "review"
  | "revision"
  | "approved"
  | "cutdowns"
  | "closed"
  | "cancelled";

export const PROJECT_STATUSES: ProjectStatus[] = [
  "backlog",
  "planning",
  "in_progress",
  "review",
  "revision",
  "approved",
  "cutdowns",
  "closed",
  "cancelled",
];

/**
 * The list's categories, in the order work actually moves (owner decision,
 * 21 August 2026, replacing the four-column board with the studio's own
 * vocabulary). Cutdowns is the stage after the main video is approved where
 * the extra formats get made: the reels, the shorts, the square crops.
 */
export const PROJECT_LIST: ProjectStatus[] = [
  "backlog",
  "planning",
  "in_progress",
  "review",
  "revision",
  "approved",
  "cutdowns",
];

export const STUDIO_LABEL: Record<string, string> = {
  backlog: "Backlog",
  planning: "Planning",
  in_progress: "In progress",
  review: "Review",
  revision: "Revision",
  approved: "Approved",
  cutdowns: "Cutdowns",
  closed: "Closed",
  cancelled: "Cancelled",
  /* the pre-rename vocabulary, kept so a screen deployed ahead of the
     database migration still reads */
  scoped: "Backlog",
  in_production: "In progress",
  delivered: "Approved",
};

/** What the client is told. Never our internal word for it. */
export const CLIENT_LABEL: Record<string, string> = {
  backlog: "Booked in",
  planning: "Being planned",
  in_progress: "In progress",
  review: "Ready for you",
  revision: "Changes in hand",
  approved: "Approved",
  cutdowns: "Extra formats in the works",
  closed: "Complete",
  cancelled: "Cancelled",
  scoped: "Booked in",
  in_production: "In progress",
  delivered: "Approved",
};

/** Old stored values read as their new names until the data migrates. */
export function normalizeProjectStatus(raw: string): ProjectStatus {
  if (raw === "scoped") return "backlog";
  if (raw === "in_production") return "in_progress";
  if (raw === "delivered") return "approved";
  return (PROJECT_STATUSES as string[]).includes(raw) ? (raw as ProjectStatus) : "backlog";
}

/** A finished job stops appearing on the list. */
export function isOpen(status: ProjectStatus | string): boolean {
  return status !== "closed" && status !== "cancelled";
}

export type RequestStatus = "new" | "contacted" | "quoted" | "won" | "lost";

export const REQUEST_STATUSES: RequestStatus[] = ["new", "contacted", "quoted", "won", "lost"];

export const REQUEST_LABEL: Record<RequestStatus, string> = {
  new: "New",
  contacted: "Contacted",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
};

/**
 * What a job is worth so far.
 *
 * `agreed` is the number to trust once it exists: a quote is what we asked
 * for and the agreed price is what was actually settled on. Falling back to
 * the quote before agreement means a pipeline still adds up rather than
 * showing zeros for everything not yet signed.
 */
export function projectValueCents(p: {
  quotedCents: number | null;
  agreedCents: number | null;
}): number {
  return p.agreedCents ?? p.quotedCents ?? 0;
}

/** Paid against a job, and what is still outstanding on it. */
export function projectBalance(
  p: { quotedCents: number | null; agreedCents: number | null },
  invoices: { totalCents: number; paid: boolean }[],
): { valueCents: number; paidCents: number; outstandingCents: number; invoicedCents: number } {
  const valueCents = projectValueCents(p);
  const paidCents = invoices.filter((i) => i.paid).reduce((s, i) => s + i.totalCents, 0);
  const invoicedCents = invoices.reduce((s, i) => s + i.totalCents, 0);
  return {
    valueCents,
    paidCents,
    invoicedCents,
    /* against the agreed price, not against what we happen to have invoiced:
     * a job half invoiced still owes the other half */
    outstandingCents: Math.max(0, valueCents - paidCents),
  };
}
