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
  { key: "waiting", label: "Footage to check" },
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
 * The first column is a queued request whose footage nobody has opened yet.
 * It is a derived column rather than a sixth status on purpose: the five
 * statuses are shared with premade and custom work, and forking that
 * vocabulary for one service line is how two boards start describing the
 * same thing differently.
 *
 * It used to be called "Needs footage", which was wrong in the only case that
 * actually happens. The portal REQUIRES a footage link, so a client-made
 * request always arrives with one, and calling that "needs footage" told a
 * paying client they owed us something they had already sent, and told the
 * studio the ball was in the client's court when it was in ours. Whether the
 * client still owes us a link is a different question, and `owesFootage`
 * below is the one that answers it.
 */
export function columnFor(r: {
  status: string;
  assetsReadyAt: string | null;
}): EditingColumn {
  if (r.status === "queued" && !r.assetsReadyAt) return "waiting";
  return (r.status as EditingColumn) ?? "queued";
}

/**
 * Does the client actually still owe us the footage?
 *
 * Only true when no link was ever given, which from the portal cannot happen
 * and from the studio's own "add a request for them" form can. Everything
 * else in the first column is ours to check, not theirs to send.
 */
export function owesFootage(r: { assetsUrl?: string | null; assetsReadyAt: string | null }): boolean {
  return !r.assetsReadyAt && !r.assetsUrl;
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
 * The shape a kind of edit is cut in unless the client says otherwise.
 *
 * Short form is made for a phone held upright, and everything longer is
 * watched on a screen that is wider than it is tall. Asking somebody to pick
 * that every time is asking them to restate the obvious, and "Not sure, you
 * choose" was the option most of them took. So the shape is chosen for them
 * and the other two stay on the menu for when the obvious is wrong.
 */
export function defaultAspectFor(editType: string): Aspect {
  return editType === "short" ? "9:16" : "16:9";
}

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
    /* The client nearly always DID send a link, because the portal will not
       take a request without one. So this stage is us checking it, not them
       owing it, and it is blue like the rest of the work in our hands. The
       "you still owe us a link" case is real but rare, and the screen says
       that separately when `owesFootage` is true. */
    key: "waiting",
    label: "Checking your footage",
    tone: "info",
    blurb: "We open every link before we promise a date.",
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
    label: "Approved",
    tone: "good",
    blurb: "Approved and yours. Watch it or download it any time.",
  },
] as const;

export type ClientStage = (typeof CLIENT_STAGES)[number]["key"];

/*
 * The three phases a client's month is read in.
 *
 * The six stages above are right on a single card: "Under revisions" and
 * "Needs your approval" are genuinely different things and the client has to
 * know which one they are looking at. As a way to ORDER a list they are too
 * fine. Somebody opening their month asks three questions, in this order:
 * what have you not started, what is moving, and what is finished. Six
 * headings answer none of them. Owner decision, 25 August 2026.
 *
 * The stage tag stays on every card, so nothing is lost by grouping: the
 * heading is the coarse answer and the tag is the exact one.
 */
export const CLIENT_PHASES = [
  {
    key: "backlog",
    label: "Backlog",
    blurb: "Asked for. Not started yet.",
    stages: ["waiting", "queued"],
  },
  {
    key: "production",
    label: "In production",
    blurb: "With an editor, or waiting on you.",
    stages: ["in_production", "ready", "revisions"],
  },
  {
    key: "approved",
    label: "Approved",
    blurb: "Finished and yours to use.",
    stages: ["approved"],
  },
] as const;

export type ClientPhase = (typeof CLIENT_PHASES)[number]["key"];

export function phaseFor(stage: string): ClientPhase {
  const hit = CLIENT_PHASES.find((p) => (p.stages as readonly string[]).includes(stage));
  return hit?.key ?? "backlog";
}

/**
 * Is the ball in the client's court on this one?
 *
 * Two cases, and only two: a cut is waiting for them to approve it, or we
 * never got the footage. Everything else is ours. This is what sorts a list,
 * because the one thing a client should never have to hunt for is the thing
 * we are waiting on them for.
 */
export function needsClient(r: { status?: string; column?: string; assetsUrl?: string | null }): boolean {
  const at = r.column ?? r.status;
  if (at === "ready") return true;
  return at === "waiting" && !r.assetsUrl;
}

export const CLIENT_STATUS_WORD: Record<string, string> = Object.fromEntries(
  CLIENT_STAGES.map((s) => [s.key, s.label]),
);

export const stageFor = (key: string) =>
  CLIENT_STAGES.find((s) => s.key === key) ?? CLIENT_STAGES[1];

/*
 * What a drag between board columns MEANS, as the patch the API takes.
 *
 * A drop is a statement about the work: into "Needs footage" says the files
 * are not usable, out of it says they arrived. Translating here, in the
 * same file as the columns, keeps a drag and a button press identical to
 * the server, whose gates (QC before Review) still get the final word.
 */
export function boardMovePatch(
  from: EditingColumn,
  to: EditingColumn,
): Record<string, unknown> {
  if (to === "waiting") return { assetsReady: false, status: "queued" };
  const patch: Record<string, unknown> = { status: to };
  if (from === "waiting") patch.assetsReady = true;
  return patch;
}
