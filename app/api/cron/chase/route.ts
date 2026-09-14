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
  sendBriefReminderEmail,
  sendProjectDigestEmail,
  sendRetainerCheckInEmail,
  sendReviewRequestEmail,
} from "@/lib/email/notify";
import { reviewDue } from "@/lib/chase-rules";
import { checkInDue, checkInSent, nextCheckIn } from "@/lib/chase-rules";
import { countLine, monthKey, monthLabel, monthSummary, parseRetainer, type RetainerJob } from "@/lib/retainer";

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
    .select("template_key, meta, created_at")
    .in("template_key", ["approval_reminder", "intake_reminder", "retainer_check_in", "review_request"])
    .eq("status", "sent");
  const allLedger = (ledgerRows ?? []) as Row[];
  const ledger = allLedger.filter((r) => r.template_key === "approval_reminder");
  const briefLedger = allLedger.filter((r) => r.template_key === "intake_reminder");
  const checkInLedger = allLedger.filter((r) => r.template_key === "retainer_check_in");
  const reviewLedger = allLedger.filter((r) => r.template_key === "review_request");

  const chased: string[] = [];
  const briefs: string[] = [];
  const checkIns: string[] = [];
  const reviews: string[] = [];

  /* studio-owned accounts are never chased */
  const { data: internalRows } = await db.from("customers").select("email").eq("internal", true);
  const internal = new Set(((internalRows ?? []) as Row[]).map((c) => String(c.email).toLowerCase()));

  /* ---- custom projects: any gated station in the client's court ---- */
  const { data: projects } = await db
    .from("projects")
    .select("*")
    .not("status", "in", "(closed,cancelled)");

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

  for (const p of (projects ?? []) as Row[]) {
    const line = normalizePipeline(p.pipeline);
    for (const k of STATION_ORDER) {
      const st = line[k];
      if (st.state !== "with_client" || !st.gate || st.provided) continue;
      const prior = chasesFrom(ledger, String(p.id), k);
      if (!needsChase(st.at ?? null, prior, now)) continue;
      const sent = await sendApprovalReminderEmail(db, {
        email: String(p.customer_email),
        name: nameOf(String(p.customer_email)),
        videoTitle: String(p.title),
        stageLabel: STATIONS[k as StationKey].label,
        daysWaiting: daysWaiting(st.at ?? now, now),
        deliverableId: String(p.id),
        station: k,
      });
      if (sent) chased.push(`${String(p.title)} / ${k}`);
    }
  }

  /* ---- extra formats sitting in review ---- */
  const { data: readyFormats } = await db
    .from("order_deliverables")
    .select("id, title, status, ready_at, project_id")
    .eq("category", "format")
    .eq("status", "ready");
  for (const f of (readyFormats ?? []) as Row[]) {
    const project = ((projects ?? []) as Row[]).find((p) => String(p.id) === String(f.project_id));
    if (!project) continue;
    const prior = chasesFrom(ledger, String(f.id), "review");
    if (!needsChase((f.ready_at as string | null) ?? null, prior, now)) continue;
    const email = String(project.customer_email);
    const sent = await sendApprovalReminderEmail(db, {
      email,
      name: nameOf(email),
      videoTitle: String(f.title),
      stageLabel: "Your review",
      daysWaiting: daysWaiting(String(f.ready_at), now),
      deliverableId: String(f.id),
      station: "review",
    });
    if (sent) chased.push(`${String(f.title)} / review`);
  }

  /* ---- editing plan work sitting unwatched: ready with nobody looking ---- */
  const { data: editingReady } = await db
    .from("order_deliverables")
    .select("id, title, status, ready_at, cycle_id")
    .not("cycle_id", "is", null)
    .eq("status", "ready");
  const cycleIds = [...new Set(((editingReady ?? []) as Row[]).map((r) => String(r.cycle_id)))];
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

  /* ---- premade videos sitting in review: bought, made, and not yet watched ---- */
  const { data: orderReady } = await db
    .from("order_deliverables")
    .select("id, title, ready_at, order_id, parent_id")
    .not("order_id", "is", null)
    .eq("status", "ready");
  const readyOrderIds = [...new Set(((orderReady ?? []) as Row[]).map((r) => String(r.order_id)))];
  const { data: readyOrders } = readyOrderIds.length
    ? await db.from("orders").select("id, customer_email, archived").in("id", readyOrderIds)
    : { data: [] };
  const orderById = new Map(((readyOrders ?? []) as Row[]).map((o) => [String(o.id), o]));
  for (const r of (orderReady ?? []) as Row[]) {
    const order = orderById.get(String(r.order_id));
    if (!order || order.archived) continue;
    const email = String(order.customer_email).toLowerCase();
    if (internal.has(email)) continue;
    const prior = chasesFrom(ledger, String(r.id), "review");
    if (!needsChase((r.ready_at as string | null) ?? null, prior, now)) continue;
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

  /* ---- paid orders still without their brief: nothing can start ---- */
  const { data: unbriefed } = await db
    .from("orders")
    .select("id, customer_email, paid_at, archived, product:products(metadata)")
    .eq("status", "paid")
    .eq("intake_completed", false);
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
    if (!needsChase((o.paid_at as string | null) ?? null, prior, now)) continue;
    const sent = await sendBriefReminderEmail(db, String(o.id));
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
    if (checkInSent(checkInLedger as { meta?: unknown }[], String(c.id), checkInOn)) continue;
    const { data: jobs } = await db
      .from("projects")
      .select("id, title, status, retainer_month, retainer_kind, created_at")
      .ilike("customer_email", String(c.email))
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
    const sent = await sendRetainerCheckInEmail(db, {
      email: String(c.email),
      name: (c.name as string | null) ?? null,
      customerId: String(c.id),
      checkInOn,
      partnershipName: retainer.name,
      thisMonth: monthLabel(month),
      countLine: countLine(summary, retainer),
    });
    if (!sent) continue;
    checkIns.push(String(c.email).toLowerCase());
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
      if (!reviewDue(firstDone.get(email) ?? null, mine[mine.length - 1] ?? null, now)) continue;
      const sent = await sendReviewRequestEmail(db, { email, name: (c.name as string | null) ?? null, customerId: String(c.id) });
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

    for (const p of (projects ?? []) as Row[]) {
      const email = String(p.customer_email).toLowerCase();
      if (already.has(email)) continue;
      already.add(email);

      const theirs = ((projects ?? []) as Row[]).filter(
        (x) => String(x.customer_email).toLowerCase() === email,
      );
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
      const ok = await sendProjectDigestEmail(db, {
        email: String(p.customer_email),
        name: nameOf(email),
        linesHtml: lines,
      });
      if (ok) digested.push(email);
    }
  }

  return NextResponse.json({ ok: true, chased, briefs, checkIns, reviews, digested, digestRan: doDigest });
}
