import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { contextCan, resolvePortalContext, actorName } from "@/lib/account-team";
import { isWatchable, type DeliverableStatus } from "@/lib/deliverable-status";
import {
  approveStation,
  normalizePipeline,
  returnStation,
  statusForPipeline,
} from "@/lib/pipeline";
import { addComment, clientVerdict, listComments, stamp } from "@/lib/review";
import { listVersions } from "@/lib/versions";
import { pushAdminNotifications, pushOrderOwnerNotification } from "@/lib/notifications";

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

  const { data: d } = await db
    .from("order_deliverables")
    .select("id, order_id, project_id, cycle_id, category, status, title, revision_round")
    .eq("id", deliverableId)
    .maybeSingle();
  if (!d) return { fail: NextResponse.json({ error: "Not found." }, { status: 404 }) };

  /*
   * The video must hang off work this account actually owns, and a video can
   * hang off any of THREE things: an order, a custom project, or a month of
   * an editing plan. Being signed in is not on its own permission.
   *
   * The editing branch was missing, which made every delivered editing video
   * un-approvable: the guard fell through to 404 and the client was shown
   * "Not found." on their own video. The feature gate moved below the lookup
   * for the same reason, because which grant applies depends on which kind of
   * work this is: plan work answers to `subscriptions`, not to `orders`.
   */
  const gate = (feature: string) =>
    contextCan(ctx, feature)
      ? null
      : { fail: NextResponse.json({ error: "You do not have access to this." }, { status: 403 }) };

  if (d.order_id) {
    const denied = gate("orders");
    if (denied) return denied;
    const { data: order } = await db
      .from("orders")
      .select("id, customer_email, status")
      .eq("id", d.order_id)
      .eq("customer_email", ctx.ownerEmail)
      .maybeSingle();
    if (!order) return { fail: NextResponse.json({ error: "Not found." }, { status: 404 }) };
    return { db, ctx, deliverable: d, order };
  }
  if (d.project_id) {
    const denied = gate("orders");
    if (denied) return denied;
    const { data: project } = await db
      .from("projects")
      .select("id, customer_email")
      .eq("id", d.project_id)
      .ilike("customer_email", ctx.ownerEmail)
      .maybeSingle();
    if (!project) return { fail: NextResponse.json({ error: "Not found." }, { status: 404 }) };
    return { db, ctx, deliverable: d, order: null };
  }
  if (d.cycle_id) {
    const denied = gate("subscriptions");
    if (denied) return denied;
    const { data: cycle } = await db
      .from("subscription_cycles")
      .select("id, subscription:subscriptions!inner(customer_email)")
      .eq("id", d.cycle_id)
      .maybeSingle();
    const owner =
      (cycle?.subscription as unknown as { customer_email?: string } | null)?.customer_email ?? "";
    if (!owner || owner.toLowerCase() !== ctx.ownerEmail.toLowerCase())
      return { fail: NextResponse.json({ error: "Not found." }, { status: 404 }) };
    return { db, ctx, deliverable: d, order: null };
  }
  return { fail: NextResponse.json({ error: "Not found." }, { status: 404 }) };
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

  /*
   * Who is doing this, which is not the same as whose account it is. Both of
   * these were the owner's email and the owner's name, so a note or an
   * approval by a teammate went into the record signed by the account owner.
   * Emma approved a cut for HighLevel and it read as Chase.
   */
  const who = g.ctx.selfEmail;
  const name = await actorName(g.db, g.ctx);

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
    /* an order routes to whoever owns that job; plan work has no order, so it
       goes to the whole team rather than nowhere */
    const bell = {
      kind: "video_feedback" as const,
      title: `Feedback on ${g.deliverable.title}`,
      body: `${name || who}${where ? ` at ${where}` : ""}: ${text.slice(0, 140)}`,
      href: g.deliverable.cycle_id ? "editing" : "production",
      vars: {
        video_title: String(g.deliverable.title),
        summary: `${name || who}${where ? ` at ${where}` : ""}: ${text.slice(0, 140)}`,
        customer_name: name || who,
      },
    };
    if (g.order) await pushOrderOwnerNotification(g.db, g.order.id as string, bell);
    else await pushAdminNotifications(g.db, bell);

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

    /*
     * The main video of a custom project carries the six-station line ON
     * THE PROJECT, and this review screen is its animation and delivery
     * gate. Approving the draft closes that station and hands sound to us;
     * only approving delivery finishes the job. The project's list category
     * follows along on its own, so the list stays honest without anybody
     * filing it: changes land it in Revision, a finished delivery in
     * Approved.
     */
    if (g.deliverable.project_id && String(g.deliverable.category ?? "") === "main") {
      const { data: project } = await g.db
        .from("projects")
        .select("id, status, pipeline")
        .eq("id", g.deliverable.project_id)
        .single();
      const line = normalizePipeline(project?.pipeline);
      const now = new Date().toISOString();
      const key = line.delivery.state === "with_client" ? "delivery" : "animation";
      const { data: fresh } = await g.db
        .from("order_deliverables")
        .select("revision_round")
        .eq("id", id)
        .single();
      const round = Number(fresh?.revision_round ?? 0);
      const line2 =
        action === "approve" ? approveStation(line, key, now) : returnStation(line, key, now);
      const derived = statusForPipeline(line2, round);

      await g.db
        .from("projects")
        .update({ pipeline: line2 })
        .eq("id", g.deliverable.project_id);
      await g.db
        .from("order_deliverables")
        .update({ status: derived, updated_at: now })
        .eq("id", id);
      const { syncProjectState } = await import("@/lib/project-station");
      await syncProjectState(g.db, String(g.deliverable.project_id), line2);
      (res as { status: string }).status = derived;
    }

    if (g.order)
      await g.db.from("order_events").insert({
        order_id: g.order.id,
        event_type: action === "approve" ? "client_approved_video" : "client_requested_changes",
        payload: { deliverable_id: id, by: who },
      });

    const verdictBell = {
      kind: action === "approve" ? "video_approved" : "video_changes",
      title:
        action === "approve"
          ? `Approved: ${g.deliverable.title}`
          : `Changes requested: ${g.deliverable.title}`,
      body: `${name || who} ${action === "approve" ? "approved this video." : "asked for changes."}`,
      href: g.deliverable.cycle_id ? "editing" : "production",
      vars: { video_title: String(g.deliverable.title), who: name || who },
    };
    if (g.order) await pushOrderOwnerNotification(g.db, g.order.id as string, verdictBell);
    else await pushAdminNotifications(g.db, verdictBell);

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
