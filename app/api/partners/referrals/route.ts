import { NextResponse } from "next/server";
import { requireActivePartner } from "@/lib/partners";
import { affixoConfigured, getConversions, resolveAffiliate } from "@/lib/affixo";

export const runtime = "nodejs";

/* Mask a referral's email before it leaves the server: the partner sees
 * enough to recognize a referral, never the full address. */
function mask(email: string | null | undefined): string {
  if (!email) return "hidden";
  const [user, domain] = email.split("@");
  if (!domain) return "hidden";
  const u = user.length <= 2 ? `${user[0] ?? ""}*` : `${user.slice(0, 2)}***`;
  const dot = domain.lastIndexOf(".");
  const d = dot > 1 ? `${domain[0]}***${domain.slice(dot)}` : `${domain[0]}***`;
  return `${u}@${d}`;
}

export async function GET(req: Request) {
  const gate = await requireActivePartner(req, "referrals");
  if ("failStatus" in gate)
    return NextResponse.json({ error: "Unauthorized" }, { status: gate.failStatus });
  if (!affixoConfigured()) return NextResponse.json({ configured: false });

  try {
    const affiliate = await resolveAffiliate(gate.partner);
    if (!affiliate) return NextResponse.json({ configured: true, found: false });

    const rows = await getConversions(affiliate.id);
    const referrals = rows
      .slice()
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
      .slice(0, 100)
      .map((r) => ({
        id: r.id,
        who: mask(r.email),
        state: r.status ?? "unknown",
        createdAt: r.created_at ?? null,
        /* Affixo records the sale, not a customer-since date. The portal
           treats null as "no date to show" rather than printing a guess. */
        customerSince: null,
      }));
    return NextResponse.json({ configured: true, found: true, referrals });
  } catch {
    return NextResponse.json({ configured: true, found: false, unavailable: true });
  }
}
