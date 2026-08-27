import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { contextCan, resolvePortalContext } from "@/lib/account-team";
import { isWatchable, type DeliverableStatus } from "@/lib/deliverable-status";
import { normalizePipeline } from "@/lib/pipeline";

export const runtime = "nodejs";

/*
 * Download a finished video.
 *
 * The plain <a download> attribute is ignored across origins, so a link
 * straight at the HighLevel CDN opened the file in a tab and played it. The
 * browser only honours download for a same-origin response, so we fetch the
 * file here and hand it back with a filename attached.
 *
 * Streamed, not buffered: a 200MB video must not sit in this process's memory
 * on the way through. The largest video a client currently owns is 696MB,
 * which is also why the browser must not buffer it either: fetching it into a
 * blob to attach a token would hold the whole thing in a tab's memory and
 * show no progress for minutes.
 *
 * WHY A TICKET
 *
 * Every portal request authenticates with a Bearer header, because the
 * session lives in localStorage rather than a cookie. A download is a plain
 * navigation, which carries neither, so an <a href> straight at this route
 * arrived with no session and answered {"error":"Unauthorized."} on screen.
 * Every download button in the portal was broken this way, including
 * "Download them all".
 *
 * So ask here first, with the session, for a short-lived ticket, then GET
 * with it. The ticket names one video and expires in five minutes. Ownership
 * is checked when it is minted, which is what the signature then stands for.
 * The email is deliberately NOT in the URL: a link gets pasted into a chat
 * and logged by every hop it passes, and the video id is already opaque.
 *
 * Minting is a GET, and that is not an accident. It was a POST, and View as
 * client is deliberately read-only, so the studio looking at a client's
 * portal could watch a video and then be told Unauthorized for asking to
 * keep a copy of it. Handing over a file somebody can already watch reads
 * nothing new: it is a read, and it says so.
 */
const TICKET_TTL_MS = 5 * 60 * 1000;

/* Its own secret if there is one, otherwise derived from the service role key,
   which is server-only and always present. The fallback matters: a download
   must not start failing because an env var was missed on a deploy. */
