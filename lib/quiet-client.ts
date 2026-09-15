/*
 * When a client has gone quiet, the video is approved on their behalf.
 *
 * Owner's decision, 16 September 2026: after the two reminders the sweep is
 * allowed to send, and a further week of silence, a premade video sitting in
 * Ready is approved for the client, the order closes when that was the last
 * one, and the client is told plainly why and how to reopen it. Fifteen videos
 * had sat with clients for weeks with nothing moving; the handbook already let
 * the producer approve by hand, this makes it a rule the client is told about.
 *
 * Pure arithmetic, like the chase policy it follows: the ledger of reminders
 * lives in the email log, and this only reads what it is handed.
 */
import { CHASE_MAX } from "@/lib/pipeline";

export const QUIET_DAYS_AFTER_LAST_NUDGE = 7;

const DAY_MS = 86_400_000;

export function quietForApproval(
  priorChases: { count: number; lastAtIso: string | null },
  nowIso: string,
): boolean {
  if (priorChases.count < CHASE_MAX || !priorChases.lastAtIso) return false;
  const last = Date.parse(priorChases.lastAtIso);
  if (!Number.isFinite(last)) return false;
  return Date.parse(nowIso) - last >= QUIET_DAYS_AFTER_LAST_NUDGE * DAY_MS;
}

/** The line the client reads on their order, and gets by email. */
export function approvedOnBehalfLine(titles: string[]): string {
  const list = titles.length === 1 ? titles[0] : `${titles.length} videos (${titles.join(", ")})`;
  return `After two reminders and a week without a reply, we approved ${list} on your behalf so your order can close. If you still want changes, reply to this email or message us from your portal and we will reopen it.`;
}
