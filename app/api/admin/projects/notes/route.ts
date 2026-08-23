import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { ensureMainCarrier } from "@/lib/project-station";
import { addComment, listComments, resolveComment, stamp } from "@/lib/review";
import { listVersions, removeVersion } from "@/lib/versions";
import { pushNotification } from "@/lib/notifications";
import { STATION_ORDER, STATIONS, normalizePipeline, type StationKey } from "@/lib/pipeline";

export const runtime = "nodejs";

/*
 * The review room's data: every note on a project's main video, every cut
 * it has had, and the studio's side of answering them.
 *
 * The same thread the client writes into from their player, so a note
 * pinned at 0:12 arrives here still pinned at 0:12, against the cut it was
 * written on. Every note also carries the production-line stage it is about,
 * so the room can show what the client asked for on the script beside the
 * script, on the voiceover beside the voiceover, and so on: their words, kept
 * against the file they are about. Plain messages are NOT here: those belong
 * to the one inbox.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* a note's stage, animation owning the legacy untagged video notes so an old
   review does not fall out of the room */
const stageOf = (raw: string | null): StationKey | null => {
  if (raw && (STATION_ORDER as string[]).includes(raw)) return raw as StationKey;
  return raw == null ? "animation" : null;
};

async function mainOf(db: ReturnType<typeof supabaseAdmin>, projectId: string) {
  const { data } = await db
    .from("order_deliverables")
    .select("id, video_url, status, revision_round, updated_at")
    .eq("project_id", projectId)
    .eq("category", "main")
    .maybeSingle();
  return data ?? null;
}

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const projectId = new URL(req.url).searchParams.get("projectId") ?? "";
  if (!UUID_RE.test(projectId))
    return NextResponse.json({ error: "Which project?" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: project } = await db
    .from("projects")
    .select("pipeline")
    .eq("id", projectId)
    .maybeSingle();
  const main = await mainOf(db, projectId);
  if (!main)
    return NextResponse.json({ notes: [], versions: [], videoUrl: null, stages: [] });

  const comments = await listComments(db, String(main.id));
  const versions = await listVersions(db, String(main.id));

  /* what the client can see and speak to, one entry per reviewable stage, in
     line order, each with how many of their notes are still unanswered */
  const line = normalizePipeline(project?.pipeline);
  const openByStage = new Map<StationKey, number>();
  for (const c of comments) {
    if (c.author_side !== "client" || c.parent_id || c.resolved_at) continue;
    const s = stageOf(c.stage);
    if (s) openByStage.set(s, (openByStage.get(s) ?? 0) + 1);
  }
  const stages = STATION_ORDER.filter((k) => STATIONS[k].reviewMedium !== null).map((k) => ({
    key: k,
    label: STATIONS[k].label,
    medium: STATIONS[k].reviewMedium,
    url: line[k].url ?? null,
    state: line[k].state,
    gate: Boolean(line[k].gate),
    provided: Boolean(line[k].provided),
    open: openByStage.get(k) ?? 0,
  }));

  /* a cut pasted before versions existed, or set straight onto the row, is
     still the cut the client is watching: show it rather than an empty room */
  const cuts = versions.length
    ? versions.map((v) => ({
        id: v.id,
        version: v.version,
        videoUrl: v.video_url,
        createdAt: v.created_at,
      }))
    : main.video_url
      ? [
          {
            id: `current-${String(main.id)}`,
            version: 1,
            videoUrl: String(main.video_url),
            createdAt: String((main as Record<string, unknown>).updated_at ?? new Date().toISOString()),
          },
        ]
      : [];

  return NextResponse.json({
    videoUrl: (main.video_url as string | null) ?? null,
    status: String(main.status),
    round: Number(main.revision_round ?? 0),
    versions: cuts,
    stages,
    notes: comments.map((c) => ({
      id: c.id,
      side: c.author_side,
      name: c.author_name ?? (c.author_side === "studio" ? "GHL Video" : "The client"),
      body: c.body,
      atSeconds: c.at_seconds,
      stamp: stamp(c.at_seconds),
      stage: stageOf(c.stage),
      version: c.version,
      parentId: c.parent_id,
      resolved: Boolean(c.resolved_at),
      at: c.created_at,
    })),
  });
}

export async function POST(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const projectId = typeof b.projectId === "string" ? b.projectId : "";
  if (!UUID_RE.test(projectId))
    return NextResponse.json({ error: "Which project?" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: project } = await db
    .from("projects")
    .select("id, title, customer_email")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Not found." }, { status: 404 });

  /* mark a client's note answered, or reopen it */
  if (typeof b.resolveId === "string") {
    await resolveComment(db, b.resolveId, admin.email, b.resolved !== false);
    return NextResponse.json({ ok: true });
  }

  /* drop a cut nobody should watch any more */
  if (typeof b.removeVersionId === "string") {
    const main = await mainOf(db, projectId);
    if (!main) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const res = await removeVersion(db, String(main.id), b.removeVersionId);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const text = typeof b.body === "string" ? b.body.trim().slice(0, 4000) : "";
  if (!text) return NextResponse.json({ error: "Write something first." }, { status: 400 });

  const mainId = await ensureMainCarrier(db, projectId);
  if (!mainId) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const parentId = typeof b.parentId === "string" ? b.parentId : null;
  /* keep a reply on the same file as the note it answers; a fresh studio note
     carries the stage tab the room was on */
  let stage: StationKey | null =
    typeof b.stage === "string" && (STATION_ORDER as string[]).includes(b.stage)
      ? (b.stage as StationKey)
      : null;
  if (parentId) {
    const { data: parent } = await db
      .from("deliverable_comments")
      .select("stage")
      .eq("id", parentId)
      .maybeSingle();
    if (parent) stage = stageOf((parent.stage as string | null) ?? null);
  }

  const res = await addComment(db, {
    deliverableId: mainId,
    side: "studio",
    email: admin.email,
    name: "GHL Video",
    body: text,
    atSeconds:
      typeof b.atSeconds === "number" && Number.isFinite(b.atSeconds) ? b.atSeconds : null,
    stage,
    parentId,
  });
  if (!res) return NextResponse.json({ error: "Could not post that." }, { status: 400 });

  await pushNotification(db, {
    audience: "customer",
    email: String(project.customer_email),
    kind: "project_note",
    title: `A note on ${String(project.title)}`,
    body: text.slice(0, 140),
    href: `projects/${projectId}`,
    vars: { project_title: String(project.title), text: text.slice(0, 140) },
  });

  return NextResponse.json({ ok: true });
}
