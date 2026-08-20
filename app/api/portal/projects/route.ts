import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { resolvePortalContext } from "@/lib/account-team";
import { CLIENT_LABEL, isOpen, type ProjectStatus } from "@/lib/projects";
import {
  canRequestChanges,
  canReview,
  isWatchable,
  REVISIONS_INCLUDED,
  type DeliverableStatus,
} from "@/lib/deliverable-status";
import {
  ballInCourt,
  clientStationWord,
  currentStation,
  normalizePipeline,
  pipelinePercent,
  STATION_ORDER,
  STATIONS,
} from "@/lib/pipeline";

export const runtime = "nodejs";

/*
 * The client's own custom work.
 *
 * Until now a custom client's portal was empty: their job had no order, so it
 * had no videos, so every screen showed them nothing while we were actively
 * making something for them.
 *
 * They see the client vocabulary, never ours. "Scoped" is a studio word that
 * a client reads as "you have not started", and "with client" is meaningless
 * from their side. Money is deliberately absent here: what they owe belongs
 * on an invoice they can actually pay, not scattered through a status screen.
 */

type Row = Record<string, unknown>;

export async function GET(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx) return NextResponse.json({ projects: [] });

  const { data: projects } = await db
    .from("projects")
    .select("id, title, brief, status, due_at, created_at")
    .ilike("customer_email", ctx.ownerEmail)
    .order("created_at", { ascending: false });

  const ids = ((projects ?? []) as Row[]).map((p) => String(p.id));
  const { data: videos } = ids.length
    ? await db
        .from("order_deliverables")
        /* select * so this runs the same before and after the pipeline
           column exists; normalizePipeline treats missing as a fresh line */
        .select("*")
        .in("project_id", ids)
        .order("position")
    : { data: [] };

  return NextResponse.json({
    projects: ((projects ?? []) as Row[])
      /* a cancelled job is not something to show somebody who is paying us */
      .filter((p) => String(p.status) !== "cancelled")
      .map((p) => {
        const status = String(p.status) as ProjectStatus;
        return {
          id: String(p.id),
          title: String(p.title),
          brief: (p.brief as string | null) ?? null,
          status,
          statusLabel: CLIENT_LABEL[status],
          open: isOpen(status),
          dueAt: (p.due_at as string | null) ?? null,
          createdAt: String(p.created_at),
          videos: mine(videos, p).map((v) => {
            const vs = v.status as DeliverableStatus;
            return {
              id: String(v.id),
              title: String(v.title),
              brief: (v.note as string | null) ?? null,
              status: vs,
              dueAt: (v.due_at as string | null) ?? null,
              thumbnailUrl: (v.thumbnail_url as string | null) ?? null,
              /* withheld until it is genuinely watchable, the same rule the
               * rest of the portal follows */
              videoUrl: isWatchable(vs) ? ((v.video_url as string | null) ?? null) : null,
              canReview: canReview(vs),
              canRequestChanges: canRequestChanges(vs, Number(v.revision_round ?? 0)),
              revisionsIncluded: REVISIONS_INCLUDED,
              revisionsUsed: Number(v.revision_round ?? 0),
              /* the six-station production line, in the client's words.
                 Sound is shown but never handed over as a file. */
              pipeline: (() => {
                const line = normalizePipeline(v.pipeline);
                return {
                  ball: ballInCourt(line),
                  percent: pipelinePercent(line),
                  current: currentStation(line),
                  stations: STATION_ORDER.map((k) => ({
                    key: k,
                    label: STATIONS[k].label,
                    state: line[k].state,
                    word: clientStationWord(k, line[k]),
                    gated: Boolean(line[k].gate) && !line[k].provided,
                    url: STATIONS[k].clientFile ? (line[k].url ?? null) : null,
                    at: line[k].at ?? null,
                  })),
                };
              })(),
            };
          }),
          /* What has actually happened, built from the timestamps the work
           * already carries. No separate activity table to fall out of step
           * with the thing it describes, and nothing in it that did not
           * really happen. */
          activity: activityFor(p, mine(videos, p)),
        };
      }),
  });
}

function mine(videos: Row[] | null, project: Row): Row[] {
  return ((videos ?? []) as Row[]).filter(
    (v) => String(v.project_id) === String(project.id),
  );
}

function activityFor(project: Row, videos: Row[]) {
  const events: { at: string; body: string }[] = [
    { at: String(project.created_at), body: "Project booked in." },
  ];
  for (const v of videos) {
    const title = String(v.title);
    if (v.ready_at) events.push({ at: String(v.ready_at), body: `${title} is ready for you to watch.` });
    if (v.approved_at) events.push({ at: String(v.approved_at), body: `You approved ${title}.` });
    if (v.status === "revisions")
      events.push({ at: String(v.created_at), body: `Your changes to ${title} are in hand.` });
    /* the production line writes its own history: every station that has
       moved carries the date it moved */
    const line = normalizePipeline(v.pipeline);
    for (const k of STATION_ORDER) {
      const st = line[k];
      if (!st.at) continue;
      if (st.provided) continue;
      if (st.state === "done")
        events.push({ at: st.at, body: `${STATIONS[k].label} finished on ${title}.` });
      else if (st.state === "with_client")
        events.push({ at: st.at, body: `${STATIONS[k].label} for ${title} is waiting on you.` });
      else if (st.state === "with_us")
        events.push({ at: st.at, body: `${STATIONS[k].label} started on ${title}.` });
    }
  }
  return events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 20);
}
