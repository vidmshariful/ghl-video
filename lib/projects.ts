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
  | "scoped"
  | "in_production"
  | "review"
  | "delivered"
  | "closed"
  | "cancelled";

export const PROJECT_STATUSES: ProjectStatus[] = [
  "scoped",
  "in_production",
  "review",
  "delivered",
  "closed",
  "cancelled",
];

/** The board's columns, in the order work actually moves. */
export const PROJECT_BOARD: ProjectStatus[] = [
  "scoped",
  "in_production",
  "review",
  "delivered",
];

export const STUDIO_LABEL: Record<ProjectStatus, string> = {
  scoped: "Scoped",
  in_production: "In production",
  review: "With client",
  delivered: "Delivered",
  closed: "Closed",
  cancelled: "Cancelled",
};

/** What the client is told. Never our internal word for it. */
export const CLIENT_LABEL: Record<ProjectStatus, string> = {
  scoped: "Booked in",
  in_production: "Being made",
  review: "Ready for you",
  delivered: "Delivered",
  closed: "Complete",
  cancelled: "Cancelled",
};

/** A finished job stops appearing on the board. */
export function isOpen(status: ProjectStatus): boolean {
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
