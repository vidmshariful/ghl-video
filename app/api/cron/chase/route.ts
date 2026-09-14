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
  sendApprovalReminderBatchEmail,
  sendApprovalReminderEmail,
  sendBriefReminderEmail,
  sendProjectDigestEmail,
  sendRetainerCheckInEmail,
  sendReviewRequestEmail,
} from "@/lib/email/notify";
import { checkInDue, checkInSent, nextCheckIn, priorChases, reviewDue, withinWindow } from "@/lib/chase-rules";
import { countLine, monthKey, monthLabel, monthSummary, parseRetainer, type RetainerJob } from "@/lib/retainer";
import { likeLiteral } from "@/lib/pg-pattern";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/* every reminder is two HighLevel calls now; a busy morning needs the room */
export const maxDuration = 120;

/*
 * The morning sweep for work stuck with clients (idea 98 on the board).
 *
 * Every day: any piece that has sat in a client's court for three full days
 * gets a reminder, at most twice, three days apart, then we stop and it
 * becomes a phone call. That covers a custom stage handed to them, a video
 * of any line waiting for their review, and a paid order still without its
 * brief. A retainer partnership gets its check-in on the date its terms
 * name, and the date moves a quarter on. Mondays: every client with a
 * custom project in motion gets one digest of where their videos stand.
 * These are the platform's own follow-ups, not HighLevel workflows (owner
 * decision, 14 September 2026); the emails still leave through HighLevel.
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

/*
 * Every row of a query, a thousand at a time. PostgREST answers at most a
 * thousand rows per call and says nothing about the rest, so a ledger past
 * that would quietly forget reminders already sent and the sweep would send
 * them again (audit, 15 September 2026). A failed read throws rather than
 * reading as empty, for the same reason: an empty ledger means chase
 * everyone. Each page is ordered by id so the pages never overlap.
 */
