import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { getSessionUser } from "@/lib/account/session";
import { addMember, listMembers, removeMember, updateMember } from "@/lib/account-team";

export const runtime = "nodejs";

/*
 * The customer's own team: who may work in their portal and with which
 * grants. Owner-only by construction: the owner is simply the signed-in
 * email; a member acting for an owner never reaches these (no X-Act-For
 * handling here on purpose).
 */
async function owner(req: Request) {
  const user = await getSessionUser(req);
  return user?.email ?? null;
}

export async function GET(req: Request) {
  const email = await owner(req);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const members = await listMembers(supabaseAdmin(), "customer", email);
  return NextResponse.json({
    members: members.map((m) => ({
      id: m.id,
      name: m.member_name,
      email: m.member_email,
      features: m.features,
      status: m.status,
    })),
  });
}

export async function POST(req: Request) {
  const email = await owner(req);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const db = supabaseAdmin();
  const result = await addMember(db, "customer", email, {
    name: String(body.name ?? ""),
    email: String(body.email ?? ""),
    features: body.features,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  // the invite email + bell note; fail-soft, the add already succeeded
  const { data: me } = await db.from("customers").select("name").ilike("email", email).maybeSingle();
  const { sendTeamInviteEmail } = await import("@/lib/email/notify");
  await sendTeamInviteEmail(db, {
    accountType: "customer",
    ownerName: (me?.name as string | null) ?? email,
    memberName: result.member.member_name ?? "",
    memberEmail: result.member.member_email,
  });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const email = await owner(req);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Missing member id." }, { status: 400 });
  const result = await updateMember(supabaseAdmin(), "customer", email, id, {
    name: body.name === undefined ? undefined : String(body.name),
    features: body.features,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const email = await owner(req);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Missing member id." }, { status: 400 });
  await removeMember(supabaseAdmin(), "customer", email, id);
  return NextResponse.json({ ok: true });
}
