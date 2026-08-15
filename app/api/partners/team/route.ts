import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { getSessionUser } from "@/lib/account/session";
import { partnerByEmail } from "@/lib/partners";
import {
  addMember,
  getMember,
  listMembers,
  removeMember,
  setMemberStatus,
  updateMember,
} from "@/lib/account-team";

export const runtime = "nodejs";

/*
 * The partner's own team: who may work in their partner portal and with
 * which grants. Owner-only: the caller must themselves be the partner
 * (members acting for an owner are never admitted here).
 */
async function owner(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return null;
  const partner = await partnerByEmail(user.email);
  if (!partner || !["active", "invited"].includes(partner.status)) return null;
  return { email: user.email, partner };
}

export async function GET(req: Request) {
  const o = await owner(req);
  if (!o) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const members = await listMembers(supabaseAdmin(), "partner", o.email);
  return NextResponse.json({
    members: members.map((m) => ({
      id: m.id,
      name: m.member_name,
      email: m.member_email,
      features: m.features,
      status: m.status,
      addedAt: m.created_at,
    })),
  });
}

export async function POST(req: Request) {
  const o = await owner(req);
  if (!o) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const db = supabaseAdmin();
  const result = await addMember(db, "partner", o.email, {
    name: String(body.name ?? ""),
    email: String(body.email ?? ""),
    features: body.features,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const { sendTeamInviteEmail } = await import("@/lib/email/notify");
  await sendTeamInviteEmail(db, {
    accountType: "partner",
    ownerName: o.partner.name,
    memberName: result.member.member_name ?? "",
    memberEmail: result.member.member_email,
  });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const o = await owner(req);
  if (!o) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Missing member id." }, { status: 400 });
  const db = supabaseAdmin();

  // management actions: pause, resume, resend the invite
  const action = typeof body.action === "string" ? body.action : null;
  if (action === "pause" || action === "resume") {
    const result = await setMemberStatus(db, "partner", o.email, id, action);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  if (action === "resend") {
    const member = await getMember(db, "partner", o.email, id);
    if (!member) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const { sendTeamInviteEmail } = await import("@/lib/email/notify");
    await sendTeamInviteEmail(db, {
      accountType: "partner",
      ownerName: o.partner.name,
      memberName: member.member_name ?? "",
      memberEmail: member.member_email,
    });
    return NextResponse.json({ ok: true });
  }

  const result = await updateMember(db, "partner", o.email, id, {
    name: body.name === undefined ? undefined : String(body.name),
    features: body.features,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const o = await owner(req);
  if (!o) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Missing member id." }, { status: 400 });
  await removeMember(supabaseAdmin(), "partner", o.email, id);
  return NextResponse.json({ ok: true });
}