const PAGE = 1000;
type PageQuery = (
  from: number,
  to: number,
) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
async function allRows(what: string, page: PageQuery): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(`Could not read ${what}: ${error.message}`);
    const rows = (data ?? []) as Row[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

/* HighLevel allows a hundred calls in ten seconds and every reminder is two
   of them (the contact, then the message). A burst past that is refused and
   the send falls back to Brevo, off the client's thread, so the sweep takes
   a breath between sends. */
const SEND_PAUSE_MS = 150;
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function authorized(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return Boolean(await verifyAdmin(req));
}

type Nudge = { videoTitle: string; stageLabel: string; daysWaiting: number; deliverableId: string; station: string };

export async function GET(req: Request) {
  if (!(await authorized(req)))
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = supabaseAdmin();
  const now = new Date().toISOString();
  const url = new URL(req.url);
  const doDigest = url.searchParams.get("digest") === "1" || new Date().getUTCDay() === 1;
  /* ?dry=1 lists what a run would send and sends nothing: the rehearsal
     before the first real morning (15 September 2026) */
  const dry = url.searchParams.get("dry") === "1";

  /* every reminder ever sent, once; the sweep slices it in memory. A failed
     row counts too: an address that bounced is not chased again tomorrow. */
  const allLedger = await allRows("the chase ledger", (from, to) =>
    db
      .from("email_log")
      .select("template_key, meta, created_at")
      .in("template_key", ["approval_reminder", "approval_reminder_batch", "intake_reminder", "retainer_check_in", "review_request"])
      .in("status", ["sent", "failed"])
      .order("id")
      .range(from, to),
  );
  const ledger = allLedger.filter((r) => r.template_key === "approval_reminder" || r.template_key === "approval_reminder_batch");
  const briefLedger = allLedger.filter((r) => r.template_key === "intake_reminder");
  const checkInLedger = allLedger.filter((r) => r.template_key === "retainer_check_in");
  const reviewLedger = allLedger.filter((r) => r.template_key === "review_request");

  const chased: string[] = [];
  /* every piece waiting on a client, gathered first and sent per client:
     one email listing several pieces rather than one email per piece */
  const nudges = new Map<string, { name: string | null; items: Nudge[] }>();
  const queueNudge = (email: string, name: string | null, item: Nudge) => {
    const key = email.toLowerCase();
    const mine = nudges.get(key) ?? { name, items: [] };
    mine.items.push(item);
    nudges.set(key, mine);
  };
  const briefs: string[] = [];
  const checkIns: string[] = [];
  const reviews: string[] = [];

  /* studio-owned accounts are never chased */
  const { data: internalRows } = await db.from("customers").select("email").eq("internal", true);
  const internal = new Set(((internalRows ?? []) as Row[]).map((c) => String(c.email).toLowerCase()));

  /* ---- custom projects: any gated station in the client's court ---- */
  const projects = await allRows("open projects", (from, to) =>
    db.from("projects").select("*").not("status", "in", "(closed,cancelled)").order("id").range(from, to),
  );

  const emails = [...new Set(projects.map((p) => String(p.customer_email).toLowerCase()))];
  const { data: customers } = emails.length
    ? await db.from("customers").select("email, name").in("email", emails)
    : { data: [] };
  const nameOf = (email: string) =>
    ((((customers ?? []) as Row[]).find(
      (c) => String(c.email).toLowerCase() === email.toLowerCase(),
    )?.name as string | null) ?? null);

  for (const p of projects) {
    if (internal.has(String(p.customer_email).toLowerCase())) continue;
    const line = normalizePipeline(p.pipeline);
    for (const k of STATION_ORDER) {
      const st = line[k];
      if (st.state !== "with_client" || !st.gate || st.provided) continue;
      /* the sweep starts from where it is switched on: nothing handed over
         before its window is chased by mail; that is a phone call */
      if (!withinWindow(st.at ?? null, now)) continue;
      const prior = priorChases(ledger as { meta?: unknown; created_at?: unknown }[], String(p.id), k);
      if (!needsChase(st.at ?? null, prior, now)) continue;
      queueNudge(String(p.customer_email), nameOf(String(p.customer_email)), {
        videoTitle: String(p.title),
        stageLabel: STATIONS[k as StationKey].label,
        daysWaiting: daysWaiting(st.at ?? now, now),
        deliverableId: String(p.id),
        station: k,
      });
    }
  }

  /* ---- extra formats sitting in review ---- */
  const readyFormats = await allRows("formats in review", (from, to) =>
    db
      .from("order_deliverables")
      .select("id, title, status, ready_at, project_id")
      .eq("category", "format")
      .eq("status", "ready")
      .order("id")
      .range(from, to),
  );
  for (const f of readyFormats) {
    const project = projects.find((p) => String(p.id) === String(f.project_id));
    if (!project) continue;
    if (internal.has(String(project.customer_email).toLowerCase())) continue;
    if (!withinWindow((f.ready_at as string | null) ?? null, now)) continue;
    const prior = priorChases(ledger as { meta?: unknown; created_at?: unknown }[], String(f.id), "review");
    if (!needsChase((f.ready_at as string | null) ?? null, prior, now)) continue;
    const email = String(project.customer_email);
    queueNudge(email, nameOf(email), {
      videoTitle: String(f.title),
      stageLabel: "Your review",
      daysWaiting: daysWaiting(String(f.ready_at), now),
      deliverableId: String(f.id),
      station: "review",
    });
  }

  /* ---- editing plan work sitting unwatched: ready with nobody looking ---- */
  const editingReady = await allRows("editing cuts in review", (from, to) =>
    db
      .from("order_deliverables")
      .select("id, title, status, ready_at, cycle_id")
      .not("cycle_id", "is", null)
      .eq("status", "ready")
      .order("id")
      .range(from, to),
  );
  const cycleIds = [...new Set(editingReady.map((r) => String(r.cycle_id)))];
  /* the table is subscription_cycles. `editing_cycles` never existed, and
     because only `data` was destructured the error was swallowed: the map
     below stayed empty, every row hit the `continue`, and no editing client
     was ever reminded to come and watch a cut. */
  const { data: cycles } = cycleIds.length
    ? await db.from("subscription_cycles").select("id, subscription_id").in("id", cycleIds)
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

  for (const r of editingReady) {
    const sub = subByCycle.get(String(r.cycle_id));
    if (!sub) continue;
    if (internal.has(String(sub.customer_email).toLowerCase())) continue;
    if (!withinWindow((r.ready_at as string | null) ?? null, now)) continue;
    const prior = priorChases(ledger as { meta?: unknown; created_at?: unknown }[], String(r.id), "review");
    if (!needsChase((r.ready_at as string | null) ?? null, prior, now)) continue;
    const email = String(sub.customer_email);
    queueNudge(email, nameOf(email), {
      videoTitle: String(r.title),
      stageLabel: "Your review",
      daysWaiting: daysWaiting(String(r.ready_at), now),
      deliverableId: String(r.id),
      station: "review",
    });
  }

  /* ---- premade videos sitting in review: bought, made, and not yet watched ---- */
  const orderReady = await allRows("videos in review", (from, to) =>
    db
      .from("order_deliverables")
      .select("id, title, ready_at, order_id, parent_id")
      .not("order_id", "is", null)
      .eq("status", "ready")
      .order("id")
      .range(from, to),
  );
  const readyOrderIds = [...new Set(orderReady.map((r) => String(r.order_id)))];
  const { data: readyOrders } = readyOrderIds.length
    ? await db.from("orders").select("id, customer_email, archived").in("id", readyOrderIds)
    : { data: [] };
  const orderById = new Map(((readyOrders ?? []) as Row[]).map((o) => [String(o.id), o]));
  for (const r of orderReady) {
    const order = orderById.get(String(r.order_id));
    if (!order || order.archived) continue;
    const email = String(order.customer_email).toLowerCase();
    if (internal.has(email)) continue;
    if (!withinWindow((r.ready_at as string | null) ?? null, now)) continue;
    const prior = priorChases(ledger as { meta?: unknown; created_at?: unknown }[], String(r.id), "review");
    if (!needsChase((r.ready_at as string | null) ?? null, prior, now)) continue;
    queueNudge(email, nameOf(email), {
      videoTitle: String(r.title),
      stageLabel: "Your review",
      daysWaiting: daysWaiting(String(r.ready_at), now),
      deliverableId: String(r.id),
      station: "review",
    });
  }

  /* ---- the nudges go out, one email per client ---- */
  for (const [email, { name, items }] of nudges) {
    const sent =
      dry ||
      (items.length === 1
        ? await sendApprovalReminderEmail(db, { email, name, ...items[0] })
        : await sendApprovalReminderBatchEmail(db, { email, name, items }));
    if (sent) for (const i of items) chased.push(`${i.videoTitle} / ${i.station}`);
    if (!dry) await pause(SEND_PAUSE_MS);
  }

  /* ---- paid orders still without their brief: nothing can start ---- */
  /* only an order that is still waiting to start: one already in production,
     in review or delivered was briefed some other way, and a reminder that
     "nothing can start" would be wrong (audit, 15 September 2026) */
  const { data: unbriefed } = await db
    .from("orders")
    .select("id, customer_email, paid_at, archived, product:products(metadata)")
    .eq("status", "paid")
    .eq("intake_completed", false)
    .in("fulfillment_stage", ["paid", "intake"]);
  for (const o of (unbriefed ?? []) as Row[]) {
    if (o.archived) continue;
    const meta = ((o.product as { metadata?: Row } | null)?.metadata ?? {}) as Row;
    /* an invoice payment and a credit top-up have no brief to give */
    if (meta.invoice || meta.demo || meta.kind === "editing_credits") continue;
    const email = String(o.customer_email).toLowerCase();
    if (internal.has(email)) continue;
    const mine = briefLedger
      .filter((r) => ((r.meta ?? {}) as Row).orderId === String(o.id))
      .map((r) => String(r.created_at))
      .sort();
    const prior = { count: mine.length, lastAtIso: mine[mine.length - 1] ?? null };
    if (!withinWindow((o.paid_at as string | null) ?? null, now)) continue;
    if (!needsChase((o.paid_at as string | null) ?? null, prior, now)) continue;
    const sent = dry || await sendBriefReminderEmail(db, String(o.id));
    if (!dry) await pause(SEND_PAUSE_MS);
    if (sent) briefs.push(String(o.id));
  }

  /* ---- retainer partnerships: the check-in on the date the terms name ---- */
  const today = now.slice(0, 10);
  const { data: partners } = await db
    .from("customers")
    .select("id, email, name, retainer, internal")
    .not("retainer", "is", null);
  for (const c of (partners ?? []) as Row[]) {
    const retainer = parseRetainer(c.retainer);
    if (!retainer || c.internal || !checkInDue(retainer.checkInOn, today)) continue;
    const checkInOn = String(retainer.checkInOn);
    if (!withinWindow(`${checkInOn}T00:00:00.000Z`, now)) continue;
    if (checkInSent(checkInLedger as { meta?: unknown }[], String(c.id), checkInOn)) continue;
    const { data: jobs } = await db
      .from("projects")
      .select("id, title, status, retainer_month, retainer_kind, created_at")
      .ilike("customer_email", likeLiteral(String(c.email)))
      .not("retainer_kind", "is", null);
    const month = monthKey(new Date(now));
    const summary = monthSummary(
      ((jobs ?? []) as Row[]).map((j) => ({
        id: String(j.id),
        title: String(j.title),
        status: String(j.status),
        retainerMonth: (j.retainer_month as string | null) ?? null,
        retainerKind: (j.retainer_kind as RetainerJob["retainerKind"]) ?? null,
        createdAt: String(j.created_at),
      })),
      month,
    );
    const sent = dry || await sendRetainerCheckInEmail(db, {
      email: String(c.email),
      name: (c.name as string | null) ?? null,
      customerId: String(c.id),
      checkInOn,
      partnershipName: retainer.name,
      thisMonth: monthLabel(month),
      countLine: countLine(summary, retainer),
    });
    if (!dry) await pause(SEND_PAUSE_MS);
    if (!sent) continue;
    checkIns.push(String(c.email).toLowerCase());
    if (dry) continue;
    /* the next one, a quarter on; the record shows the new date */
    await db
      .from("customers")
      .update({ retainer: { ...retainer, checkInOn: nextCheckIn(checkInOn) }, updated_at: now })
      .eq("id", String(c.id));
  }

  /* ---- the review ask: two days after a client's first finished job ---- */
  const { data: deliveredOrders } = await db
    .from("orders")
    .select("customer_email, stage_changed_at, archived, product:products(metadata)")
    .eq("status", "paid")
    .eq("fulfillment_stage", "delivered");
  const { data: closedProjects } = await db.from("projects").select("customer_email, updated_at").eq("status", "closed");
  /* the first finish per client, whichever line it was on */
  const firstDone = new Map<string, string>();
  for (const o of (deliveredOrders ?? []) as Row[]) {
    if (o.archived) continue;
    const meta = ((o.product as { metadata?: Row } | null)?.metadata ?? {}) as Row;
    if (meta.invoice || meta.demo || meta.kind === "editing_credits") continue;
    const email = String(o.customer_email).toLowerCase();
    const at = String(o.stage_changed_at ?? "");
    if (at && (!firstDone.has(email) || at < String(firstDone.get(email)))) firstDone.set(email, at);
  }
  for (const p of (closedProjects ?? []) as Row[]) {
    const email = String(p.customer_email).toLowerCase();
    const at = String(p.updated_at ?? "");
    if (at && (!firstDone.has(email) || at < String(firstDone.get(email)))) firstDone.set(email, at);
  }
  if (firstDone.size) {
    const { data: askable } = await db
      .from("customers")
      .select("id, email, name, internal")
      .in("email", [...firstDone.keys()]);
    for (const c of (askable ?? []) as Row[]) {
      const email = String(c.email).toLowerCase();
      if (c.internal || internal.has(email)) continue;
      const mine = reviewLedger
        .filter((r) => ((r.meta ?? {}) as Row).customerId === String(c.id))
        .map((r) => String(r.created_at))
        .sort();
      if (!withinWindow(firstDone.get(email) ?? null, now)) continue;
      if (!reviewDue(firstDone.get(email) ?? null, mine[mine.length - 1] ?? null, now)) continue;
      const sent = dry || await sendReviewRequestEmail(db, { email, name: (c.name as string | null) ?? null, customerId: String(c.id) });
      if (!dry) await pause(SEND_PAUSE_MS);
      if (sent) reviews.push(email);
    }
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

    for (const p of projects) {
      const email = String(p.customer_email).toLowerCase();
      if (already.has(email) || internal.has(email)) continue;
      already.add(email);

      const theirs = projects.filter((x) => String(x.customer_email).toLowerCase() === email);
      if (!theirs.length) continue;
      const esc = (t: string) =>
        t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const lines = theirs
        .map((x) => {
          const line = normalizePipeline(x.pipeline);
          const currentKey = STATION_ORDER.find((k) => line[k].state !== "done");
          const word = currentKey
            ? `${STATIONS[currentKey].label}: ${clientStationWord(currentKey, line[currentKey]).toLowerCase()}`
            : "finished";
          return `<p style="margin:0 0 8px;"><strong style="color:#eef0f6;">${esc(String(x.title))}</strong><br/>${esc(word)}</p>`;
        })
        .join("");
      const ok = dry || await sendProjectDigestEmail(db, {
        email: String(p.customer_email),
        name: nameOf(email),
        linesHtml: lines,
      });
      if (!dry) await pause(SEND_PAUSE_MS);
      if (ok) digested.push(email);
    }
  }

  const nudged = Object.fromEntries([...nudges].map(([email, v]) => [email, v.items.length]));
  return NextResponse.json({ ok: true, dry, chased, nudged, briefs, checkIns, reviews, digested, digestRan: doDigest });
}
