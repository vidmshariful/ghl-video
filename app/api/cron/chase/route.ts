import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import {
  clientStationWord,
  daysWaiting,
  needsChase,
  normalizePipeline,
  STATION_ORDER,
  STATIONS,
  type StationKey,
} from "@/lib/pipeline";
import {
  sendApprovalReminderEmail,
  sendProjectDigestEmail,
} from "@/lib/email/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * The morning sweep for work stuck with clients (idea 98 on the board).
 *
 * Two jobs. Every day: any piece that has sat in a client's court for three
 * full days gets a reminder, at most twice, three days apart, then we stop
 * and it becomes a phone call. Mondays: every client with a custom project
 * in motion gets one digest of where their videos stand.
 *
 * The chase ledger is the email log itself: every reminder writes which
 * deliverable and station it was about into the log row's meta, so this
 * sweep can count what was already sent without a table of its own. The
 * sweep is therefore safe to run twice: the second run finds the ledger
 * full and sends nothing.
 *
 * Unlike the price-drift cron, this one SENDS MAIL, so it never runs open:
 * Vercel's cron must present CRON_SECRET, and a signed-in admin can trigger
 * it by hand. No secret and no admin means no sweep.
 */

type Row = Record<string, unknown>;

async function authorized(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return Boolean(await verifyAdmin(req));
}

/** prior chases for one deliverable+station, read from the log */
function chasesFrom(
  ledger: Row[],
  deliverableId: string,
  station: string,
): { count: number; lastAtIso: string | null } {
  const mine = ledger
    .filter((r) => {
      const m = (r.meta ?? {}) as Row;
      return m.deliverableId === deliverableId && m.station === station;
    })
    .map((r) => String(r.created_at))
    .sort();
  return { count: mine.length, lastAtIso: mine[mine.length - 1] ?? null };
}

