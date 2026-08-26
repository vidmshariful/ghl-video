import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * The alarm bell for the money path.
 *
 * Two rules govern everything in here, and both come from how the system
 * actually fails rather than from how monitoring usually works.
 *
 * 1. RAISING AN ALARM MUST NEVER BREAK THE THING THAT RAISED IT.
 *    Every path into this file is wrapped. An alarm that throws while
 *    reporting a payment problem would turn a recoverable fault into a lost
 *    order, which is precisely the outcome it exists to prevent. If the
 *    alarm cannot be written, it is logged and swallowed.
 *
 * 2. ONE FAILURE IS NOT NEWS. A PERSISTENT ONE IS.
 *    The webhook is designed to fail loudly and be retried: it throws, Stripe
 *    re-delivers, and the retry usually lands. Emailing on the first throw
 *    would mean an inbox full of problems that fixed themselves within the
 *    minute, and an owner who learns to ignore the alerts. So `notifyAfter`
 *    sets how many times a thing must happen before anyone is told, and it is
 *    picked per call site from whether a retry can plausibly save it.
 */

export type Severity = "warn" | "error" | "critical";

/*
 * Every alarm this system can raise.
 *
 * Kept as one list because a slug typed inline is a slug that gets misspelled
 * on its second use, and two spellings of one problem defeat the grouping
 * that makes this readable at all.
 */
export const ALARM_KINDS = {
  /** The Stripe webhook threw. Stripe will re-deliver. */
  WEBHOOK_FAILED: "webhook.event_failed",
  /** Paid and recorded, but the HighLevel sync did not land. */
  FULFILL_FAILED: "webhook.fulfill_failed",
  /** Money captured against an intent we cannot turn into an order. */
  ORPHAN_UNRECOVERABLE: "webhook.orphan_unrecoverable",
  /** The buyer pressed pay and the order write failed. */
  FINALIZE_FAILED: "checkout.finalize_failed",
  /** An order settled but its videos were not created. */
  DELIVERABLES_FAILED: "fulfillment.deliverables_failed",
  /** Editing credits were paid for and not added to the client's plan. */
  CREDITS_NOT_GRANTED: "fulfillment.credits_not_granted",
  /** A sale carrying a partner ref was not credited to anybody. */
  AFFILIATE_NOT_ATTRIBUTED: "fulfillment.affiliate_not_attributed",
  /** The amount charged is not the amount the order says it is. */
  AMOUNT_MISMATCH: "checkout.amount_mismatch",
  /** The site and checkout disagree about what something costs. */
  PRICE_DRIFT: "catalog.price_drift",
  /** The daily price check could not run, so nobody is watching. */
  DRIFT_CHECK_FAILED: "catalog.drift_check_failed",
  /** Fired on purpose from the Health screen, so the chain can be seen working. */
  TEST: "system.test",
} as const;

type RaiseInput = {
  kind: string;
  message: string;
  /** what the handler knew: order id, intent id, sku */
  context?: Record<string, unknown>;
  severity?: Severity;
  /*
   * What makes two occurrences the same problem. Defaults to the kind, which
   * groups every instance of that failure into one row.
   *
   * Add an id ONLY when each subject genuinely needs its own line, e.g. one
   * unrecoverable intent should not hide behind another. Never put a
   * timestamp or a random value in here: that gives every occurrence its own
   * fingerprint and turns the table back into the log nobody reads.
   */
  fingerprint?: string;
  /** how many occurrences before anybody is told. See rule 2 above. */
  notifyAfter?: number;
};

/** How long before the same unresolved problem is allowed to speak again. */
const RENOTIFY_AFTER_MS = 30 * 60 * 1000;

/**
 * Record that something broke. Safe to call from anywhere, including inside a
 * catch on the money path: it never throws and never rejects.
 */
