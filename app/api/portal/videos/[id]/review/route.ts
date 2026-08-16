import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { contextCan, resolvePortalContext } from "@/lib/account-team";
import { isWatchable, type DeliverableStatus } from "@/lib/deliverable-status";
import { addComment, clientVerdict, listComments, stamp } from "@/lib/review";
import { listVersions } from "@/lib/versions";
import { pushOrderOwnerNotification } from "@/lib/notifications";

export const runtime = "nodejs";

/*
 * The client's side of a review: read the thread on one of their videos, add a
 * note, approve it, or ask for changes.
 *
 * Every route here re-checks that the video belongs to an order under the
 * acting account's email. The id in the URL comes from the browser, so being
 * signed in is not on its own permission to touch a given video.
 */
async function guard(req: Request, deliverableId: string) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx) return { fail: NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus }) };
  if (!contextCan(ctx, "orders"))
    return { fail: NextResponse.json({ error: "You do not have access to orders." }, { status: 403 }) };

  const { data: d } = await db
    .from("order_deliverables")
    .select("id, order_id, status, title, revision_round")
    .eq("id", deliverableId)
    .maybeSingle();
  if (!d) return { fail: NextResponse.json({ error: "Not found." }, { status: 404 }) };

  // the video must hang off an order this account actually owns
  const { data: order } = await db
    .from("orders")
    .select("id, customer_email, status")
    .eq("id", d.order_id)
    .eq("customer_email", ctx.ownerEmail)
    .maybeSingle();
  if (!order) return { fail: NextResponse.json({ error: "Not found." }, { status: 404 }) };

  return { db, ctx, deliverable: d, order };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(req, id);
  if ("fail" in g) return g.fail;

  const comments = await listComments(g.db, id);
  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      side: c.author_side,
      name: c.author_name ?? (c.author_side === "studio" ? "GHL Video" : "You"),
      body: c.body,
      atSeconds: c.at_seconds,
      stamp: stamp(c.at_seconds),
      round: c.revision_round,
      version: c.version,
      parentId: c.parent_id,
      resolved: Boolean(c.resolved_at),
      createdAt: c.created_at,
    })),
    versions: (await listVersions(g.db, id)).map((v) => ({
      id: v.id,
      version: v.version,
      videoUrl: v.video_url,
      note: v.note,
      createdAt: v.created_at,
    })),
    status: g.deliverable.status,
    round: g.deliverable.revision_round,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(req, id);
  if ("fail" in g) return g.fail;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "comment";

  // A client can only review something they can actually watch.
  if (!isWatchable(g.deliverable.status as DeliverableStatus)) {
    return NextResponse.json({ error: "That video is not ready to review yet." }, { status: 400 });
  }

  const who = g.ctx.ownerEmail;
  // profiles keys the person's name as display_name; asking for "name" here
  // returns nothing and every note would sign itself with an email address
  const { data: profile } = await g.db
    .from("profiles")
    .select("display_name")
    .eq("email", who)
    .maybeSingle();
  const { data: cust } = await g.db
    .from("customers")
    .select("name")
    .eq("email", who)
    .maybeSingle();
  const name =
    (profile?.display_name as string | null) ?? (cust?.name as string | null) ?? null;

  if (action === "comment") {
    const text = typeof body.body === "string" ? body.body : "";
    if (!text.trim()) return NextResponse.json({ error: "Write something first." }, { status: 400 });
    if (text.length > 4000)
      return NextResponse.json({ error: "That note is too long." }, { status: 400 });

    const at =
      typeof body.atSeconds === "number" && Number.isFinite(body.atSeconds)
        ? body.atSeconds
        : null;

    const res = await addComment(g.db, {
      deliverableId: id,
      side: "client",
      email: who,
      name,
      body: text,
      atSeconds: at,
      parentId: typeof body.parentId === "string" ? body.parentId : null,
    });
    if (!res) return NextResponse.json({ error: "Could not post that." }, { status: 400 });

    const where = stamp(res.comment.at_seconds);
    await pushOrderOwnerNotification(g.db, g.order.id as string, {
      kind: "video_feedback",
      title: `Feedback on ${g.deliverable.title}`,
      body: `${name || who}${where ? ` at ${where}` : ""}: ${text.slice(0, 140)}`,
      href: "/admin/production/",
    });

    // The bell alone meant feedback could sit unseen for a day if nobody had
    // the admin open. Fail-soft: a mail problem must not lose the note.
    const { sendVideoFeedbackAlert } = await import("@/lib/email/notify");
    await sendVideoFeedbackAlert(g.db, {
      deliverableId: id,
      kind: "comment",
      customerName: name || who,
      message: text,
      where,
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "approve" || action === "changes") {
    const res = await clientVerdict(g.db, id, action, who);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });

    await g.db.from("order_events").insert({
      order_id: g.order.id,
      event_type: action === "approve" ? "client_approved_video" : "client_requested_changes",
      payload: { deliverable_id: id, by: who },
    });

    await pushOrderOwnerNotification(g.db, g.order.id as string, {
      kind: action === "approve" ? "video_approved" : "video_changes",
      title:
        action === "approve"
          ? `Approved: ${g.deliverable.title}`
          : `Changes requested: ${g.deliverable.title}`,
      body: `${name || who} ${action === "approve" ? "approved this video." : "asked for changes."}`,
      href: "/admin/production/",
    });

    const { sendVideoFeedbackAlert } = await import("@/lib/email/notify");
    await sendVideoFeedbackAlert(g.db, {
      deliverableId: id,
      kind: action === "approve" ? "approved" : "changes",
      customerName: name || who,
      message:
        action === "approve"
          ? "They approved this video."
          : "They asked for changes. Their notes are on the job.",
    });

    return NextResponse.json({ ok: true, status: res.status });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
