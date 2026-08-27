import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { actorName, contextCan, resolvePortalContext } from "@/lib/account-team";
import {
  STATIONS,
  approveStation,
  normalizePipeline,
  returnStation,
  type ReviewMedium,
  type StationKey,
} from "@/lib/pipeline";
import { ensureMainCarrier, syncProjectState } from "@/lib/project-station";
import { addComment, stamp } from "@/lib/review";

export const runtime = "nodejs";

/*
 * One production-line stage, reviewed.
 *
 * The client reads the script, hears the voiceover, opens the design PDF,
 * watches the animation or the final cut, and says what they think on each.
 * Every note lives on the project's main carrier deliverable, tagged with
 * the stage it is about, so a stage's review room shows only its own.
 *
 * Approving is only for the two video gates, animation and final delivery:
 * those move the line. The rest are review and comment, never a formal sign
 * off, by decision. Sound design has nothing to show, so it is not reviewable.
 */

const mediumOf = (key: StationKey): ReviewMedium | null => STATIONS[key].reviewMedium;

const isStage = (v: unknown): v is StationKey =>
  typeof v === "string" && v in STATIONS && STATIONS[v as StationKey].reviewMedium !== null;

async function guard(req: Request, id: string) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return { fail: NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus }) };
  if (!contextCan(ctx, "orders"))
    return { fail: NextResponse.json({ error: "You do not have access to this." }, { status: 403 }) };

  const { data: project } = await db
    .from("projects")
    .select("id, title, customer_email, pipeline")
    .eq("id", id)
    .ilike("customer_email", ctx.ownerEmail)
    .maybeSingle();
  if (!project) return { fail: NextResponse.json({ error: "Not found." }, { status: 404 }) };

  /* the person at the keyboard, not the account they are working in. This
     read the customer row by ownerEmail, so every note a teammate left was
     signed with the account owner's name. */
  const name = await actorName(db, ctx);

  return { db, ctx, project, name };
}

