/*
 * When to ask "did the video do anything for you", and about which video.
 *
 * Pure and import-free so the rules can be tested directly. They look small,
 * and every one of them is a way to be quietly obnoxious if wrong: ask too
 * soon and the honest answer is always "too early", ask twice about an
 * answered video and the portal becomes a survey, never re-ask a rain check
 * and the answer we wanted most is lost.
 *
 * The rules:
 *   - Ask 14 days after approval, not on the day. The video needs time in
 *     the world to have done anything.
 *   - One video at a time, the one approved longest ago first: it has the
 *     most to report.
 *   - An answer closes the question for good, including "skipped".
 *   - "Too early to tell" is the exception: it reopens after 30 days,
 *     because it is a rain check, not an answer.
 */

export const ASK_AFTER_DAYS = 14;
export const REASK_TOO_EARLY_DAYS = 30;

export type FeedbackVerdict = "working" | "too_early" | "not_really" | "skipped";

export type ApprovedVideo = {
  deliverableId: string;
  title: string;
  /** ISO timestamp of the client's approval */
  approvedAt: string;
};

export type PriorAnswer = {
  deliverableId: string;
  verdict: FeedbackVerdict;
  /** ISO timestamp of when they answered */
  answeredAt: string;
};

const DAY_MS = 86_400_000;

/** Has this video been out long enough to have a story? */
export function oldEnoughToAsk(approvedAt: string, now: Date): boolean {
  return now.getTime() - new Date(approvedAt).getTime() >= ASK_AFTER_DAYS * DAY_MS;
}

/** Does this prior answer still close the question? */
export function stillBlocks(answer: PriorAnswer, now: Date): boolean {
  if (answer.verdict !== "too_early") return true;
  return now.getTime() - new Date(answer.answeredAt).getTime() < REASK_TOO_EARLY_DAYS * DAY_MS;
}

/** The one video to ask about right now, or null for a quiet dashboard. */
export function pickAsk(
  approved: ApprovedVideo[],
  answers: PriorAnswer[],
  now: Date,
): ApprovedVideo | null {
  const blocked = new Set(
    answers.filter((a) => stillBlocks(a, now)).map((a) => a.deliverableId),
  );
  const candidates = approved
    .filter((v) => oldEnoughToAsk(v.approvedAt, now) && !blocked.has(v.deliverableId))
    .sort((a, b) => new Date(a.approvedAt).getTime() - new Date(b.approvedAt).getTime());
  return candidates[0] ?? null;
}
