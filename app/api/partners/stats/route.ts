import { NextResponse } from "next/server";
import { requireActivePartner } from "@/lib/partners";
import {
  affixoConfigured,
  getCommissions,
  getLinks,
  getReport,
  resolveAffiliate,
  toCents,
} from "@/lib/affixo";

export const runtime = "nodejs";

/*
 * The signed-in partner's performance numbers, read from Affixo.
 * Response states the portal renders:
 *   { configured: false }                 - AFFIXO_API_KEY not set yet
 *   { configured: true, found: false }    - no Affixo affiliate matches them
 *   { configured: true, found: true, ...} - stats, links, and the balance
 * Never throws at the client: an Affixo hiccup comes back as found:false
 * with `unavailable` so the portal can say "try again shortly" honestly.
 *
 * No `series` any more. FirstPromoter had a day-by-day report endpoint and
 * Affixo does not, and a chart drawn from whatever we could reconstruct
 * would be a chart a partner could not trust. Totals are honest; a made up
 * trend line is not.
 */
export async function GET(req: Request) {
  const gate = await requireActivePartner(req, "performance");
  if ("failStatus" in gate)
    return NextResponse.json({ error: "Unauthorized" }, { status: gate.failStatus });
  if (!affixoConfigured()) return NextResponse.json({ configured: false });

  try {
    const affiliate = await resolveAffiliate(gate.partner);
    if (!affiliate) return NextResponse.json({ configured: true, found: false });

    const [report, links] = await Promise.all([
      getReport(affiliate.id),
      getLinks(affiliate.id),
    ]);

    // the money figure needs the earnings grant; performance alone gets
    // clicks and referrals but no balance
    const { memberCan } = await import("@/lib/team-features");
    const showBalance = gate.isOwner || memberCan(gate.features, "earnings");

    let balanceCents = 0;
    if (showBalance) {
      /* what they are owed: approved and not yet paid. Derived from the
         commission rows rather than the report's earned total, because
         earned includes commissions that were later reversed. */
      const commissions = await getCommissions(affiliate.id);
      balanceCents = commissions
        .filter((c) => c.status === "approved")
        .reduce((sum, c) => sum + toCents(c.amount), 0);
      balanceCents -= toCents(report?.commissions_paid);
      if (balanceCents < 0) balanceCents = 0;
    }

    return NextResponse.json({
      configured: true,
      found: true,
      stats: {
        clicks: report?.clicks ?? 0,
        referrals: report?.conversions ?? 0,
        customers: report?.conversions ?? 0,
        activeCustomers: report?.conversions ?? 0,
        sales: report?.sales ?? 0,
        revenueCents: toCents(report?.revenue),
      },
      ...(showBalance ? { balanceCents } : {}),
      joinedAt: affiliate.created_at ?? null,
      campaigns: links.map(({ link, campaign }) => ({
        name: campaign?.name ?? "Campaign",
        state: campaign?.status ?? "active",
        refLink: link.destination_url,
        coupon: null,
      })),
      series: [],
    });
  } catch {
    return NextResponse.json({ configured: true, found: false, unavailable: true });
  }
}