export async function raise(db: SupabaseClient, input: RaiseInput): Promise<void> {
  try {
    const fingerprint = input.fingerprint ?? input.kind;
    const severity: Severity = input.severity ?? "error";
    const notifyAfter = input.notifyAfter ?? 1;

    /*
     * One statement, so concurrent webhook deliveries cannot both read a
     * count of 3 and both write 4. The conflict target is the unique
     * fingerprint, and `count` is incremented from the stored value rather
     * than from anything this process read earlier.
     *
     * resolved_at is cleared on purpose: a problem somebody marked fixed and
     * which then came back is re-opened rather than quietly staying closed.
     */
    const { data, error } = await db
      .rpc("raise_alarm", {
        p_kind: input.kind,
        p_severity: severity,
        p_fingerprint: fingerprint,
        p_message: input.message,
        p_context: input.context ?? {},
      })
      .single();

    if (error) {
      console.error(`[alarm] ${input.kind} not stored:`, error.message);
      return;
    }

    const row = data as {
      alarm_count: number;
      last_notified: string | null;
      was_reopened: boolean;
    } | null;
    if (!row) return;

    if (severity === "warn") return;
    if (row.alarm_count < notifyAfter) return;

    /* Throttle, unless it just came back from resolved, which is always worth
     * saying out loud immediately. */
    const last = row.last_notified ? Date.parse(row.last_notified) : 0;
    if (!row.was_reopened && last && Date.now() - last < RENOTIFY_AFTER_MS) return;

    await tell(db, {
      kind: input.kind,
      severity,
      message: input.message,
      count: row.alarm_count,
      reopened: row.was_reopened,
      context: input.context ?? {},
    });

    await db
      .from("alarms")
      .update({ notified_at: new Date().toISOString() })
      .eq("fingerprint", fingerprint);
  } catch (e) {
    /* Rule 1. Never let reporting a problem create a bigger one. */
    console.error(`[alarm] ${input.kind} failed:`, e instanceof Error ? e.message : e);
  }
}

/** Tell the team: the bell in every admin top bar, plus email when critical. */
async function tell(
  db: SupabaseClient,
  a: {
    kind: string;
    severity: Severity;
    message: string;
    count: number;
    reopened: boolean;
    context: Record<string, unknown>;
  },
): Promise<void> {
  const times = a.count > 1 ? ` (${a.count} times)` : "";
  const back = a.reopened ? "back again: " : "";
  const title = `${back}${humanKind(a.kind)}${times}`;

  try {
    const { pushAdminNotifications } = await import("@/lib/notifications");
    await pushAdminNotifications(db, {
      kind: "alarm",
      title,
      body: a.message.slice(0, 300),
      href: "health",
      vars: { headline: title, message: a.message.slice(0, 300) },
    });
  } catch (e) {
    console.error("[alarm] bell failed:", e instanceof Error ? e.message : e);
  }

  if (a.severity !== "critical") return;

  try {
    const { sendEmail } = await import("@/lib/email/send");
    const { wrapEmail } = await import("@/lib/email/templates");
    const { data } = await db.from("admins").select("email");
    const emails = (data ?? [])
      .map((r) => (r.email as string | null)?.toLowerCase())
      .filter((e): e is string => Boolean(e));

    const detail = Object.entries(a.context)
      .map(([k, v]) => `<li><strong>${k}:</strong> ${escape(String(v))}</li>`)
      .join("");

    const html = wrapEmail(`
      <h1>Something needs you</h1>
      <p>${escape(title)}</p>
      <p style="color:#9096A8">${escape(a.message)}</p>
      ${detail ? `<ul style="color:#9096A8">${detail}</ul>` : ""}
      <p>Open <strong>Admin, then Health</strong> to see it and mark it handled.</p>
    `);

    for (const to of emails) {
      await sendEmail({ to, subject: `Action needed: ${humanKind(a.kind)}`, html, log: { source: "alarm" } });
    }
  } catch (e) {
    console.error("[alarm] email failed:", e instanceof Error ? e.message : e);
  }
}

/* The owner is not going to learn our slugs, so every kind has a sentence. */
const HUMAN: Record<string, string> = {
  [ALARM_KINDS.WEBHOOK_FAILED]: "A payment update from Stripe could not be processed",
  [ALARM_KINDS.FULFILL_FAILED]: "A paid order did not reach HighLevel",
  [ALARM_KINDS.ORPHAN_UNRECOVERABLE]: "A payment came in that we could not turn into an order",
  [ALARM_KINDS.FINALIZE_FAILED]: "A buyer pressed pay and the order was not written",
  [ALARM_KINDS.DELIVERABLES_FAILED]: "An order was paid but its videos were not created",
  [ALARM_KINDS.CREDITS_NOT_GRANTED]: "Editing credits were paid for but never added to a plan",
  [ALARM_KINDS.AMOUNT_MISMATCH]: "An order was charged a different amount than it should have been",
  [ALARM_KINDS.PRICE_DRIFT]: "The site and checkout disagree about a price",
  [ALARM_KINDS.DRIFT_CHECK_FAILED]: "The daily price check could not run",
  [ALARM_KINDS.TEST]: "Test alarm, nothing is wrong",
};

export const humanKind = (kind: string) => HUMAN[kind] ?? kind;

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