/* a stage's notes: its own, plus the legacy untagged video notes on animation */
async function stageComments(
  db: ReturnType<typeof supabaseAdmin>,
  carrierId: string,
  stage: StationKey,
) {
  let q = db
    .from("deliverable_comments")
    .select("id, author_side, author_name, body, at_seconds, stage, parent_id, resolved_at, created_at")
    .eq("deliverable_id", carrierId)
    .order("created_at", { ascending: true });
  q = stage === "animation" ? q.or("stage.eq.animation,stage.is.null") : q.eq("stage", stage);
  const { data } = await q;
  return (data ?? []).map((c: Record<string, unknown>) => ({
    id: String(c.id),
    side: String(c.author_side) === "studio" ? "studio" : "client",
    name:
      (c.author_name as string | null) ??
      (String(c.author_side) === "studio" ? "GHL Video" : "You"),
    body: String(c.body),
    atSeconds: (c.at_seconds as number | null) ?? null,
    stamp: stamp((c.at_seconds as number | null) ?? null),
    parentId: (c.parent_id as string | null) ?? null,
    resolved: Boolean(c.resolved_at),
    at: String(c.created_at),
  }));
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(req, id);
  if ("fail" in g) return g.fail;

  const stage = new URL(req.url).searchParams.get("stage") ?? "";
  if (!isStage(stage))
    return NextResponse.json({ error: "That is not a stage you can review." }, { status: 400 });

  const line = normalizePipeline(g.project.pipeline);
  const st = line[stage];
  const carrierId = await ensureMainCarrier(g.db, id);
  const comments = carrierId ? await stageComments(g.db, carrierId, stage) : [];

  const video = stage === "animation" || stage === "delivery";
  return NextResponse.json({
    stage,
    label: STATIONS[stage].label,
    medium: mediumOf(stage),
    url: st.url ?? null,
    state: st.state,
    provided: Boolean(st.provided),
    /* the client only formally signs off the two video gates, and only while
       the cut is actually with them */
    canApprove: video && st.state === "with_client" && Boolean(st.gate),
    comments,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(req, id);
  if ("fail" in g) return g.fail;

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const stage = typeof b.stage === "string" ? b.stage : "";
  if (!isStage(stage))
    return NextResponse.json({ error: "That is not a stage you can review." }, { status: 400 });

  const carrierId = await ensureMainCarrier(g.db, id);
  if (!carrierId) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const action = b.action === "approve" || b.action === "changes" ? b.action : "comment";
  const text = typeof b.body === "string" ? b.body.trim().slice(0, 4000) : "";
  /* only a real number is a timestamp. JSON null coerces to 0 through Number(),
     which would stamp every doc and PDF note at 0:00, so guard on the type. */
  const atSeconds =
    typeof b.atSeconds === "number" && Number.isFinite(b.atSeconds) && b.atSeconds >= 0
      ? b.atSeconds
      : null;
  const parentId = typeof b.parentId === "string" ? b.parentId : null;

  /* approve / request changes: only the two video gates move the line */
  if (action === "approve" || action === "changes") {
    if (stage !== "animation" && stage !== "delivery")
      return NextResponse.json(
        { error: "This stage is reviewed with feedback, not a formal approval." },
        { status: 400 },
      );
    const line = normalizePipeline(g.project.pipeline);
    if (line[stage].state !== "with_client")
      return NextResponse.json({ error: "That is not waiting on you right now." }, { status: 400 });

    const now = new Date().toISOString();
    const line2 =
      action === "approve" ? approveStation(line, stage, now) : returnStation(line, stage, now);
    const { error } = await g.db.from("projects").update({ pipeline: line2 }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await syncProjectState(g.db, id, line2);

    if (action === "changes" && text) {
      await addComment(g.db, {
        deliverableId: carrierId,
        side: "client",
        email: g.ctx.ownerEmail,
        name: g.name,
        body: text,
        atSeconds,
        stage,
      });
    }
    const { pushAdminNotifications } = await import("@/lib/notifications");
    await pushAdminNotifications(g.db, {
      kind: action === "approve" ? "stage_approved" : "stage_changes",
      title: `${STATIONS[stage].label} ${action === "approve" ? "approved" : "sent back"}: ${String(g.project.title)}`,
      body: text ? text.slice(0, 140) : `By ${g.ctx.ownerEmail}.`,
      href: `custom/${id}`,
      vars: {
        stage_label: STATIONS[stage].label,
        project_title: String(g.project.title),
        note: text ? text.slice(0, 140) : `By ${g.ctx.ownerEmail}.`,
        customer_email: g.ctx.ownerEmail,
      },
    });
    /* the producer's inbox, not only the bell: a verdict can wait a day on a
       bell nobody had open */
    const { sendProjectFeedbackAlert } = await import("@/lib/email/notify");
    await sendProjectFeedbackAlert(g.db, {
      projectId: id,
      kind: action === "approve" ? "approved" : "changes",
      stageLabel: STATIONS[stage].label,
      customerName: g.name,
      customerEmail: g.ctx.ownerEmail,
      message: text,
    });
    return NextResponse.json({ ok: true });
  }

  /* a plain comment on the stage, the feedback path for every medium */
  if (!text) return NextResponse.json({ error: "Write something first." }, { status: 400 });
  await addComment(g.db, {
    deliverableId: carrierId,
    side: "client",
    email: g.ctx.ownerEmail,
    name: g.name,
    body: text,
    atSeconds,
    stage,
    parentId,
  });
  const { pushAdminNotifications } = await import("@/lib/notifications");
  await pushAdminNotifications(g.db, {
    kind: "stage_feedback",
    title: `Feedback on ${STATIONS[stage].label}: ${String(g.project.title)}`,
    body: text.slice(0, 140),
    href: `custom/${id}`,
    vars: {
      stage_label: STATIONS[stage].label,
      project_title: String(g.project.title),
      note: text.slice(0, 140),
      customer_email: g.ctx.ownerEmail,
    },
  });
  if (!parentId) {
    const { sendProjectFeedbackAlert } = await import("@/lib/email/notify");
    await sendProjectFeedbackAlert(g.db, {
      projectId: id,
      kind: "comment",
      stageLabel: STATIONS[stage].label,
      customerName: g.name,
      customerEmail: g.ctx.ownerEmail,
      message: text,
    });
  }
  return NextResponse.json({ ok: true });
}
