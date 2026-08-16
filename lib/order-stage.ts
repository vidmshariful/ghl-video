/*
 * Where is this order? Answered once, from the videos it owes.
 *
 * Before this, an order's stage was typed by hand in three separate places
 * (the Orders editor, the board arrows, and implicitly by the per-video
 * statuses). Nothing kept them in agreement, so all nine videos could read
 * "Ready to review" while the order still said "In production", and the client
 * saw both. The fix is not to sync two records, it is to derive one from the
 * other. The videos are the truth; the stage is a summary of them.
 *
 * It only speaks when the videos actually know something. Paid and Intake are
 * both "no video has started yet", and the difference between them is the
 * studio's own workflow, not anything the videos can see. Deriving those would
 * overwrite a human's judgement with a guess, so when every video is still
 * queued this returns null and leaves the stage alone.
 *
 * Two further exceptions:
 *
 *  - Delivered is never derived. That move is what sends the client their
 *    delivery email, so it stays a button a person presses. Owner's decision,
 *    August 2026.
 *  - Once an order IS delivered, nothing recalculates it. A late revision
 *    should not quietly drag a finished job back onto the board.
 */
import type { DeliverableStatus } from "@/lib/deliverable-status";

export type FulfillmentStage = "paid" | "intake" | "production" | "review" | "delivered";

export type StageInput = {
  /** the order's current stage, so delivered can stay put */
  current: string;
  /** has the client sent their branding brief */
  intakeCompleted: boolean;
  /** every video owed on this order */
  statuses: DeliverableStatus[];
};

/**
 * The stage this order should be at, given its videos. Returns null when the
 * stage should be left exactly as it is.
 */
export function deriveStage(input: StageInput): FulfillmentStage | null {
  // A finished job stays finished. Only a person re-opens it.
  if (input.current === "delivered") return null;

  const s = input.statuses;

  // Nothing to summarise, so nothing to say. An invoice or a product with no
  // catalog videos keeps whatever stage a person gave it.
  if (s.length === 0) return null;

  // Every video has a link the client can watch, so the order is with them.
  // Approved counts as watchable: it stays in Review until somebody presses
  // Deliver, because that press is what emails the client.
  if (s.every((x) => x === "ready" || x === "approved")) return "review";

  // Anything actively moving, including changes coming back, is production.
  if (s.some((x) => x === "in_production" || x === "revisions" || x === "ready")) {
    return "production";
  }

  // Every video still queued. The videos cannot tell Paid from Intake, and
  // guessing would overwrite the studio's own triage, so say nothing.
  return null;
}

/** Human sentence for why the stage says what it says, shown on the job page. */
export function stageReason(input: StageInput): string {
  if (input.current === "delivered") return "Delivered. This no longer moves on its own.";
  const s = input.statuses;
  if (!s.length) {
    return input.intakeCompleted
      ? "No videos listed on this order."
      : "Waiting on the client's branding brief.";
  }
  const ready = s.filter((x) => x === "ready" || x === "approved").length;
  if (ready === s.length) return `All ${s.length} videos are with the client.`;
  if (s.some((x) => x === "revisions")) return "Changes came back from the client.";
  // Any progress at all deserves the count. Checking only for in_production
  // read "nothing started yet" while a video was already sitting with the
  // client, which is the opposite of the truth.
  if (ready > 0 || s.some((x) => x === "in_production")) {
    return `${ready} of ${s.length} videos ready.`;
  }
  return input.intakeCompleted
    ? "Nothing started yet."
    : "Waiting on the client's branding brief.";
}
