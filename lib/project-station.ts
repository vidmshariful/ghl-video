import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizePipeline,
  STATION_ORDER,
  STATIONS,
  type StationKey,
  type StationState,
} from "@/lib/pipeline";
import { addVersion } from "@/lib/versions";

/*
 * The project-level half of the production line: move a station, keep its
 * file, hand it to the client, take an animation draft.
 *
 * The line lives on the PROJECT (a project is the video, owner decision of
 * 21 August 2026), but drafts, timestamped review notes and the revision
 * counter stay on one invisible deliverable row per project, category
 * "main", so the whole review machine kept working without moving tables.
 * ensureMainCarrier is what makes that row exist the first time anything
 * needs it.
 */

type DB = SupabaseClient;
type Row = Record<string, unknown>;
type Out = { status: number; body: Record<string, unknown> };

export async function ensureMainCarrier(db: DB, projectId: string): Promise<string | null> {
  const { data: existing } = await db
    .from("order_deliverables")
    .select("id")
    .eq("project_id", projectId)
    .eq("category", "main")
    .maybeSingle();
  if (existing?.id) return String(existing.id);

  const { data: project } = await db
    .from("projects")
    .select("title")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return null;

  const { data: made, error } = await db
    .from("order_deliverables")
    .insert({
      project_id: projectId,
      title: String(project.title),
      category: "main",
      status: "queued",
      position: 0,
    })
    .select("id")
    .single();
  if (error) return null;
  return String(made.id);
}

const stationOf = (v: unknown): StationKey | null =>
  typeof v === "string" && (STATION_ORDER as string[]).includes(v) ? (v as StationKey) : null;

export async function handleStationOp(
  db: DB,
  projectId: string,
  st: Record<string, unknown>,
): Promise<Out> {
  const key = stationOf(st.key);
  if (!key) return { status: 400, body: { error: "Which station?" } };

  const { data: project } = await db
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { status: 404, body: { error: "Not found." } };

  const line = normalizePipeline((project as Row).pipeline);
  const now = new Date().toISOString();

  const next = { ...line[key] };
  const state = st.state;
  if (state === "todo" || state === "with_us" || state === "with_client" || state === "done") {
    next.state = state as StationState;
    next.at = now;
  }
  if ("url" in st) next.url = typeof st.url === "string" && st.url.trim() ? st.url.trim() : null;
  if ("provided" in st && STATIONS[key].providable) next.provided = Boolean(st.provided);
  if ("gate" in st) next.gate = Boolean(st.gate);
  if ("eta" in st)
    next.eta = typeof st.eta === "string" && st.eta ? new Date(st.eta).toISOString() : null;

  const line2 = normalizePipeline({ ...line, [key]: next });
  const { error } = await db.from("projects").update({ pipeline: line2 }).eq("id", projectId);
  if (error) return { status: 400, body: { error: error.message } };

  /* the animation and delivery files are what the client watches, so they
     mirror onto the main carrier the review machine reads */
  if ((key === "animation" || key === "delivery") && next.url) {
    const mainId = await ensureMainCarrier(db, projectId);
    if (mainId)
      await db.from("order_deliverables").update({ video_url: next.url }).eq("id", mainId);
  }

  if (st.requestApproval === true) {
    if (!line2[key].url && key !== "delivery")
      return { status: 200, body: { ok: true, warning: "No file on that station yet." } };
    /* handing the big pieces to the client files the job under Review on
       its own, so the list stays honest without a second click */
    if (
      (key === "animation" || key === "delivery") &&
      !["closed", "cancelled"].includes(String((project as Row).status))
    )
      await db.from("projects").update({ status: "review" }).eq("id", projectId);
    const email = String((project as Row).customer_email ?? "");
    const { data: cust } = await db
      .from("customers")
      .select("name")
      .ilike("email", email)
      .maybeSingle();
    const { sendApprovalRequestEmail } = await import("@/lib/email/notify");
    await sendApprovalRequestEmail(db, {
      email,
      name: (cust?.name as string | null) ?? null,
      videoTitle: String((project as Row).title ?? "your video"),
      stageLabel: STATIONS[key].label,
    });
    const { pushNotification } = await import("@/lib/notifications");
    await pushNotification(db, {
      audience: "customer",
      email,
      kind: "approval_request",
      title: `Your review: ${STATIONS[key].label}`,
      body: `${String((project as Row).title ?? "Your project")} is waiting on your approval.`,
      href: "custom",
    });
  }
  return { status: 200, body: { ok: true } };
}

export async function handleAddDraft(
  db: DB,
  projectId: string,
  url: string | null,
  note: string | null,
  by: string,
): Promise<Out> {
  if (!url) return { status: 400, body: { error: "Paste the draft link first." } };
  const mainId = await ensureMainCarrier(db, projectId);
  if (!mainId) return { status: 404, body: { error: "Not found." } };

  const v = await addVersion(db, mainId, url, by, note);
  if (!v) return { status: 400, body: { error: "That link is already the current draft." } };

  const { data: project } = await db
    .from("projects")
    .select("pipeline")
    .eq("id", projectId)
    .single();
  const line = normalizePipeline((project as Row | null)?.pipeline);
  const now = new Date().toISOString();
  const line2 = normalizePipeline({
    ...line,
    animation: {
      ...line.animation,
      url,
      at: now,
      state: line.animation.state === "todo" ? "with_us" : line.animation.state,
    },
  });
  await db.from("projects").update({ pipeline: line2 }).eq("id", projectId);
  await db.from("order_deliverables").update({ video_url: url }).eq("id", mainId);
  return { status: 200, body: { ok: true, version: v.version } };
}
