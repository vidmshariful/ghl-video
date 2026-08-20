import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { contextCan, resolvePortalContext } from "@/lib/account-team";
import {
  approveStation,
  normalizePipeline,
  returnStation,
  statusForPipeline,
  STATIONS,
  type StationKey,
} from "@/lib/pipeline";
import { addComment } from "@/lib/review";
import { pushAdminNotifications } from "@/lib/notifications";

export const runtime = "nodejs";

/*
 * The client's word at a non-video gate: approve the script, the voiceover
 * or the design, or send it back with a note. Animation and final delivery
 * go through the review screen instead, because those need the player and
 * the timestamped thread.
 *
 * A note rides along either way and lands in the video's review thread, so
 * Tanvir reads everything in one place whatever station it was written at.
 */

const GATE_KEYS: StationKey[] = ["script", "voiceover", "design"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });
  if (!contextCan(ctx, "orders"))
    return NextResponse.json({ error: "You do not have access to this." }, { status: 403 });

  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const key = b.stage as StationKey;
  const action = b.action;
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 4000) : "";

  if (!GATE_KEYS.includes(key))
    return NextResponse.json({ error: "That is not a stage you approve here." }, { status: 400 });
  if (action !== "approve" && action !== "changes")
    return NextResponse.json({ error: "Approve it or ask for changes." }, { status: 400 });
  if (action === "changes" && !note)
    return NextResponse.json({ error: "Tell us what to change first." }, { status: 400 });

  const { data: d } = await db
    .from("order_deliverables")
    .select("id, project_id, title, revision_round, pipeline")
    .eq("id", id)
    .maybeSingle();
  if (!d?.project_id) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data: project } = await db
    .from("projects")
    .select("id, customer_email")
    .eq("id", d.project_id)
    .ilike("customer_email", ctx.ownerEmail)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const line = normalizePipeline(d.pipeline);
  if (line[key].state !== "with_client")
    return NextResponse.json({ error: "That piece is not waiting on you right now." }, { status: 400 });

  const now = new Date().toISOString();
  const line2 = action === "approve" ? approveStation(line, key, now) : returnStation(line, key, now);
  const { error } = await db
    .from("order_deliverables")
    .update({
      pipeline: line2,
      status: statusForPipeline(line2, Number(d.revision_round ?? 0)),
      updated_at: now,
    })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (note) {
    await addComment(db, {
      deliverableId: id,
      side: "client",
      email: ctx.ownerEmail,
      name: null,
      body: `[${STATIONS[key].label}] ${note}`,
      atSeconds: null,
      parentId: null,
    });
  }

  const label = STATIONS[key].label;
  await pushAdminNotifications(db, {
    kind: action === "approve" ? "stage_approved" : "stage_changes",
    title:
      action === "approve"
        ? `${label} approved: ${String(d.title)}`
        : `${label} sent back: ${String(d.title)}`,
    body: note ? note.slice(0, 140) : `By ${ctx.ownerEmail}.`,
    href: "/admin/production/",
  });

  const { sendVideoFeedbackAlert } = await import("@/lib/email/notify");
  await sendVideoFeedbackAlert(db, {
    deliverableId: id,
    kind: action === "approve" ? "approved" : "changes",
    customerName: ctx.ownerEmail,
    message:
      action === "approve"
        ? `They approved the ${label.toLowerCase()}.`
        : `They sent the ${label.toLowerCase()} back: ${note.slice(0, 300)}`,
  });

  return NextResponse.json({ ok: true });
}