function ticketSecret(): string {
  return (
    process.env.PORTAL_DOWNLOAD_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

function sign(id: string, stage: string, expiresAt: number): string {
  return createHmac("sha256", ticketSecret())
    .update(`portal-download.v1.${id}.${stage}.${expiresAt}`)
    .digest("hex");
}

function ticketValid(
  id: string,
  stage: string,
  exp: string | null,
  sig: string | null,
): boolean {
  if (!exp || !sig || !ticketSecret()) return false;
  const expiresAt = Number(exp);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;
  const expected = Buffer.from(sign(id, stage, expiresAt));
  const given = Buffer.from(sig);
  /* length check first: timingSafeEqual throws on a mismatch rather than
     returning false, and a wrong-length signature is just a wrong signature */
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function safeName(title: string): string {
  const base = title
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "video"}.mp4`;
}

/** Whose video is this, across all three owners a video can have. */
async function ownedBy(
  db: ReturnType<typeof supabaseAdmin>,
  d: Record<string, unknown>,
  email: string,
): Promise<{ owned: boolean; refunded: boolean }> {
  if (d.order_id) {
    const { data } = await db
      .from("orders")
      .select("id, status")
      .eq("id", d.order_id as string)
      .ilike("customer_email", email)
      .maybeSingle();
    return { owned: Boolean(data), refunded: data?.status === "refunded" };
  }
  if (d.project_id) {
    const { data } = await db
      .from("projects")
      .select("id")
      .eq("id", d.project_id as string)
      .ilike("customer_email", email)
      .maybeSingle();
    return { owned: Boolean(data), refunded: false };
  }
  if (d.cycle_id) {
    const { data } = await db
      .from("subscription_cycles")
      .select("subscription:subscriptions!inner(customer_email)")
      .eq("id", d.cycle_id as string)
      .maybeSingle();
    const owner =
      (data?.subscription as { customer_email?: string } | null)?.customer_email ?? "";
    return { owned: owner.toLowerCase() === email.toLowerCase(), refunded: false };
  }
  return { owned: false, refunded: false };
}

/*
 * The same two gates the portal itself applies: it has to be theirs, and the
 * video has to be one they are allowed to watch.
 *
 * "Theirs" has three shapes. This route only knew about orders once, so a
 * custom or editing video could be watched in the portal and then failed to
 * download, which reads as the file being broken rather than as us having
 * forgotten a branch.
 */
async function authorize(
  db: ReturnType<typeof supabaseAdmin>,
  req: Request,
  d: Record<string, unknown>,
): Promise<NextResponse | null> {
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });
  if (!contextCan(ctx, "orders"))
    return NextResponse.json({ error: "No access." }, { status: 403 });

  const mine = await ownedBy(db, d, ctx.ownerEmail);
  if (!mine.owned) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (mine.refunded) return NextResponse.json({ error: "Not available." }, { status: 403 });
  return null;
}

/*
 * The file a production-line stage is showing.
 *
 * A project's carrier row holds the newest cut, and each stage holds the cut
 * it was signed off on, which is not the same thing. On a finished project
 * the animation stage still points at the animation while the carrier has
 * moved on to the delivery. Downloading through the carrier therefore handed
 * somebody a different video than the one playing in front of them, so a
 * stage download reads the stage.
 */
async function stageFile(
  db: ReturnType<typeof supabaseAdmin>,
  projectId: string,
  stage: string,
): Promise<{ url: string; title: string } | null> {
  const { data: project } = await db
    .from("projects")
    .select("title, pipeline")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return null;
  const line = normalizePipeline(project.pipeline);
  const url = (line as Record<string, { url?: string | null }>)[stage]?.url ?? null;
  if (!url) return null;
  return { url, title: `${String(project.title)} ${stage}` };
}

async function load(db: ReturnType<typeof supabaseAdmin>, id: string) {
  const { data } = await db
    .from("order_deliverables")
    .select("id, title, status, video_url, order_id, project_id, cycle_id")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = supabaseAdmin();
  const { id } = await params;
  const q = new URL(req.url).searchParams;

  const d = await load(db, id);
  if (!d?.video_url) return NextResponse.json({ error: "Not found." }, { status: 404 });

  /* asking for a ticket rather than for the file */
  if (q.get("mint")) {
    const stage = q.get("stage") ?? "";
    const refused = await authorize(db, req, d);
    if (refused) return refused;

    if (stage) {
      /* a stage carries its own cut, and whether THAT is ready is answered by
         it having a file at all. The carrier can still be mid production while
         an earlier stage sits finished and watchable in front of the client. */
      const file = d.project_id
        ? await stageFile(db, String(d.project_id), stage)
        : null;
      if (!file)
        return NextResponse.json({ error: "Nothing to download here yet." }, { status: 404 });
    } else if (!isWatchable(d.status as DeliverableStatus)) {
      return NextResponse.json({ error: "That video is not ready yet." }, { status: 403 });
    }

    const expiresAt = Date.now() + TICKET_TTL_MS;
    const st = stage ? `&st=${encodeURIComponent(stage)}` : "";
    return NextResponse.json({
      url: `/api/portal/videos/${id}/download/?e=${expiresAt}${st}&s=${sign(id, stage, expiresAt)}`,
    });
  }

  const stage = q.get("st") ?? "";

  /* a valid ticket already stands for the ownership check done when it was
     minted; anything else still has to prove itself the usual way */
  if (!ticketValid(id, stage, q.get("e"), q.get("s"))) {
    const denied = await authorize(db, req, d);
    if (denied) return denied;
  }

  /* the file the client is actually looking at: the stage's own cut when one
     was asked for, the carrier's otherwise */
  let source = { url: String(d.video_url), title: String(d.title) };
  if (stage) {
    const file = d.project_id ? await stageFile(db, String(d.project_id), stage) : null;
    if (!file)
      return NextResponse.json({ error: "Nothing to download here yet." }, { status: 404 });
    source = file;
  } else if (!isWatchable(d.status as DeliverableStatus)) {
    return NextResponse.json({ error: "That video is not ready yet." }, { status: 403 });
  }

  const upstream = await fetch(source.url).catch(() => null);
  if (!upstream?.ok || !upstream.body) {
    return NextResponse.json({ error: "Could not fetch that video." }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "video/mp4",
      ...(upstream.headers.get("content-length")
        ? { "content-length": upstream.headers.get("content-length") as string }
        : {}),
      "content-disposition": `attachment; filename="${safeName(source.title)}"`,
      "cache-control": "private, no-store",
    },
  });
}
