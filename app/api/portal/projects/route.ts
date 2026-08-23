import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { resolvePortalContext } from "@/lib/account-team";
import { CLIENT_LABEL, isOpen, normalizeProjectStatus, projectBalance } from "@/lib/projects";
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
  type Pipeline,
} from "@/lib/pipeline";

export const runtime = "nodejs";

/*
 * The client's own custom work, the simple way: a project IS the video.
 *
 * Each project carries its six-station production line, the main video's
 * review state (held by an invisible carrier row), and the extra formats
 * cut after approval. The client sees their vocabulary, never ours, and
 * money stays on invoices where it can actually be paid.
 */

type Row = Record<string, unknown>;

/* the client's payment standing on a project, said plainly: what they owe, if
   anything, without the studio's invoicing detail */
function clientPayment(money: { valueCents: number; paidCents: number; outstandingCents: number }) {
  if (money.valueCents <= 0) return { label: "Not set", outstandingCents: 0 };
  if (money.outstandingCents <= 0) return { label: "Paid", outstandingCents: 0 };
  if (money.paidCents > 0) return { label: "Part paid", outstandingCents: money.outstandingCents };
  return { label: "Unpaid", outstandingCents: money.outstandingCents };
}

export async function GET(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx) return NextResponse.json({ projects: [] });

  const { data: projects } = await db
    .from("projects")
    .select("*")
    .ilike("customer_email", ctx.ownerEmail)
    .order("created_at", { ascending: false });

  const ids = ((projects ?? []) as Row[]).map((p) => String(p.id));
  const { data: videos } = ids.length
    ? await db.from("order_deliverables").select("*").in("project_id", ids).order("position")
    : { data: [] };

  /* the client should know who their producer is by name, not by our email.
     one lookup over the handful of managers on their projects. */
  const managerEmails = [
    ...new Set(
      ((projects ?? []) as Row[])
        .map((p) => (p.owner_email as string | null)?.toLowerCase())
        .filter((e): e is string => Boolean(e)),
    ),
  ];
  const managerName = new Map<string, string>();
  if (managerEmails.length) {
    const { data: mgrs } = await db.from("admins").select("email, name").in("email", managerEmails);
    for (const m of (mgrs ?? []) as Row[]) {
      const email = (m.email as string | null)?.toLowerCase();
      if (email) managerName.set(email, (m.name as string | null) ?? email);
    }
  }

  /* payment standing: the client's own invoices on these projects, marked paid
     when one of their paid orders covers the invoice's product */
  const { data: invoices } = ids.length
    ? await db
        .from("invoices")
        .select("total_cents, project_id, product_sku")
        .in("project_id", ids)
    : { data: [] };
  const { data: paidOrders } = await db
    .from("orders")
    .select("product:products(sku)")
    .eq("status", "paid")
    .ilike("customer_email", ctx.ownerEmail);
  const paidSkus = new Set(
    ((paidOrders ?? []) as Row[]).map((o) => String((o.product as { sku?: unknown } | null)?.sku ?? "")),
  );

  return NextResponse.json({
    projects: ((projects ?? []) as Row[])
      /* a cancelled job is not something to show somebody who is paying us */
      .filter((p) => String(p.status) !== "cancelled")
      .map((p) => {
        const status = normalizeProjectStatus(String(p.status));
        const line = normalizePipeline(p.pipeline);
        const money = projectBalance(
          {
            quotedCents: p.quoted_cents == null ? null : Number(p.quoted_cents),
            agreedCents: p.agreed_cents == null ? null : Number(p.agreed_cents),
          },
          ((invoices ?? []) as Row[])
            .filter((i) => String(i.project_id) === String(p.id))
            .map((i) => ({ totalCents: Number(i.total_cents), paid: paidSkus.has(String(i.product_sku)) })),
        );
        const mine = ((videos ?? []) as Row[]).filter(
          (v) => String(v.project_id) === String(p.id),
        );
        const main = mine.find((v) => String(v.category ?? "") === "main") ?? null;
        const formats = mine.filter((v) => String(v.category ?? "") === "format");
        const mainStatus = (main?.status as DeliverableStatus) ?? "queued";
        return {
          id: String(p.id),
          title: String(p.title),
          brief: (p.brief as string | null) ?? null,
          category: (p.category as string | null) ?? null,
          status,
          statusLabel: CLIENT_LABEL[status],
          open: isOpen(status),
          dueAt: (p.due_at as string | null) ?? null,
          createdAt: String(p.created_at),
          manager: (() => {
            const email = (p.owner_email as string | null)?.toLowerCase();
            return email ? (managerName.get(email) ?? null) : null;
          })(),
          payment: clientPayment(money),
          pipeline: {
            ball: ballInCourt(line),
            percent: pipelinePercent(line),
            current: currentStation(line),
            stations: STATION_ORDER.map((k) => ({
              key: k,
              label: STATIONS[k].label,
              state: line[k].state,
              word: clientStationWord(k, line[k]),
              gated: Boolean(line[k].gate) && !line[k].provided,
              provided: Boolean(line[k].provided),
              url: STATIONS[k].clientFile ? (line[k].url ?? null) : null,
              at: line[k].at ?? null,
              eta: line[k].eta ?? null,
            })),
          },
          /* the main video's review state, carried invisibly */
          main: main
            ? {
                id: String(main.id),
                videoUrl: isWatchable(mainStatus)
                  ? ((main.video_url as string | null) ?? null)
                  : null,
                canReview: canReview(mainStatus),
                canRequestChanges: canRequestChanges(
                  mainStatus,
                  Number(main.revision_round ?? 0),
                ),
                revisionsIncluded: REVISIONS_INCLUDED,
                revisionsUsed: Number(main.revision_round ?? 0),
              }
            : null,
          formats: formats.map((f) => {
            const fs = f.status as DeliverableStatus;
            return {
              id: String(f.id),
              title: String(f.title),
              status: fs,
              word:
                fs === "approved"
                  ? "Done"
                  : fs === "ready"
                    ? "Ready to watch"
                    : fs === "revisions"
                      ? "Changes in hand"
                      : fs === "in_production"
                        ? "Being made"
                        : "Coming up",
              videoUrl: isWatchable(fs) ? ((f.video_url as string | null) ?? null) : null,
              canReview: canReview(fs),
              canRequestChanges: canRequestChanges(fs, Number(f.revision_round ?? 0)),
              revisionsIncluded: REVISIONS_INCLUDED,
              revisionsUsed: Number(f.revision_round ?? 0),
            };
          }),
          activity: activityFor(p, line, formats),
        };
      }),
  });
}

/* What has actually happened, from the timestamps the work already carries. */
function activityFor(project: Row, line: Pipeline, formats: Row[]) {
  const events: { at: string; body: string }[] = [
    { at: String(project.created_at), body: "Project booked in." },
  ];
  for (const k of STATION_ORDER) {
    const st = line[k];
    if (!st.at || st.provided) continue;
    if (st.state === "done") events.push({ at: st.at, body: `${STATIONS[k].label} finished.` });
    else if (st.state === "with_client")
      events.push({
        at: st.at,
        body: st.gate
          ? `${STATIONS[k].label} needs your approval.`
          : `${STATIONS[k].label} is with you.`,
      });
    else if (st.state === "with_us")
      events.push({ at: st.at, body: `${STATIONS[k].label} started.` });
  }
  for (const f of formats) {
    if (f.ready_at)
      events.push({ at: String(f.ready_at), body: `${String(f.title)} is ready to watch.` });
    if (f.approved_at)
      events.push({ at: String(f.approved_at), body: `You approved ${String(f.title)}.` });
  }
  return events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 20);
}
