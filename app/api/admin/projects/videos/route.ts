import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";

export const runtime = "nodejs";

/*
 * The videos inside one custom project: add one, move one along, name the
 * editor. The editing plan's deliverables have their own route with the QC
 * gate; custom work has no QC checklist (the review IS the client's), so
 * this one stays small. Every write is scoped to the project it claims,
 * so a stray id can never edit another project's video.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ["queued", "in_production", "ready", "revisions", "approved"] as const;

const str = (v: unknown, max: number) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

export async function POST(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const projectId = str(b.projectId, 64);
  const title = str(b.title, 160);
  if (!projectId || !UUID_RE.test(projectId))
    return NextResponse.json({ error: "Which project?" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "Name the video." }, { status: 400 });

  const db = supabaseAdmin();
  const { data: project } = await db
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const { data: last } = await db
    .from("order_deliverables")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await db.from("order_deliverables").insert({
    project_id: projectId,
    title,
    status: "queued",
    position: last ? Number(last.position) + 1 : 0,
    due_at: str(b.dueAt, 40) ? new Date(String(b.dueAt)).toISOString() : null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = str(b.id, 64);
  const projectId = str(b.projectId, 64);
  if (!id || !UUID_RE.test(id) || !projectId || !UUID_RE.test(projectId))
    return NextResponse.json({ error: "Which video?" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: current } = await db
    .from("order_deliverables")
    .select("id, status")
    .eq("id", id)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!current) return NextResponse.json({ error: "Video not found." }, { status: 404 });

  const patch: Record<string, unknown> = {};
  if (STATUSES.includes(b.status as (typeof STATUSES)[number])) {
    patch.status = b.status;
    if (b.status === "ready") patch.ready_at = new Date().toISOString();
    if (b.status === "approved") patch.approved_at = new Date().toISOString();
  }
  if ("assignedTo" in b)
    patch.assigned_admin_email = typeof b.assignedTo === "string" && b.assignedTo ? b.assignedTo : null;
  if ("videoUrl" in b)
    patch.video_url = typeof b.videoUrl === "string" && b.videoUrl.trim() ? b.videoUrl.trim() : null;
  if ("dueAt" in b)
    patch.due_at = typeof b.dueAt === "string" && b.dueAt ? new Date(b.dueAt).toISOString() : null;
  if ("title" in b && str(b.title, 160)) patch.title = str(b.title, 160);

  if (!Object.keys(patch).length)
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  const { error } = await db.from("order_deliverables").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
