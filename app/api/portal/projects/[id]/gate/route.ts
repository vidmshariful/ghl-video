import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { contextCan, resolvePortalContext } from "@/lib/account-team";
import {
  approveStation,
  normalizePipeline,
  returnStation,
  STATIONS,
  type StationKey,
} from "@/lib/pipeline";
import { ensureMainCarrier, syncProjectState } from "@/lib/project-station";
import { addComment } from "@/lib/review";
import { pushAdminNotifications } from "@/lib/notifications";

export const runtime = "nodejs";

/*
 * The client's word at a non-video gate on their PROJECT: approve the
 * script, the voiceover or the design, or send it back with a note.
 * Animation and delivery go through the review screen, which needs the
 * player and the timestamped thread.
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

  const { data: project } = await db
    .from("projects")
    .select("*")
    .eq("id", id)
    .ilike("customer_email", ctx.ownerEmail)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const line = normalizePipeline(project.pipeline);
  if (line[key].state !== "with_client")
    return NextResponse.json(
      { error: "That piece is not waiting on you right now." },
      { status: 400 },
    );

  const now = new Date().toISOString();
  const line2 = action === "approve" ? approveStation(line, key, now) : returnStation(line, key, now);
  const { error } = await db.from("projects").update({ pipeline: line2 }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await syncProjectState(db, id, line2);

  if (note) {
    const mainId = await ensureMainCarrier(db, id);
    if (mainId)
      await addComment(db, {
        deliverableId: mainId,
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
        ? `${label} approved: ${String(project.title)}`
        : `${label} sent back: ${String(project.title)}`,
    body: note ? note.slice(0, 140) : `By ${ctx.ownerEmail}.`,
    href: "/admin/production/",
  });

  return NextResponse.json({ ok: true });
}
