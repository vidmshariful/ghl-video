import { NextResponse } from "next/server";
import { requireActivePartner } from "@/lib/partners";
import { fpConfigured, getPayouts, resolvePromoter } from "@/lib/firstpromoter";

export const runtime = "nodejs";

/* Earnings: current balance from the promoter record plus the payout
 * history, both straight from FirstPromoter (which stays the system that
 * actually pays). */
export async function GET(req: Request) {
  const gate = await requireActivePartner(req);
  if ("failStatus" in gate)
    return NextResponse.json({ error: "Unauthorized" }, { status: gate.failStatus });
  if (!fpConfigured()) return NextResponse.json({ configured: false });

  try {
    const promoter = await resolvePromoter(gate.partner);
    if (!promoter) return NextResponse.json({ configured: true, found: false });

    const rows = await getPayouts(promoter.id);
    const paidCents = rows
      .filter((p) => p.status === "completed")
      .reduce((sum, p) => sum + (p.amount ?? 0), 0);
    const payouts = rows
      .slice()
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
      .slice(0, 50)
      .map((p) => ({
        id: p.id,
        status: p.status ?? "unknown",
        amountCents: p.amount ?? 0,
        periodStart: p.period_start ?? null,
        periodEnd: p.period_end ?? null,
        paidAt: p.paid_at ?? null,
        createdAt: p.created_at ?? null,
        method: p.payout_method?.method ?? null,
      }));
    return NextResponse.json({
      configured: true,
      found: true,
      balanceCents: promoter.balances?.current_balance?.cash ?? 0,
      lifetimePaidCents: paidCents,
      revenueCents: promoter.stats?.revenue_amount ?? 0,
      payouts,
    });
  } catch {
    return NextResponse.json({ configured: true, found: false, unavailable: true });
  }
}
