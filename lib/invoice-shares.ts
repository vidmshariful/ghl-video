/*
 * Pure, and deliberately NOT server-only: the unit tests import it, and the
 * runner cannot resolve "server-only". lib/invoices.ts keeps that guard
 * because it parses request bodies; this file only does arithmetic.
 */
/*
 * Which jobs an invoice covers, and how much of it lands on each.
 *
 * project_ids is the full list. project_id is its first entry, kept so
 * readers that predate the list keep reading a job. The money screens were
 * exactly those readers: a $9,000 invoice for six videos sat on one project
 * and the other five showed unpaid to the client and to us, with the money
 * already in.
 *
 * The total splits evenly, remainder cents on the first job, so the shares
 * always sum to the invoice exactly. Even is the only split the data can
 * express: there is no per-job amount on an invoice. An uneven multi-job
 * invoice will therefore be right in total and approximate per job, which
 * is the honest limit of the model rather than a bug to paper over.
 */
export function invoiceProjectShares(inv: {
  project_id?: unknown;
  project_ids?: unknown;
  total_cents?: unknown;
}): { projectId: string; shareCents: number }[] {
  const listed = (Array.isArray(inv.project_ids) ? inv.project_ids : []).filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  const ids = listed.length ? listed : inv.project_id ? [String(inv.project_id)] : [];
  if (!ids.length) return [];
  const total = Math.max(0, Math.round(Number(inv.total_cents) || 0));
  const base = Math.floor(total / ids.length);
  const remainder = total - base * ids.length;
  return ids.map((projectId, i) => ({ projectId, shareCents: base + (i === 0 ? remainder : 0) }));
}
