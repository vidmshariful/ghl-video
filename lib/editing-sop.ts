/*
 * The editing SOP, written down once so every screen runs the same one.
 *
 * Import-free on purpose: the admin board, the client portal and the server
 * all need this vocabulary, and two of those are client components.
 *
 * The shape of the work, and why each step exists:
 *
 *  1. The request arrives with the fields an editor actually needs, not a
 *     paragraph. You cannot sort a queue by a paragraph.
 *  2. Footage is checked before anything is promised. The turnaround clock
 *     starts here, never at the request, because a client who asks on Monday
 *     and uploads on Thursday is not owed from Monday. This one rule is why
 *     editing shops look slow when they are not.
 *  3. An editor is named, and works to the client's style guide rather than
 *     to memory.
 *  4. The cut is made.
 *  5. QC runs before the client ever sees it. The same short list every
 *     time. This is the step that separates a studio from a freelancer, and
 *     it costs a minute.
 *  6. The client reviews, asks for changes, approves.
 */

/** The board, in the studio's words. Derived from status, not stored. */
export const EDITING_COLUMNS = [
  { key: "waiting", label: "Needs footage" },
  { key: "queued", label: "Edit request" },
  { key: "in_production", label: "In progress" },
  { key: "ready", label: "Review" },
  { key: "revisions", label: "Changes" },
  { key: "approved", label: "Approved" },
] as const;

export type EditingColumn = (typeof EDITING_COLUMNS)[number]["key"];

/**
 * Which column a request sits in.
 *
 * "Needs footage" is a queued request with nothing to edit yet. It is a
 * derived column rather than a sixth status on purpose: the five statuses
 * are shared with premade and custom work, and forking that vocabulary for
 * one service line is how two boards start describing the same thing
 * differently.
 */
export function columnFor(r: {
  status: string;
  assetsReadyAt: string | null;
}): EditingColumn {
  if (r.status === "queued" && !r.assetsReadyAt) return "waiting";
  return (r.status as EditingColumn) ?? "queued";
}

/*
 * The checks that run before a cut reaches a client.
 *
 * Six, and no more. A twenty item checklist gets ticked without being read,
 * which is worse than no checklist because it manufactures a record of care
 * that did not happen. These are the six things clients actually come back
 * about.
 */
export const QC_CHECKS = [
  { key: "audio", label: "Audio levelled, no clipping, no dead air" },
  { key: "captions", label: "Captions spelled right, names and brands included" },
  { key: "brand", label: "Their logo, colours and lower thirds, from the style guide" },
  { key: "format", label: "Right aspect and resolution for where it is going" },
  { key: "topTail", label: "Clean top and tail, no black frames, no stray audio" },
  { key: "export", label: "Exported to spec and named the way we name things" },
] as const;

export type QcKey = (typeof QC_CHECKS)[number]["key"];
export type Qc = Partial<Record<QcKey, boolean>>;

/** Every check ticked. What has to be true before a cut goes to a client. */
export function qcPassed(qc: Qc | null | undefined): boolean {
  return QC_CHECKS.every((c) => Boolean(qc?.[c.key]));
}

export function qcRemaining(qc: Qc | null | undefined): string[] {
  return QC_CHECKS.filter((c) => !qc?.[c.key]).map((c) => c.label);
}

/** The sizes we cut to, and what each is for. */
export const ASPECTS = [
  { key: "16:9", label: "16:9 wide", note: "YouTube, a website, a webinar replay" },
  { key: "9:16", label: "9:16 vertical", note: "Reels, Shorts, TikTok" },
  { key: "1:1", label: "1:1 square", note: "Feed posts and ads" },
] as const;

export type Aspect = (typeof ASPECTS)[number]["key"];

/**
 * How many rounds of changes are included.
 *
 * Premade videos include one, which is what that page sells. The editing
 * plans sell "Unlimited revisions" in as many words on every tier, so an
 * editing client gets exactly that. Getting this wrong in either direction
 * breaks a promise somebody paid against.
 */
export const EDITING_REVISIONS_UNLIMITED = true;

/*
 * The stages, in the client's words, and the colour each one carries.
 *
 * A list of requests all painted the same reads as one undifferentiated pile,
 * which is the thing this exists to stop. The two that need the client to do
 * something lead in gold, work in hand is blue, and finished is green: the
 * eye finds "you owe us something" before it reads a word.
 *
 * These are the studio's own column names said from the other side. Nobody
 * should have to translate between the board and the portal on a call.
 */
export const CLIENT_STAGES = [
  {
    key: "waiting",
    label: "Needs your footage",
    tone: "warn",
    blurb: "We cannot start until we can open your files.",
  },
  {
    key: "queued",
    label: "Backlog",
    tone: "neutral",
    blurb: "In the queue. We work through them in order.",
  },
  {
    key: "in_production",
    label: "Being edited",
    tone: "info",
    blurb: "An editor has it.",
  },
  {
    key: "ready",
    label: "Needs your approval",
    tone: "warn",
    blurb: "Watch it, leave your notes, approve it when it is right.",
  },
  {
    key: "revisions",
    label: "Under revisions",
    tone: "bad",
    blurb: "We are making the changes you asked for.",
  },
  {
    key: "approved",
    label: "Done",
    tone: "good",
    blurb: "Approved and yours.",
  },
] as const;

export type ClientStage = (typeof CLIENT_STAGES)[number]["key"];

export const CLIENT_STATUS_WORD: Record<string, string> = Object.fromEntries(
  CLIENT_STAGES.map((s) => [s.key, s.label]),
);

export const stageFor = (key: string) =>
  CLIENT_STAGES.find((s) => s.key === key) ?? CLIENT_STAGES[1];
