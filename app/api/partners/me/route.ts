import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/account/session";
import {
  activateIfInvited,
  pagesForRef,
  partnerByEmail,
  trackedLink,
  type PartnerRow,
} from "@/lib/partners";

export const runtime = "nodejs";

/*
 * The signed-in partner's own profile, pages, and tracked links. A valid
 * session is not enough on its own: the email must match a partners row.
 * The response's `status` drives the portal's gate screens:
 *   none    - signed in, but no partner account for this email
 *   applied - application received, under review
 *   paused  - account paused by the team
 *   active  - full portal (an 'invited' partner activates on first load)
 */

/* the pages a partner can build a tracked link for */
const LINK_TARGETS: { label: string; path: string }[] = [
  { label: "Homepage", path: "/" },
  { label: "Premade videos", path: "/premade/" },
  { label: "Video editing", path: "/editing/" },
  { label: "Custom video production", path: "/custom-video/" },
  { label: "Our work", path: "/work/" },
];

function shape(p: PartnerRow) {
  return {
    name: p.name,
    email: p.email,
    ref: p.ref,
    status: p.status,
    photoPath: p.photo_path,
    roleLine: p.role_line,
    tagline: p.tagline,
    bio: p.bio,
    couponCode: p.coupon_code,
    discountPercent: p.discount_percent,
    discountMonths: p.discount_months,
    fpRef: p.fp_ref,
  };
}

export async function GET(req: Request) {
  const email = await getSessionEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let partner = await partnerByEmail(email);
  // a rejected application reads as "no partner account", not a rejection
  if (!partner || partner.status === "rejected") {
    return NextResponse.json({ status: "none" });
  }
  if (partner.status === "applied") {
    return NextResponse.json({ status: "applied", partner: { name: partner.name } });
  }
  if (partner.status === "paused") {
    return NextResponse.json({ status: "paused", partner: { name: partner.name } });
  }
  partner = await activateIfInvited(partner);

  return NextResponse.json({
    status: "active",
    partner: shape(partner),
    pages: pagesForRef(partner.ref),
    primaryLink: trackedLink(partner),
    links: LINK_TARGETS.map((t) => ({ label: t.label, url: trackedLink(partner!, t.path) })),
  });
}

/* Partners may edit their own display fields (these feed their partner
 * page once pages go DB-driven): name, tagline, bio. Nothing else. */
export async function PATCH(req: Request) {
  const email = await getSessionEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const partner = await partnerByEmail(email);
  if (!partner || partner.status === "rejected" || partner.status === "applied") {
    return NextResponse.json({ error: "No partner account." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const s = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  const patch: Record<string, string> = {};
  if (typeof body.name === "string" && s(body.name, 120)) patch.name = s(body.name, 120);
  if (typeof body.tagline === "string") patch.tagline = s(body.tagline, 200);
  if (typeof body.bio === "string") patch.bio = s(body.bio, 1200);
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });

  const { supabaseAdmin } = await import("@/lib/checkout/supabase-admin");
  const { error } = await supabaseAdmin().from("partners").update(patch).eq("id", partner.id);
  if (error) return NextResponse.json({ error: "Could not save. Try again." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
