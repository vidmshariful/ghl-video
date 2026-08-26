import { NextResponse } from "next/server";
import { requireActivePartner } from "@/lib/partners";
import {
  affixoConfigured,
  getCommissions,
  getPayouts,
  getReport,
  resolveAffiliate,
  toCents,
} from "@/lib/affixo";

export const runtime = "nodejs";

/* Earnings: what they are owed, what they have been paid, and the payout
 * history, all from Affixo, which stays the system that actually pays.
 *
 * The balance is derived from the approved commission rows rather than
 * taken from the report's earned total, because earned counts commissions
 * that were later reversed and a partner should never see a number that
 * includes money clawed back on a refund. */
export async function GET(req: Request) {
  const gate = await requireActivePartner(req, "earnings");
  if ("failStatus" in gate)
    return NextResponse.json({ error: "Unauthorized" }, { status: gate.failStatus });
  if (!affixoConfigured()) return NextResponse.json({ configured: false });

  try {
    const affiliate = await resolveAffiliate(gate.partner);
    if (!affiliate) return NextResponse.json({ configured: true, found: false });

    const [rows, commissions, report] = await Promise.all([
      getPayouts(affiliate.id),
      getCommissions(affiliate.id),
      getReport(affiliate.id),
    ]);

    const paidCents = toCents(report?.commissions_paid);
    const approvedCents = commissions
      .filter((c) => c.status === "approved")
      .reduce((sum, c) => sum + toCents(c.amount), 0);
    const balanceCents = Math.max(0, approvedCents - paidCents);

    const payouts = rows
      .slice()
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
      .slice(0, 50)
      .map((p) => ({
        id: p.id,
        status: p.status ?? "unknown",
        amountCents: toCents(p.amount),
        /* Affixo pays out a set of commissions, not a date range */
        periodStart: null,
        periodEnd: null,
        paidAt: p.paid_at ?? null,
        createdAt: p.created_at ?? null,
        method: p.method ?? null,
      }));

    return NextResponse.json({
      configured: true,
      found: true,
      balanceCents,
      lifetimePaidCents: paidCents,
      revenueCents: toCents(report?.revenue),
      payouts,
    });
  } catch {
    return NextResponse.json({ configured: true, found: false, unavailable: true });
  }
}
