import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
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
 * The studio's side of a client's portal team.
 *
 * A client can add their own people from Settings, and most do. This is for
 * when they ask us instead, which on a bigger account is most of the time:
 * somebody emails "can you give Sarah access" and until now the only answer
 * was to talk them through doing it themselves.
 *
 * It writes exactly what the client's own screen writes, through the same
 * functions in lib/account-team, so a member added here is indistinguishable
 * from one they added. No admin-only shape, no second idea of what a member
 * is. The one difference is the invite email says who it came from.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The admin, and the client they are acting for. */
async function gate(req: Request, id: string) {
  const admin = await verifyAdmin(req);
  if (!admin) return { fail: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  if (!UUID_RE.test(id)) return { fail: NextResponse.json({ error: "Not found." }, { status: 404 }) };

  const db = supabaseAdmin();
  const { data: c } = await db.from("customers").select("id, email, name").eq("id", id).maybeSingle();
  if (!c) return { fail: NextResponse.json({ error: "Not found." }, { status: 404 }) };

  return {
    db,
    admin,
    owner: String(c.email).toLowerCase(),
    ownerName: (c.name as string | null) ?? String(c.email),
  };
}

const shape = (m: Awaited<ReturnType<typeof listMembers>>[number]) => ({
  id: m.id,
  name: m.member_name,
  email: m.member_email,
  features: m.features,
  status: m.status,
  addedAt: m.created_at,
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate(req, (await params).id);
  if ("fail" in g) return g.fail;
  const members = await listMembers(g.db, "customer", g.owner);
  return NextResponse.json({ members: members.map(shape) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate(req, (await params).id);
  if ("fail" in g) return g.fail;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const result = await addMember(g.db, "customer", g.owner, {
    name: String(body.name ?? ""),
    email: String(body.email ?? ""),
    features: body.features,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  /* the invite still comes from the account, not from us: the person opening
     it should recognise the company that added them. Fail-soft, the member
     already exists. */
  const { sendTeamInviteEmail } = await import("@/lib/email/notify");
  await sendTeamInviteEmail(g.db, {
    accountType: "customer",
    ownerName: g.ownerName,
    memberName: result.member.member_name ?? "",
    memberEmail: result.member.member_email,
  }).catch(() => {});

  /* who did it, on the client's own record, because "who gave Sarah access"
     is a question that gets asked later */
  await g.db
    .from("customer_notes")
    .insert({
      customer_id: (await params).id,
      author: g.admin.email,
      body: `Added ${result.member.member_email} to the portal team on their behalf.`,
    })
    .then(undefined, () => {});

  return NextResponse.json({ ok: true, member: shape(result.member) });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate(req, (await params).id);
  if ("fail" in g) return g.fail;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Missing member id." }, { status: 400 });

  const action = typeof body.action === "string" ? body.action : null;
  if (action === "pause" || action === "resume") {
    const result = await setMemberStatus(g.db, "customer", g.owner, id, action);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  if (action === "resend") {
    const member = await getMember(g.db, "customer", g.owner, id);
    if (!member) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const { sendTeamInviteEmail } = await import("@/lib/email/notify");
    await sendTeamInviteEmail(g.db, {
      accountType: "customer",
      ownerName: g.ownerName,
      memberName: member.member_name ?? "",
      memberEmail: member.member_email,
    }).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  const result = await updateMember(g.db, "customer", g.owner, id, {
    name: body.name === undefined ? undefined : String(body.name),
    features: body.features,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate(req, (await params).id);
  if ("fail" in g) return g.fail;
  /* the id arrives in the body, the same shape the client's own team screen
     sends, because both are driven by the one TeamCard */
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Missing member id." }, { status: 400 });
  await removeMember(g.db, "customer", g.owner, id);
  return NextResponse.json({ ok: true });
}
