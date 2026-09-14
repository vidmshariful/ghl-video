/*
 * What became of the emails HighLevel queued. A send through HighLevel is
 * accepted at once and delivered, or not, a moment later; the log row is
 * written as sent when queued and corrected here, one GET per row still
 * open, so the email log tells the truth about delivery too.
 *
 * Only a verdict closes a row. A message still pending at the first look
 * used to be stamped as checked and never asked about again, so a bounce
 * an hour later never reached the log (audit, 15 September 2026). Now a
 * pending row is asked about again every ten minutes, and one still open a
 * day later is closed as "unknown" so the queue never grows.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailStatus } from "./email";

type Row = Record<string, unknown>;

/* HighLevel's last words on an email, the ones that will not change */
const FAILED = new Set(["failed", "undelivered", "bounced"]);
const DELIVERED = new Set(["delivered", "opened", "clicked", "read"]);
/** a pending message is asked about again after this long */
const LOOK_AGAIN_AFTER_MS = 10 * 60_000;
/** and given up on, as "unknown", after this long */
const GIVE_UP_AFTER_MS = 24 * 3600_000;
/** the read reaches back past the cap, so a row that crossed it is seen once more and closed */
const WINDOW_MS = 2 * GIVE_UP_AFTER_MS;

export async function refreshEmailStatuses(
  db: SupabaseClient,
  opts: { limit?: number; olderThanMs?: number } = {},
): Promise<{ checked: number; failed: number; delivered: number; pending: number; unknown: number }> {
  const out = { checked: 0, failed: 0, delivered: 0, pending: 0, unknown: 0 };
  const now = Date.now();
  const since = new Date(now - WINDOW_MS).toISOString();
  /* closed rows are left out by the query rather than skipped in the loop,
     so a busy day's verdicts cannot fill the page and hide the open rows */
  const { data } = await db
    .from("email_log")
    .select("id, meta, created_at")
    .eq("status", "sent")
    .gte("created_at", since)
    .contains("meta", { provider: "highlevel" })
    .is("meta->>hl_checked_at", null)
    .order("created_at", { ascending: true })
    .limit(opts.limit ?? 40);
  for (const r of (data ?? []) as Row[]) {
    const meta = (r.meta as Row | null) ?? {};
    const age = now - Date.parse(String(r.created_at));
    const id = typeof meta.hl_message_id === "string" ? meta.hl_message_id : null;
    /* give HighLevel a moment to try before asking */
    if (age < (opts.olderThanMs ?? 20_000)) continue;
    /* a pending row asked about recently waits its turn, until the cap */
    const looked = typeof meta.hl_looked_at === "string" ? Date.parse(meta.hl_looked_at) : 0;
    if (looked && now - looked < LOOK_AGAIN_AFTER_MS && age <= GIVE_UP_AFTER_MS) continue;

    const st = id ? await emailStatus(id) : null;
    if (st) out.checked += 1;
    const status = (st?.status ?? "").toLowerCase();
    const stamp = new Date().toISOString();
    let patch: Row;
    if (st && FAILED.has(status)) {
      patch = { meta: { ...meta, hl_status: st.status, hl_checked_at: stamp }, status: "failed", error: `HighLevel: ${st.error ?? st.status}` };
      out.failed += 1;
    } else if (st && DELIVERED.has(status)) {
      patch = { meta: { ...meta, hl_status: st.status, hl_checked_at: stamp } };
      out.delivered += 1;
    } else if (age > GIVE_UP_AFTER_MS || !id) {
      /* a day without a verdict, or nothing to ask about: closed as unknown
         rather than asked about forever */
      patch = { meta: { ...meta, hl_status: "unknown", hl_checked_at: stamp } };
      out.unknown += 1;
    } else if (st) {
      /* pending, sent, scheduled: HighLevel has not finished with it, so the
         row stays open and is asked about again */
      patch = { meta: { ...meta, hl_status: st.status, hl_looked_at: stamp } };
      out.pending += 1;
    } else continue; /* HighLevel could not be asked; the next run tries again */
    await db.from("email_log").update(patch).eq("id", String(r.id));
  }
  return out;
}
