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

/*
 * The extra formats, as stages of their own.
 *
 * A format is its own deliverable row, not a station on the line, so its
 * feedback lives on its own thread. This room only ever read the main
 * carrier's, which meant a client could leave ten timestamped notes on a
 * white-label cut and nobody here could see one of them. They arrived as an
 * email and then existed nowhere a person works.
 *
 * They get a tab each, keyed format:<id> so the six real station keys stay
 * exactly what they were. The key carries the deliverable, which is what
 * makes a note land on the right thread when it is answered.
 */
const FORMAT_PREFIX = "format:";
const formatKey = (id: string) => `${FORMAT_PREFIX}${id}`;
const formatIdOf = (key: string) =>
  key.startsWith(FORMAT_PREFIX) ? key.slice(FORMAT_PREFIX.length) : null;

/* how a format's own status reads in the same words a station uses */
function formatState(status: string): "todo" | "with_us" | "with_client" | "done" {
  if (status === "approved") return "done";
  if (status === "ready" || status === "revisions") return "with_client";
  if (status === "in_production") return "with_us";
  return "todo";
}

async function formatsOf(db: ReturnType<typeof supabaseAdmin>, projectId: string) {
  const { data } = await db
    .from("order_deliverables")
    .select("id, title, status, video_url, position")
    .eq("project_id", projectId)
    .eq("category", "format")
    .order("position");
  return (data ?? []) as Record<string, unknown>[];
}

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
  const formats = await formatsOf(db, projectId);
  if (!main)
    return NextResponse.json({ notes: [], versions: [], videoUrl: null, stages: [] });

  const comments = await listComments(db, String(main.id));
  const versions = await listVersions(db, String(main.id));

  /* each format's own thread, tagged with the tab it belongs to. The tag is
     synthesised from the deliverable rather than read off the row, so the
     notes clients have already left, which carry no stage at all, land in the
     right place with nothing to migrate. */
  const formatThreads = await Promise.all(
    formats.map(async (f) => ({
      id: String(f.id),
      title: String(f.title),
      status: String(f.status),
      videoUrl: (f.video_url as string | null) ?? null,
      list: await listComments(db, String(f.id)),
    })),
  );

  /* what the client can see and speak to, one entry per reviewable stage, in
     line order, each with how many of their notes are still unanswered */
  const line = normalizePipeline(project?.pipeline);
  const openByStage = new Map<StationKey, number>();
  for (const c of comments) {
    if (c.author_side !== "client" || c.parent_id || c.resolved_at) continue;
    const s = stageOf(c.stage);
    if (s) openByStage.set(s, (openByStage.get(s) ?? 0) + 1);
  }
  const stages = [
    ...STATION_ORDER.filter((k) => STATIONS[k].reviewMedium !== null).map((k) => ({
      key: k as string,
      label: STATIONS[k].label,
      medium: STATIONS[k].reviewMedium as string | null,
      url: line[k].url ?? null,
      state: line[k].state as string,
      gate: Boolean(line[k].gate),
      provided: Boolean(line[k].provided),
      open: openByStage.get(k) ?? 0,
    })),
    /* the formats, after the line that produced them */
    ...formatThreads.map((f) => ({
      key: formatKey(f.id),
      label: f.title,
      medium: "video" as string | null,
      url: f.videoUrl,
      state: formatState(f.status),
      gate: false,
      provided: false,
      open: f.list.filter((c) => c.author_side === "client" && !c.parent_id && !c.resolved_at)
        .length,
    })),
  ];

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
    notes: [
      ...comments.map((c) => ({
        id: c.id,
        side: c.author_side,
        name: c.author_name ?? (c.author_side === "studio" ? "GHL Video" : "The client"),
        body: c.body,
        atSeconds: c.at_seconds,
        stamp: stamp(c.at_seconds),
        stage: stageOf(c.stage) as string | null,
        version: c.version,
        parentId: c.parent_id,
        resolved: Boolean(c.resolved_at),
        at: c.created_at,
      })),
      ...formatThreads.flatMap((f) =>
        f.list.map((c) => ({
          id: c.id,
          side: c.author_side,
          name: c.author_name ?? (c.author_side === "studio" ? "GHL Video" : "The client"),
          body: c.body,
          atSeconds: c.at_seconds,
          stamp: stamp(c.at_seconds),
          stage: formatKey(f.id) as string | null,
          version: c.version,
          parentId: c.parent_id,
          resolved: Boolean(c.resolved_at),
          at: c.created_at,
        })),
      ),
    ],
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

  /*
   * Which thread this lands on. A format has its own deliverable, so
   * answering a note about the vertical cut has to be written against the
   * vertical cut, not against the main carrier where the client would never
   * see it. Verified as belonging to THIS project: a deliverable id arriving
   * in a request body is not proof of anything.
   */
  let targetId = mainId;
  const wantFormat = typeof b.stage === "string" ? formatIdOf(b.stage) : null;
  if (wantFormat && UUID_RE.test(wantFormat)) {
    const { data: f } = await db
      .from("order_deliverables")
      .select("id")
      .eq("id", wantFormat)
      .eq("project_id", projectId)
      .eq("category", "format")
      .maybeSingle();
    if (!f) return NextResponse.json({ error: "Not found." }, { status: 404 });
    targetId = String(f.id);
    /* the deliverable already says which file this is about; a station tag on
       top of it would be a second, disagreeing answer */
    stage = null;
  }

  if (parentId) {
    const { data: parent } = await db
      .from("deliverable_comments")
      .select("stage, deliverable_id")
      .eq("id", parentId)
      .maybeSingle();
    if (parent) {
      /* a reply belongs on its parent's thread, whichever that is */
      const owner = String(parent.deliverable_id);
      const { data: ok } = await db
        .from("order_deliverables")
        .select("id")
        .eq("id", owner)
        .eq("project_id", projectId)
        .maybeSingle();
      if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
      targetId = owner;
      stage = owner === mainId ? stageOf((parent.stage as string | null) ?? null) : null;
    }
  }

  const res = await addComment(db, {
    deliverableId: targetId,
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
