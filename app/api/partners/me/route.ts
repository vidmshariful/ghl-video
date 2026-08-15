import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/account/session";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { profileByEmail, upsertProfile } from "@/lib/profiles";
import { membershipsForMember, resolvePortalContext } from "@/lib/account-team";
import { memberCan } from "@/lib/team-features";
import {
  activateIfInvited,
  pagesForRef,
  partnerByEmail,
  trackedLink,
  type PartnerRow,
} from "@/lib/partners";

export const runtime = "nodejs";

/*
 * The acting partner account's profile, pages, and tracked links, plus a
 * `viewer` block describing the signed-in person themselves (owner or team
 * member, their grants, and the accounts they can switch to). The response's
 * `status` drives the portal's gate screens:
 *   none    - signed in, no partner account AND no team membership chosen
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
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();

  const [profile, memberships] = await Promise.all([
    profileByEmail(db, user.email),
    membershipsForMember(db, "partner", user.email),
  ]);
  const membershipList = await Promise.all(
    memberships.map(async (m) => {
      const owner = await partnerByEmail(m.owner_email);
      return { ownerEmail: m.owner_email, ownerName: owner?.name ?? null, status: m.status };
    }),
  );

  const actFor = req.headers.get("x-act-for")?.trim().toLowerCase() || null;

  /* a team member working in an owner's partner account */
  if (actFor && actFor !== user.email) {
    const ctx = await resolvePortalContext(db, req, "partner");
    if ("failStatus" in ctx)
      return NextResponse.json({ error: "Unauthorized" }, { status: ctx.failStatus });
    const partner = await partnerByEmail(ctx.ownerEmail);
    if (!partner || !["active", "invited"].includes(partner.status)) {
      return NextResponse.json({ status: "none", memberships: membershipList });
    }
    return NextResponse.json({
      status: "active",
      partner: { ...shape(partner), avatarUrl: null },
      pages: pagesForRef(partner.ref),
      primaryLink: trackedLink(partner),
      links: LINK_TARGETS.map((t) => ({ label: t.label, url: trackedLink(partner, t.path) })),
      viewer: {
        name: profile.displayName,
        avatarUrl: profile.avatarUrl,
        isOwner: false,
        features: ctx.features,
        actingFor: { email: partner.email ?? ctx.ownerEmail, name: partner.name },
        memberships: membershipList,
      },
    });
  }

  /* the owner's own account */
  let partner = await partnerByEmail(user.email);
  if (!partner || partner.status === "rejected") {
    return NextResponse.json({ status: "none", memberships: membershipList });
  }
  if (partner.status === "applied") {
    return NextResponse.json({
      status: "applied",
      partner: { name: partner.name },
      memberships: membershipList,
    });
  }
  if (partner.status === "paused") {
    return NextResponse.json({
      status: "paused",
      partner: { name: partner.name },
      memberships: membershipList,
    });
  }
  partner = await activateIfInvited(partner);

  return NextResponse.json({
    status: "active",
    partner: { ...shape(partner), avatarUrl: profile.avatarUrl },
    pages: pagesForRef(partner.ref),
    primaryLink: trackedLink(partner),
    links: LINK_TARGETS.map((t) => ({ label: t.label, url: trackedLink(partner!, t.path) })),
    viewer: {
      name: profile.displayName ?? partner.name,
      avatarUrl: profile.avatarUrl,
      isOwner: true,
      features: null,
      actingFor: null,
      memberships: membershipList,
    },
  });
}

/* Display fields that feed the public partner page: the owner, or a team
 * member holding the `profile` grant. A member's own display name is never
 * touched by this; only the owner's edit syncs their profile name. */
export async function PATCH(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();

  const actFor = req.headers.get("x-act-for")?.trim().toLowerCase() || null;
  let partner: PartnerRow | null;
  let isOwner = true;
  if (actFor && actFor !== user.email) {
    const ctx = await resolvePortalContext(db, req, "partner");
    if ("failStatus" in ctx)
      return NextResponse.json({ error: "Unauthorized" }, { status: ctx.failStatus });
    if (!memberCan(ctx.features, "profile")) {
      return NextResponse.json(
        { error: "Editing the public profile is limited on your access." },
        { status: 403 },
      );
    }
    partner = await partnerByEmail(ctx.ownerEmail);
    isOwner = false;
  } else {
    partner = await partnerByEmail(user.email);
  }
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

  const { error } = await db.from("partners").update(patch).eq("id", partner.id);
  if (error) return NextResponse.json({ error: "Could not save. Try again." }, { status: 500 });
  // keep the portal chrome's display name in step with the partner name
  if (patch.name && isOwner) await upsertProfile(db, user, { displayName: patch.name });
  return NextResponse.json({ ok: true });
}
