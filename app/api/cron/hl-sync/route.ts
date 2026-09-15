import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { drainOutbox, type DrainResult } from "@/lib/highlevel/sync";
import { loadHlConfig } from "@/lib/highlevel/config";
import { locationId } from "@/lib/highlevel/client";
import { pollOpenInvoices, pullInvoices } from "@/lib/highlevel/money";
import { mirrorMissing, pullRecentConversations } from "@/lib/highlevel/conversations";
import { refreshEmailStatuses } from "@/lib/highlevel/email-log";
import { pullContactChanges } from "@/lib/highlevel/inbound";
import { raise } from "@/lib/alarm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* the drain stops taking rows here, so the phases after it get their turn */
const DRAIN_BUDGET_MS = 40_000;
/* a phase that starts with less than this left is skipped and said so */
const PHASE_MIN_MS = 15_000;
/* the last moment any loop may start another call, short of the platform's limit */
const HARD_STOP_MS = (maxDuration - 5) * 1000;

/*
 * The minute-by-minute send to HighLevel: whatever the triggers queued
 * since the last run goes across now. Like the other crons: Vercel
 * presents CRON_SECRET, or a signed-in admin runs it by hand.
 *
 * The whole run carries one clock. A slow HighLevel used to kill the
 * function part way, with a 500 in Vercel's logs and Health green until the
 * nightly count (audit, 15 September 2026): now every phase checks what is
 * left before it starts, a phase without room is skipped and named in the
 * response, and a throw raises an alarm.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const signed = Boolean(secret && req.headers.get("authorization") === `Bearer ${secret}`);
  if (!signed && !(await verifyAdmin(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!process.env.HIGHLEVEL_API_TOKEN || !process.env.HIGHLEVEL_LOCATION_ID)
    return NextResponse.json({ ok: true, note: "HighLevel is not configured here." });

  const db = supabaseAdmin();
  const started = Date.now();
  try {
    return NextResponse.json(await run(db, started));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await raise(db, {
      kind: "cron.failed",
      fingerprint: "cron:hl-sync",
      notifyAfter: 2,
      message: `The minute HighLevel sync stopped part way: ${message}`,
      context: { route: "hl-sync", error: message, afterMs: Date.now() - started },
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

async function run(db: ReturnType<typeof supabaseAdmin>, started: number) {
  const left = () => started + maxDuration * 1000 - Date.now();
  const until = started + HARD_STOP_MS;
  const totals = { processed: 0, done: 0, unchanged: 0, skipped: 0, failed: 0, deadLettered: 0 };
  const rows: DrainResult["rows"] = [];
  const skippedPhases: string[] = [];
  let provisioned = true;
  let outOfTime = false;
  let contacts: unknown = null;

  /* what changed in HighLevel first, so an edit made there in the last few
     minutes lands on our row before the drain sends our copy back over it */
  const cfg = await loadHlConfig(db, locationId());
  if (cfg) contacts = await pullContactChanges(db, cfg.locationId, 5 * 60_000);
  /* keep going while there is more and time allows; the row limit keeps one call short */
  for (;;) {
    const out = await drainOutbox(db, { limit: 40, until: started + DRAIN_BUDGET_MS });
    provisioned = out.provisioned;
    outOfTime = outOfTime || out.outOfTime;
    for (const k of Object.keys(totals) as (keyof typeof totals)[]) totals[k] += out[k];
    rows.push(...out.rows);
    if (!out.provisioned || out.outOfTime || out.processed < 40 || Date.now() - started > DRAIN_BUDGET_MS) break;
  }

  /* one failure is the retry's to fix; the same kind failing run after run
     is news before the nightly count says so */
  const failedByKind = new Map<string, { n: number; sample: string }>();
  for (const r of rows) {
    if (r.status !== "failed") continue;
    const f = failedByKind.get(r.kind) ?? { n: 0, sample: r.note };
    failedByKind.set(r.kind, { n: f.n + 1, sample: f.sample });
  }
  for (const [kind, f] of failedByKind) {
    await raise(db, {
      kind: "highlevel.sync_failed",
      fingerprint: `highlevel:sync_failed:${kind}`,
      notifyAfter: 3,
      message: `${f.n} ${kind} ${f.n === 1 ? "row" : "rows"} failed to reach HighLevel this minute: ${f.sample}`,
      context: { kind, failed: f.n },
    });
  }

  /* money moves the other way too: what was paid on HighLevel's page, and
     invoices made over there (by hand or by a retainer schedule) */
  let invoices: unknown = null;
  let messages: unknown = null;
  let email: unknown = null;
  if (provisioned && cfg) {
    const room = (phase: string) => {
      if (left() >= PHASE_MIN_MS) return true;
      skippedPhases.push(phase);
      return false;
    };
    /* A phase that throws is that phase's news, not the run's: the phases
       after it still get their turn, the response names it, and the alarm
       fires only when the same phase keeps failing (a single HighLevel
       hiccup used to be reported as a crash of the whole sync). */
    const phase = async (name: string, fn: () => Promise<unknown>): Promise<unknown> => {
      if (!room(name)) return null;
      try {
        return await fn();
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        await raise(db, {
          kind: "highlevel.phase_failed",
          fingerprint: `highlevel:phase:${name}`,
          notifyAfter: 3,
          message: `The minute HighLevel sync could not finish its ${name} phase: ${message}`,
          context: { route: "hl-sync", phase: name, error: message },
        });
        return { error: message };
      }
    };
    invoices = await phase("invoices", async () => {
      const polled = await pollOpenInvoices(db, cfg, { until });
      /* every invoice unanswered in one minute is HighLevel being down, and
         worth a word after a few minutes of it; one unanswered is not */
      if (polled.failed && polled.failed >= polled.checked + polled.failed && polled.failure) {
        await raise(db, {
          kind: "highlevel.phase_failed",
          fingerprint: "highlevel:phase:invoices",
          notifyAfter: 3,
          message: `HighLevel answered for none of the ${polled.failed} open invoices this minute: ${polled.failure}`,
          context: { route: "hl-sync", phase: "invoices", failed: polled.failed, error: polled.failure },
        });
      }
      const pulled = await pullInvoices(db, cfg, { pages: 1 });
      return { ...polled, imported: pulled.imported, seen: pulled.seen, foreign: pulled.foreign, skipped: pulled.skipped };
    });
    /* the conversation, both ways: the studio's words from inside HighLevel
       onto the portal threads, and any portal message a hiccup left behind */
    messages = await phase("conversations", async () => {
      const pulledMessages = await pullRecentConversations(db, cfg, { until });
      const mirrored = await mirrorMissing(db);
      return { ...pulledMessages, mirrored };
    });
    /* what became of the emails HighLevel queued */
    email = await phase("email statuses", () => refreshEmailStatuses(db));
  }
  return {
    ok: true,
    provisioned,
    ...totals,
    outOfTime,
    skippedPhases,
    tookMs: Date.now() - started,
    rows,
    invoices,
    messages,
    email,
    contacts,
  };
}