export async function GET(req: Request) {
  if (!(await authorized(req)))
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = supabaseAdmin();
  const now = new Date().toISOString();
  const url = new URL(req.url);
  const doDigest = url.searchParams.get("digest") === "1" || new Date().getUTCDay() === 1;

  /* every reminder ever sent, once; the sweep slices it in memory */
  const { data: ledgerRows } = await db
    .from("email_log")
    .select("meta, created_at")
    .eq("template_key", "approval_reminder")
    .eq("status", "sent");
  const ledger = (ledgerRows ?? []) as Row[];

  const chased: string[] = [];

  /* ---- custom project videos: any gated station in the client's court ---- */
  const { data: projectVideos } = await db
    .from("order_deliverables")
    .select("id, title, project_id, pipeline")
    .not("project_id", "is", null);
  const projectIds = [...new Set(((projectVideos ?? []) as Row[]).map((v) => String(v.project_id)))];
  const { data: projects } = projectIds.length
    ? await db.from("projects").select("id, customer_email, status").in("id", projectIds)
    : { data: [] };
  const projectById = new Map(((projects ?? []) as Row[]).map((p) => [String(p.id), p]));

  const emails = [
    ...new Set(((projects ?? []) as Row[]).map((p) => String(p.customer_email).toLowerCase())),
  ];
  const { data: customers } = emails.length
    ? await db.from("customers").select("email, name").in("email", emails)
    : { data: [] };
  const nameOf = (email: string) =>
    ((((customers ?? []) as Row[]).find(
      (c) => String(c.email).toLowerCase() === email.toLowerCase(),
    )?.name as string | null) ?? null);

  for (const v of (projectVideos ?? []) as Row[]) {
    const project = projectById.get(String(v.project_id));
    if (!project || ["closed", "cancelled"].includes(String(project.status))) continue;
    const line = normalizePipeline(v.pipeline);
    for (const k of STATION_ORDER) {
      const st = line[k];
      if (st.state !== "with_client" || !st.gate || st.provided) continue;
      const prior = chasesFrom(ledger, String(v.id), k);
      if (!needsChase(st.at ?? null, prior, now)) continue;
      const sent = await sendApprovalReminderEmail(db, {
        email: String(project.customer_email),
        name: nameOf(String(project.customer_email)),
        videoTitle: String(v.title),
        stageLabel: STATIONS[k as StationKey].label,
        daysWaiting: daysWaiting(st.at ?? now, now),
        deliverableId: String(v.id),
        station: k,
      });
      if (sent) chased.push(`${String(v.title)} / ${k}`);
    }
  }

  /* ---- editing plan work sitting unwatched: ready with nobody looking ---- */
  const { data: editingReady } = await db
    .from("order_deliverables")
    .select("id, title, status, ready_at, cycle_id")
    .not("cycle_id", "is", null)
    .eq("status", "ready");
  const cycleIds = [...new Set(((editingReady ?? []) as Row[]).map((r) => String(r.cycle_id)))];
  const { data: cycles } = cycleIds.length
    ? await db.from("editing_cycles").select("id, subscription_id").in("id", cycleIds)
    : { data: [] };
  const subIds = [...new Set(((cycles ?? []) as Row[]).map((c) => String(c.subscription_id)))];
  const { data: subs } = subIds.length
    ? await db.from("subscriptions").select("id, customer_email").in("id", subIds)
    : { data: [] };
  const subByCycle = new Map(
    ((cycles ?? []) as Row[]).map((c) => [
      String(c.id),
      ((subs ?? []) as Row[]).find((s) => String(s.id) === String(c.subscription_id)),
    ]),
  );

  for (const r of (editingReady ?? []) as Row[]) {
    const sub = subByCycle.get(String(r.cycle_id));
    if (!sub) continue;
    const prior = chasesFrom(ledger, String(r.id), "review");
    if (!needsChase((r.ready_at as string | null) ?? null, prior, now)) continue;
    const email = String(sub.customer_email);
    const sent = await sendApprovalReminderEmail(db, {
      email,
      name: nameOf(email),
      videoTitle: String(r.title),
      stageLabel: "Your review",
      daysWaiting: daysWaiting(String(r.ready_at), now),
      deliverableId: String(r.id),
      station: "review",
    });
    if (sent) chased.push(`${String(r.title)} / review`);
  }

  /* ---- Monday: one digest per client with a project in motion ---- */
  const digested: string[] = [];
  if (doDigest) {
    /* at most one digest per six days, whatever day this runs */
    const { data: recent } = await db
      .from("email_log")
      .select("to_email")
      .eq("template_key", "project_digest")
      .eq("status", "sent")
      .gte("created_at", new Date(Date.now() - 6 * 86_400_000).toISOString());
    const already = new Set(((recent ?? []) as Row[]).map((r) => String(r.to_email).toLowerCase()));

    for (const p of ((projects ?? []) as Row[]).filter(
      (x) => !["closed", "cancelled"].includes(String(x.status)),
    )) {
      const email = String(p.customer_email).toLowerCase();
      if (already.has(email)) continue;
      already.add(email);

      const theirs = ((projectVideos ?? []) as Row[]).filter(
        (v) =>
          String(projectById.get(String(v.project_id))?.customer_email ?? "").toLowerCase() ===
          email,
      );
      if (!theirs.length) continue;
      const esc = (t: string) =>
        t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const lines = theirs
        .map((v) => {
          const line = normalizePipeline(v.pipeline);
          const currentKey = STATION_ORDER.find((k) => line[k].state !== "done");
          const word = currentKey
            ? `${STATIONS[currentKey].label}: ${clientStationWord(currentKey, line[currentKey]).toLowerCase()}`
            : "finished";
          return `<p style="margin:0 0 8px;"><strong style="color:#eef0f6;">${esc(String(v.title))}</strong><br/>${esc(word)}</p>`;
        })
        .join("");
      const ok = await sendProjectDigestEmail(db, {
        email: String(p.customer_email),
        name: nameOf(String(p.customer_email)),
        linesHtml: lines,
      });
      if (ok) digested.push(email);
    }
  }

  return NextResponse.json({ ok: true, chased, digested, digestRan: doDigest });
}
