/*
 * HighLevel failures that callers need to inspect, in a file with no imports.
 *
 * Split out of highlevel.ts on purpose: that file is `server-only`, which
 * makes it unreachable from a plain test runner. The rule below sits on the
 * money path and was wrong for months, so it is exactly the kind of thing
 * that should be checked directly rather than by making a second real
 * purchase and watching what HighLevel says.
 */

/** A non-2xx from HighLevel, carrying the parsed body rather than just text. */
export class HighLevelError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "HighLevelError";
    this.status = status;
    this.body = body;
  }
}

/*
 * "Can not create duplicate opportunity for the contact."
 *
 * HighLevel allows one open opportunity per contact per pipeline, so the
 * SECOND order from any repeat customer is refused with a 400. That is a
 * normal thing for a returning client to do, and it was being treated as a
 * hard error: the sync threw, the webhook returned 500, Stripe re-delivered,
 * and it failed the same way on every retry, forever, for an order that was
 * already paid for. The reply carries meta.existingId, which is the
 * opportunity we would have wanted anyway, so adopting it is both correct and
 * what the studio expects to see: one opportunity per client, not one per
 * invoice.
 *
 * Returns the existing id when this is that case, and null for every other
 * failure, which must still be thrown.
 */
export function existingOpportunityId(err: unknown): string | null {
  if (!(err instanceof HighLevelError) || err.status !== 400) return null;
  const body = err.body as { code?: unknown; meta?: { existingId?: unknown } } | null;
  if (!body || typeof body !== "object") return null;
  if (body.code !== "OPPORTUNITY_NO_DUPLICATE") return null;
  const id = body.meta?.existingId;
  return typeof id === "string" && id ? id : null;
}
