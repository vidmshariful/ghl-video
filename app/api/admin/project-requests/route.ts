import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { REQUEST_STATUSES, type RequestStatus } from "@/lib/projects";

export const runtime = "nodejs";

/*
 * Website enquiries, before they are work.
 *
 * These used to go to HighLevel and nowhere else, so there was no pipeline to
 * work through and no way to know how many became jobs. Kept apart from
 * projects because most projects never pass through here: a referral or a
 * call becomes a job directly, and dragging those through an enquiry stage
 * would be inventing paperwork.
 */

type Row = Record<string, unknown>;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { data } = await supabaseAdmin()
    .from("project_requests")
    .select("*")
    .order("created_at", { ascending: false });

  return NextResponse.json({
    requests: ((data ?? []) as Row[]).map((r) => ({
      id: String(r.id),
      name: (r.name as string | null) ?? null,
      email: String(r.email),
      company: (r.company as string | null) ?? null,
      phone: (r.phone as string | null) ?? null,
      brief: (r.brief as string | null) ?? null,
      source: String(r.source),
      status: String(r.status) as RequestStatus,
      lostReason: (r.lost_reason as string | null) ?? null,
      projectId: (r.project_id as string | null) ?? null,
      createdAt: String(r.created_at),
    })),
  });
}

export async function PATCH(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof b.id === "string" ? b.id : "";
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Which enquiry?" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (REQUEST_STATUSES.includes(b.status as RequestStatus)) patch.status = b.status;
  if ("lostReason" in b) {
    patch.lost_reason =
      typeof b.lostReason === "string" && b.lostReason.trim()
        ? b.lostReason.trim().slice(0, 400)
        : null;
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const { error } = await supabaseAdmin().from("project_requests").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
