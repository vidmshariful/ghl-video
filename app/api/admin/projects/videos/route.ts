import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";

export const runtime = "nodejs";

/*
 * The extra formats of one project: the reels, shorts and crops cut after
 * the main video is approved. Deliberately small (owner decision, 21 August
 * 2026): a format is a title, a link once it is done, and one of four
 * states. The main video is not managed here; it IS the project, and its
 * line lives on the project itself.
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
  if (!title) return NextResponse.json({ error: "Name the format." }, { status: 400 });

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
    category: "format",
    status: "queued",
    position: last ? Number(last.position) + 1 : 1,
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
    return NextResponse.json({ error: "Which format?" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: current } = await db
    .from("order_deliverables")
    .select("id")
    .eq("id", id)
    .eq("project_id", projectId)
    .eq("category", "format")
    .maybeSingle();
  if (!current) return NextResponse.json({ error: "Format not found." }, { status: 404 });

  const patch: Record<string, unknown> = {};
  if (STATUSES.includes(b.status as (typeof STATUSES)[number])) {
    patch.status = b.status;
    if (b.status === "ready") patch.ready_at = new Date().toISOString();
    if (b.status === "approved") patch.approved_at = new Date().toISOString();
  }
  if ("videoUrl" in b)
    patch.video_url = typeof b.videoUrl === "string" && b.videoUrl.trim() ? b.videoUrl.trim() : null;
  if ("title" in b && str(b.title, 160)) patch.title = str(b.title, 160);

  if (!Object.keys(patch).length)
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  const { error } = await db.from("order_deliverables").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
