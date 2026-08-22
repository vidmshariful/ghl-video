import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { ensureMainCarrier } from "@/lib/project-station";
import { addComment, listComments, resolveComment, stamp } from "@/lib/review";
import { listVersions, removeVersion } from "@/lib/versions";
import { pushNotification } from "@/lib/notifications";

export const runtime = "nodejs";

/*
 * The review room's data: every note on a project's main video, every cut
 * it has had, and the studio's side of answering them.
 *
 * The same thread the client writes into from their player, so a note
 * pinned at 0:12 arrives here still pinned at 0:12, against the cut it was
 * written on. Plain messages are NOT here: those belong to the one inbox.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const main = await mainOf(db, projectId);
  if (!main) return NextResponse.json({ notes: [], versions: [], videoUrl: null });

  const comments = await listComments(db, String(main.id));
  const versions = await listVersions(db, String(main.id));

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
    notes: comments.map((c) => ({
      id: c.id,
      side: c.author_side,
      name: c.author_name ?? (c.author_side === "studio" ? "GHL Video" : "The client"),
      body: c.body,
      atSeconds: c.at_seconds,
      stamp: stamp(c.at_seconds),
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

  const res = await addComment(db, {
    deliverableId: mainId,
    side: "studio",
    email: admin.email,
    name: "GHL Video",
    body: text,
    atSeconds:
      typeof b.atSeconds === "number" && Number.isFinite(b.atSeconds) ? b.atSeconds : null,
    parentId: typeof b.parentId === "string" ? b.parentId : null,
  });
  if (!res) return NextResponse.json({ error: "Could not post that." }, { status: 400 });

  await pushNotification(db, {
    audience: "customer",
    email: String(project.customer_email),
    kind: "project_note",
    title: `A note on ${String(project.title)}`,
    body: text.slice(0, 140),
    href: "custom",
  });

  return NextResponse.json({ ok: true });
}
