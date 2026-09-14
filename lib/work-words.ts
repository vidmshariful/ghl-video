/*
 * One status language across the three lines (phase 6, September 2026).
 *
 * A premade order walks paid, intake, production, review, delivered. A
 * custom project walks backlog to closed through six stations. An editing
 * request walks queued, in production, ready, revisions, approved. Three
 * vocabularies for one question: whose move is it, and what is happening.
 * Every screen from here on says it the same way: a side, a word, and the
 * line it belongs to. The stored statuses do not change; this is how they
 * are said.
 *
 * Import-free on purpose: the portal, admin and the tests all read it.
 */

export type Line = "premade" | "custom" | "editing";

export const LINE_WORD: Record<Line, string> = {
  premade: "Pre-made",
  custom: "Custom",
  editing: "Editing",
};

/** Whose move it is. */
export type Side = "you" | "us" | "done" | "off";

/** The dot's colour, by side, so a list reads at a glance. */
export const SIDE_TONE: Record<Side, "gold" | "blue" | "green" | "dim"> = {
  you: "gold",
  us: "blue",
  done: "green",
  off: "dim",
};

export type WorkWord = {
  side: Side;
  /** what the client reads */
  client: string;
  /** what the studio reads */
  studio: string;
};

/* ---- premade: an order's stage, and its videos ---- */

export function orderWord(o: { status: string; stage: string; intakeCompleted: boolean }): WorkWord {
  if (o.status === "refunded") return { side: "off", client: "Refunded", studio: "Refunded" };
  if (o.status === "failed") return { side: "off", client: "Payment failed", studio: "Payment failed" };
  if (o.status === "paid" && !o.intakeCompleted) return { side: "you", client: "Needs your brief", studio: "Waiting on the brief" };
  switch (o.stage) {
    case "delivered":
      return { side: "done", client: "Delivered", studio: "Delivered" };
    case "review":
      return { side: "you", client: "Ready to watch", studio: "With the client" };
    case "production":
      return { side: "us", client: "Being made", studio: "In production" };
    case "intake":
      return { side: "us", client: "Brief received", studio: "Brief in, not started" };
    default:
      return { side: "us", client: "Booked in", studio: "Paid, not started" };
  }
}

/* ---- a video of any line: its deliverable status ---- */

export function videoWord(status: string, line: Line = "premade"): WorkWord {
  switch (status) {
    case "ready":
      return { side: "you", client: "Ready to watch", studio: "With the client" };
    case "revisions":
      return { side: "us", client: "Changes in hand", studio: "Revisions" };
    case "approved":
      return { side: "done", client: "Approved", studio: "Approved" };
    case "in_production":
      return { side: "us", client: line === "editing" ? "Being cut" : "Being made", studio: line === "editing" ? "Being cut" : "In production" };
    case "cancelled":
      return { side: "off", client: "Cancelled", studio: "Cancelled" };
    default:
      return { side: "us", client: "Queued", studio: "Queued" };
  }
}

/* ---- custom: a project's stage, or its station ---- */

const PROJECT_WORDS: Record<string, WorkWord> = {
  backlog: { side: "us", client: "Booked in", studio: "Backlog" },
  planning: { side: "us", client: "Being planned", studio: "Planning" },
  in_progress: { side: "us", client: "In progress", studio: "In progress" },
  review: { side: "you", client: "Ready for you", studio: "With the client" },
  revision: { side: "us", client: "Changes in hand", studio: "Revision" },
  approved: { side: "done", client: "Approved", studio: "Approved" },
  cutdowns: { side: "us", client: "Extra formats in the works", studio: "Cutdowns" },
  closed: { side: "done", client: "Complete", studio: "Closed" },
  cancelled: { side: "off", client: "Cancelled", studio: "Cancelled" },
};

export function projectWord(status: string, ball?: "us" | "client" | null, stationLabel?: string | null): WorkWord {
  const base = PROJECT_WORDS[status] ?? PROJECT_WORDS.backlog;
  /* the station is the finer word when the line has one: "Animation", "Voiceover" */
  if (ball === "client" && stationLabel) return { side: "you", client: `Needs you: ${stationLabel.toLowerCase()}`, studio: `Waiting on the client: ${stationLabel.toLowerCase()}` };
  if (ball === "us" && stationLabel && base.side === "us") return { side: "us", client: stationLabel, studio: stationLabel };
  return base;
}

/** The words for a group of work: "Two things need you. Three are in the studio." */
export function summarySentence(counts: { you: number; us: number }): string {
  const n = (k: number) => ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"][k] ?? String(k);
  const you = counts.you === 0 ? "Nothing needs you." : counts.you === 1 ? "One thing needs you." : `${n(counts.you)} things need you.`;
  const us = counts.us === 0 ? "Nothing is in the studio." : counts.us === 1 ? "One is in the studio." : `${n(counts.us)} are in the studio.`;
  return `${you} ${us}`;
}
