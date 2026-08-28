import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { addComment, listComments, resolveComment, stamp } from "@/lib/review";
import { pushNotification } from "@/lib/notifications";

export const runtime = "nodejs";

/*
 * The studio's side of a review thread, addressed by the VIDEO.
 *
 * The order-scoped route next door can only reach a video that belongs to an
 * order. An editing plan's videos belong to a billing cycle and have no order
 * at all, so a client's notes on them could be written, emailed out as a
 * notification, and then read by nobody: the board had no way to ask for
 * them. Clients were leaving feedback into what looked, from this side, like
 * silence.
 *
 * Addressing a video directly works whoever owns it, which is the honest
 * shape. The order route stays as it is because it also answers the per job
 * badge counts, and this one is not trying to replace it.
 *
 * The scoping the other route gets from the order id is not a permission
 * boundary here: an admin may read every video in the system either way. It
 * only ever stopped an id from one order being answered through another
 * order's URL, which is not a thing this route offers.
 */
async function videoById(deliverableId: string) {
  const db = supabaseAdmin();
  const { data } = await db
    .from("order_deliverables")
    .select("id, title, order_id, project_id, cycle_id")
    .eq("id", deliverableId)
    .maybeSingle();
  return { db, video: data };
}

/** Whoever should hear that we answered, across all three kinds of owner. */
async function clientEmail(
  db: ReturnType<typeof supabaseAdmin>,
  video: Record<string, unknown>,
): Promise<string | null> {
  if (video.order_id) {
    const { data } = await db
      .from("orders")
      .select("customer_email")
      .eq("id", video.order_id as string)
      .maybeSingle();
    return (data?.customer_email as string | null) ?? null;
  }
  if (video.project_id) {
    const { data } = await db
      .from("projects")
      .select("customer_email")
      .eq("id", video.project_id as string)
      .maybeSingle();
    return (data?.customer_email as string | null) ?? null;
  }
  if (video.cycle_id) {
    const { data } = await db
      .from("subscription_cycles")
      .select("subscription:subscriptions!inner(customer_email)")
      .eq("id", video.cycle_id as string)
      .maybeSingle();
    return (
      (data?.subscription as { customer_email?: string } | null)?.customer_email ?? null
    );
  }
  return null;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const { db, video } = await videoById(id);
  if (!video) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const comments = await listComments(db, id);
  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      side: c.author_side,
      name: c.author_name ?? (c.author_side === "studio" ? "GHL Video" : c.author_email),
      body: c.body,
      atSeconds: c.at_seconds,
      stamp: stamp(c.at_seconds),
      parentId: c.parent_id,
      resolved: Boolean(c.resolved_at),
      createdAt: c.created_at,
    })),
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const { db, video } = await videoById(id);
  if (!video) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  /* marking one dealt with, which is the whole point of a thread the studio
     actually works from rather than only reads */
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
    deliverableId: id,
    side: "studio",
    email: admin.email,
    name: (me?.name as string | null) ?? null,
    body: text,
    atSeconds: at,
    parentId: typeof body.parentId === "string" ? body.parentId : null,
  });
  if (!res) return NextResponse.json({ error: "Could not post that." }, { status: 400 });

  /* tell the client somebody answered. Fail soft: losing the bell must never
     cost us the reply itself, which is already saved by here. */
  const email = await clientEmail(db, video);
  if (email) {
    const where = stamp(res.comment.at_seconds);
    const summary = `${where ? `At ${where}: ` : ""}${text.slice(0, 140)}`;
    await pushNotification(db, {
      audience: "customer",
      email,
      kind: "video_reply",
      title: `A reply on ${video.title}`,
      body: summary,
      /* a plan video lives on the editing screen, not under My videos */
      href: video.cycle_id ? "editing" : "videos",
      vars: { video_title: String(video.title), summary },
      feature: video.cycle_id ? "subscriptions" : "orders",
    });
    const { sendVideoReplyEmail } = await import("@/lib/email/notify");
    await sendVideoReplyEmail(db, id, text);
  }

  return NextResponse.json({ ok: true });
}
