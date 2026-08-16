import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { addComment, listComments, resolveComment, stamp } from "@/lib/review";
import { listVersions, removeVersion } from "@/lib/versions";
import { pushNotification } from "@/lib/notifications";

export const runtime = "nodejs";

/*
 * The studio's side of a review thread: read the notes on a video, answer
 * them, and mark one dealt with.
 *
 * Same thread the client sees, so a reply here appears under their player.
 * Every write is scoped to a video on THIS order, so an id from elsewhere
 * cannot be answered through this order's URL.
 */
async function ownedVideo(orderId: string, deliverableId: string) {
  const db = supabaseAdmin();
  const { data } = await db
    .from("order_deliverables")
    .select("id, title, order_id")
    .eq("id", deliverableId)
    .eq("order_id", orderId)
    .maybeSingle();
  return { db, video: data };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const url = new URL(req.url);
  const deliverableId = url.searchParams.get("video") ?? "";
  const db = supabaseAdmin();

  // no video given: the open-note counts for the whole job, for the badges
  if (!deliverableId) {
    const { openCommentCounts } = await import("@/lib/review");
    return NextResponse.json({ open: await openCommentCounts(db, id) });
  }

  const { video } = await ownedVideo(id, deliverableId);
  if (!video) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const comments = await listComments(db, deliverableId);
  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      side: c.author_side,
      name: c.author_name ?? (c.author_side === "studio" ? "GHL Video" : c.author_email),
      body: c.body,
      atSeconds: c.at_seconds,
      atX: c.at_x,
      atY: c.at_y,
      stamp: stamp(c.at_seconds),
      round: c.revision_round,
      version: c.version,
      parentId: c.parent_id,
      resolved: Boolean(c.resolved_at),
      createdAt: c.created_at,
    })),
    versions: await listVersions(db, deliverableId),
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const deliverableId = typeof body.deliverableId === "string" ? body.deliverableId : "";
  const { db, video } = await ownedVideo(id, deliverableId);
  if (!video) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // removing an old cut, once the team is done with it
  if (typeof body.removeVersionId === "string") {
    const r = await removeVersion(db, deliverableId, body.removeVersionId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  // resolving an existing note
  if (typeof body.resolveId === "string") {
    await resolveComment(db, body.resolveId, admin.email, body.resolved !== false);
    return NextResponse.json({ ok: true });
  }

  const text = typeof body.body === "string" ? body.body : "";
  if (!text.trim()) return NextResponse.json({ error: "Write something first." }, { status: 400 });
  if (text.length > 4000)
    return NextResponse.json({ error: "That note is too long." }, { status: 400 });

  const at =
    typeof body.atSeconds === "number" && Number.isFinite(body.atSeconds) ? body.atSeconds : null;

  const { data: me } = await db
    .from("admins")
    .select("name")
    .eq("email", admin.email)
    .maybeSingle();

  const res = await addComment(db, {
    deliverableId,
    side: "studio",
    email: admin.email,
    name: (me?.name as string | null) ?? null,
    body: text,
    atSeconds: at,
    parentId: typeof body.parentId === "string" ? body.parentId : null,
  });
  if (!res) return NextResponse.json({ error: "Could not post that." }, { status: 400 });

  // tell the client somebody answered
  const { data: order } = await db
    .from("orders")
    .select("customer_email")
    .eq("id", id)
    .maybeSingle();
  if (order?.customer_email) {
    const where = stamp(res.comment.at_seconds);
    await pushNotification(db, {
      audience: "customer",
      email: order.customer_email as string,
      kind: "video_reply",
      title: `A reply on ${video.title}`,
      body: `${where ? `At ${where}: ` : ""}${text.slice(0, 140)}`,
      href: "/portal/videos/",
      feature: "orders",
    });
    const { sendVideoReplyEmail } = await import("@/lib/email/notify");
    await sendVideoReplyEmail(db, deliverableId, text);
  }

  return NextResponse.json({ ok: true });
}
