/*
 * What became of the emails HighLevel queued. A send through HighLevel is
 * accepted at once and delivered, or not, a moment later; the log row is
 * written as sent when queued and corrected here. One GET per recent row,
 * checked once, so the email log tells the truth about delivery too.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailStatus } from "./email";

type Row = Record<string, unknown>;

export async function refreshEmailStatuses(
  db: SupabaseClient,
  opts: { limit?: number; olderThanMs?: number } = {},
): Promise<{ checked: number; failed: number; delivered: number }> {
  const out = { checked: 0, failed: 0, delivered: 0 };
  const since = new Date(Date.now() - 6 * 3600_000).toISOString();
  const { data } = await db
    .from("email_log")
    .select("id, meta, created_at")
    .eq("status", "sent")
    .gte("created_at", since)
    .contains("meta", { provider: "highlevel" })
    .order("created_at", { ascending: true })
    .limit(opts.limit ?? 40);
  for (const r of (data ?? []) as Row[]) {
    const meta = (r.meta as Row | null) ?? {};
    if (meta.hl_checked_at || typeof meta.hl_message_id !== "string") continue;
    /* give HighLevel a moment to try before asking */
    if (Date.now() - Date.parse(String(r.created_at)) < (opts.olderThanMs ?? 20_000)) continue;
    const st = await emailStatus(meta.hl_message_id);
    if (!st) continue;
    out.checked += 1;
    const patch: Row = { meta: { ...meta, hl_status: st.status, hl_checked_at: new Date().toISOString() } };
    if (st.status === "failed" || st.status === "undelivered" || st.status === "bounced") {
      patch.status = "failed";
      patch.error = `HighLevel: ${st.error ?? st.status}`;
      out.failed += 1;
    } else if (st.status === "delivered" || st.status === "opened" || st.status === "clicked") out.delivered += 1;
    await db.from("email_log").update(patch).eq("id", String(r.id));
  }
  return out;
}
