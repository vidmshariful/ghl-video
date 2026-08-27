/*
 * What counts as being in the portal, and what counts as arriving.
 *
 * Deliberately not server-only: it holds two numbers and one pure function,
 * no secrets and no database, and the guard would only stop the unit suite
 * from importing it.
 *
 * Both the writer (app/api/portal/activity) and the reader
 * (app/api/admin/customers/[id]/activity) have to agree on these, or the log
 * says one thing and the screen says another.
 */

/*
 * Presence rows are refreshed every 45 seconds by an open tab, so anything
 * seen inside two minutes is still there and anything older is a tab that was
 * closed or a laptop that went to sleep. Two minutes rather than one because a
 * missed beat on a slow connection should not blink somebody offline.
 */
export const ONLINE_MS = 2 * 60 * 1000;

/*
 * A visit, not a session token.
 *
 * Supabase fires SIGNED_IN on every token refresh, every new tab and every
 * remount, and the log recorded each one. Emma's single visit to the HighLevel
 * portal went in as sixteen sign ins across eight minutes, which turns "has
 * anyone from HighLevel been in this week" into a wall of duplicates and
 * answers it with a number nobody can use.
 *
 * So a sign in within half an hour of that person's last one is the same
 * visit. Long enough to swallow token refreshes and a walk to make coffee,
 * short enough that coming back tomorrow reads as coming back.
 */
export const VISIT_GAP_MS = 30 * 60 * 1000;

/*
 * Is this sign in an arrival, or the same person still here?
 *
 * The writer's half of the same rule collapseVisits applies to rows already
 * written, kept beside it so the two can never drift into disagreeing about
 * what a visit is. `last` is that person's most recent event on that account,
 * or null if they have never been seen.
 */
export function isNewVisit(
  last: { kind: string; at: string } | null,
  now: number,
): boolean {
  if (!last) return true;
  /* a sign out ended the visit, so coming back is a new one however soon */
  if (last.kind !== "signed_in") return true;
  return now - Date.parse(last.at) >= VISIT_GAP_MS;
}

export type ActivityEvent = {
  id: string;
  email: string;
  kind: "signed_in" | "signed_out";
  at: string;
};

/*
 * Collapse runs of repeated sign ins into the arrival they actually were.
 *
 * The writer now skips the duplicates, so this is for the rows written before
 * it did. It keeps the EARLIEST row of a run, because that is the moment the
 * person actually turned up. A sign out ends a run: signing back in after it
 * is a new visit however soon it happens.
 *
 * Takes and returns newest first, which is the order the screen wants.
 */
export function collapseVisits(events: ActivityEvent[]): ActivityEvent[] {
  const oldestFirst = [...events].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const kept: ActivityEvent[] = [];
  const runEndsAt = new Map<string, number>();

  for (const e of oldestFirst) {
    if (e.kind !== "signed_in") {
      kept.push(e);
      runEndsAt.delete(e.email);
      continue;
    }
    const at = Date.parse(e.at);
    const previous = runEndsAt.get(e.email);
    /* still inside the same visit: extend it rather than recording another
       arrival, so a tab open all day stays one line and not one per refresh */
    if (previous !== undefined && at - previous < VISIT_GAP_MS) {
      runEndsAt.set(e.email, at);
      continue;
    }
    kept.push(e);
    runEndsAt.set(e.email, at);
  }

  return kept.reverse();
}
