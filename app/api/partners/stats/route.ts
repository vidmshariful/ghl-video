import { NextResponse } from "next/server";
import { requireActivePartner } from "@/lib/partners";
import { fpConfigured, getDailySeries, resolvePromoter } from "@/lib/firstpromoter";

export const runtime = "nodejs";

/*
 * The signed-in partner's performance numbers, read from FirstPromoter.
 * Response states the portal renders:
 *   { configured: false }                 - env keys not set yet
 *   { configured: true, found: false }    - no FP promoter matches them
 *   { configured: true, found: true, ...} - stats + campaigns + 30d series
 * Never throws at the client: FP hiccups come back as found:false with
 * `unavailable` so the portal can say "try again shortly" honestly.
 */
export async function GET(req: Request) {
  const gate = await requireActivePartner(req, "performance");
  if ("failStatus" in gate)
    return NextResponse.json({ error: "Unauthorized" }, { status: gate.failStatus });
  if (!fpConfigured()) return NextResponse.json({ configured: false });

  try {
    const promoter = await resolvePromoter(gate.partner);
    if (!promoter) return NextResponse.json({ configured: true, found: false });

    const series = await getDailySeries(promoter, 30);
    // the money figure needs the earnings grant; performance alone gets
    // clicks and referrals but no balance
    const { memberCan } = await import("@/lib/team-features");
    const showBalance = gate.isOwner || memberCan(gate.features, "earnings");
    return NextResponse.json({
      configured: true,
      found: true,
      stats: {
        clicks: promoter.stats?.clicks_count ?? 0,
        referrals: promoter.stats?.referrals_count ?? 0,
        customers: promoter.stats?.customers_count ?? 0,
        activeCustomers: promoter.stats?.active_customers_count ?? 0,
        sales: promoter.stats?.sales_count ?? 0,
        revenueCents: promoter.stats?.revenue_amount ?? 0,
      },
      ...(showBalance
        ? { balanceCents: promoter.balances?.current_balance?.cash ?? 0 }
        : {}),
      joinedAt: promoter.joined_at ?? null,
      campaigns: (promoter.promoter_campaigns ?? []).map((c) => ({
        name: c.campaign?.name ?? "Campaign",
        state: c.state ?? "unknown",
        refLink: c.ref_link ?? null,
        coupon: c.coupon ?? null,
      })),
      series,
    });
  } catch {
    return NextResponse.json({ configured: true, found: false, unavailable: true });
  }
}
