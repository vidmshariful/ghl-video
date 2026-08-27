import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { contextCan, resolvePortalContext, actorName } from "@/lib/account-team";
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

/**
 * May this account brief us directly, with no quote in between?
 *
 * A commercial fact about the account, held on the customer row and set by
 * the studio. Read here rather than trusted from the client, obviously: the
 * button being hidden is a courtesy, this is the actual gate.
 */
async function canSubmit(db: ReturnType<typeof supabaseAdmin>, email: string): Promise<boolean> {
  const { data } = await db
    .from("customers")
    .select("can_submit_projects")
    .ilike("email", email)
    .maybeSingle();
  return Boolean(data?.can_submit_projects);
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
    /* whether to offer them the Submit a project button. The POST below
       checks it again for real. */
    canSubmit: await canSubmit(db, ctx.ownerEmail),
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
                /* the popup needs the real state to know an approved cut from
                   one still waiting on them; without it every video opened as
                   "ready" and asked for feedback on work already signed off */
                status: mainStatus,
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
                        ? /* the same word the production line uses one card up,
                             and the same one the studio board shows */
                          "In progress"
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

/*
 * A client briefing us directly.
 *
 * Only for accounts where the money conversation has already happened, which
 * is why the gate is a fact on their customer row and not something the
 * request can assert. Everyone else uses the quote path in
 * /api/portal/projects/request, which is an enquiry rather than a job.
 *
 * What lands is a real project at the front of the line, exactly as if the
 * studio had opened it after a call, marked as client-submitted so the board
 * can tell the difference.
 */
export async function POST(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });
  if (!contextCan(ctx, "orders"))
    return NextResponse.json({ error: "You do not have access to this." }, { status: 403 });

  if (!(await canSubmit(db, ctx.ownerEmail)))
    return NextResponse.json(
      { error: "This account requests a quote rather than submitting projects." },
      { status: 403 },
    );

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const text = (v: unknown, max: number) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

  const title = text(b.title, 160);
  const script = text(b.script, 40000);
  if (!title) return NextResponse.json({ error: "Give the project a name." }, { status: 400 });
  if (!script) return NextResponse.json({ error: "The script is needed to start." }, { status: 400 });

  const { data: customer } = await db
    .from("customers")
    .select("id, name")
    .ilike("email", ctx.ownerEmail)
    .maybeSingle();

  const { data: made, error } = await db
    .from("projects")
    .insert({
      customer_email: ctx.ownerEmail,
      customer_id: (customer?.id as string | undefined) ?? null,
      title,
      script,
      category: text(b.category, 60),
      reference_url: text(b.reference, 1000),
      brief: text(b.brief, 8000),
      /* the front of the line, same as anything the studio opens */
      status: "backlog",
      source: "client",
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: "Could not save that." }, { status: 400 });

  /* tell the studio. Fail-soft: the project is in either way, and losing the
     bell must never cost us the job. */
  try {
    const { pushAdminNotifications } = await import("@/lib/notifications");
    /* name the person who submitted it, and keep the account beside them so
       the studio still knows which client this lands under */
    const actor = (await actorName(db, ctx)) ?? ctx.selfEmail;
    const account = (customer?.name as string | null) ?? ctx.ownerEmail;
    const who = ctx.isOwner ? actor : `${actor} (${account})`;
    await pushAdminNotifications(db, {
      kind: "project_submitted",
      title: `New project from ${who}: ${title}`,
      body: `${ctx.selfEmail} submitted it from the portal. Script included.`,
      href: `custom/${made.id}`,
      vars: { title, who, customer_email: ctx.ownerEmail },
    });
  } catch (e) {
    console.error("[projects] submit notify failed:", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({ ok: true, id: made.id });
}
