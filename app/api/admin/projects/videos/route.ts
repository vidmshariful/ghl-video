import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import {
  normalizePipeline,
  statusForPipeline,
  STATION_ORDER,
  STATIONS,
  type StationKey,
  type StationState,
} from "@/lib/pipeline";
import { addVersion } from "@/lib/versions";

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

  /* what the client already gave us is done before the work begins */
  const provided: Record<string, unknown> = {};
  if (b.scriptProvided === true) provided.script = { state: "done", provided: true };
  if (b.voiceoverProvided === true) provided.voiceover = { state: "done", provided: true };

  const { error } = await db.from("order_deliverables").insert({
    project_id: projectId,
    title,
    status: "queued",
    position: last ? Number(last.position) + 1 : 0,
    due_at: str(b.dueAt, 40) ? new Date(String(b.dueAt)).toISOString() : null,
    pipeline: provided,
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

  /* ---- the production line ---- */
  const stationOf = (v: unknown): StationKey | null =>
    typeof v === "string" && (STATION_ORDER as string[]).includes(v) ? (v as StationKey) : null;

  if (b.station && typeof b.station === "object") {
    const st = b.station as Record<string, unknown>;
    const key = stationOf(st.key);
    if (!key) return NextResponse.json({ error: "Which station?" }, { status: 400 });

    const { data: full } = await db
      .from("order_deliverables")
      .select("*")
      .eq("id", id)
      .single();
    const line = normalizePipeline(full?.pipeline);
    const now = new Date().toISOString();

    const nextStation = { ...line[key] };
    const state = st.state;
    if (state === "todo" || state === "with_us" || state === "with_client" || state === "done") {
      nextStation.state = state as StationState;
      nextStation.at = now;
    }
    if ("url" in st)
      nextStation.url = typeof st.url === "string" && st.url.trim() ? st.url.trim() : null;
    if ("provided" in st && STATIONS[key].providable) nextStation.provided = Boolean(st.provided);
    if ("gate" in st) nextStation.gate = Boolean(st.gate);
    if ("eta" in st)
      nextStation.eta =
        typeof st.eta === "string" && st.eta ? new Date(st.eta).toISOString() : null;

    const line2 = normalizePipeline({ ...line, [key]: nextStation });
    const derived = statusForPipeline(line2, Number(full?.revision_round ?? 0));
    const write: Record<string, unknown> = { pipeline: line2, status: derived };
    if (derived === "ready") write.ready_at = now;
    if (derived === "approved") write.approved_at = now;
    /* the animation and delivery stations carry the watchable file */
    if ((key === "animation" || key === "delivery") && nextStation.url)
      write.video_url = nextStation.url;

    const { error } = await db.from("order_deliverables").update(write).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    if (st.requestApproval === true) {
      /* handing it to the client without a thing to look at is a bounce */
      if (!line2[key].url && key !== "delivery")
        return NextResponse.json({ ok: true, warning: "No file on that station yet." });
      const { data: proj } = await db
        .from("projects")
        .select("customer_email")
        .eq("id", projectId)
        .single();
      const email = String(proj?.customer_email ?? "");
      const { data: cust } = await db
        .from("customers")
        .select("name")
        .ilike("email", email)
        .maybeSingle();
      const { sendApprovalRequestEmail } = await import("@/lib/email/notify");
      await sendApprovalRequestEmail(db, {
        email,
        name: (cust?.name as string | null) ?? null,
        videoTitle: String(full?.title ?? "your video"),
        stageLabel: STATIONS[key].label,
      });
      const { pushNotification } = await import("@/lib/notifications");
      await pushNotification(db, {
        audience: "customer",
        email,
        kind: "approval_request",
        title: `Your review: ${STATIONS[key].label}`,
        body: `${String(full?.title ?? "A video")} is waiting on your approval.`,
        href: "custom",
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (b.action === "add_draft") {
    const url = str(b.url, 2000);
    if (!url) return NextResponse.json({ error: "Paste the draft link first." }, { status: 400 });
    const v = await addVersion(db, id, url, admin.email, str(b.note, 400));
    if (!v) return NextResponse.json({ error: "Could not save that draft." }, { status: 400 });

    const { data: full } = await db
      .from("order_deliverables")
      .select("*")
      .eq("id", id)
      .single();
    const line = normalizePipeline(full?.pipeline);
    const now = new Date().toISOString();
    const line2 = normalizePipeline({
      ...line,
      animation: { ...line.animation, url, at: now, state: line.animation.state === "todo" ? "with_us" : line.animation.state },
    });
    const { error } = await db
      .from("order_deliverables")
      .update({
        pipeline: line2,
        video_url: url,
        status: statusForPipeline(line2, Number(full?.revision_round ?? 0)),
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, version: v.version });
  }

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
