import { NextResponse } from "next/server";
import { assetFileUrl, assetsForPartner, requireActivePartner, trackedLink } from "@/lib/partners";

export const runtime = "nodejs";

/*
 * The signed-in partner's promo library: global assets plus any scoped to
 * them. Swipe copy comes back ready to paste, with {{LINK}} already
 * replaced by their tracked homepage link; files come back as public URLs.
 */
export async function GET(req: Request) {
  const gate = await requireActivePartner(req);
  if ("failStatus" in gate)
    return NextResponse.json({ error: "Unauthorized" }, { status: gate.failStatus });
  const partner = gate.partner;

  const link = trackedLink(partner);
  const rows = await assetsForPartner(partner.id);
  const assets = rows.map((a) => ({
    id: a.id,
    kind: a.kind,
    title: a.title,
    description: a.description,
    fileUrl: assetFileUrl(a.file_path),
    body: a.body ? a.body.replaceAll("{{LINK}}", link) : null,
    yours: a.partner_id != null,
  }));
  return NextResponse.json({ assets });
}
