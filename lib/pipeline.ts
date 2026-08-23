/*
 * The production line inside one custom video.
 *
 * Six stations, in the order the studio actually works: script, voiceover,
 * concept and design, animation, sound, final delivery. The project board
 * says where a JOB is; this says where one VIDEO is inside it, which is the
 * granularity a client actually worries about.
 *
 * Import-free and pure so the admin drawer, the portal and the tests all
 * read the same rules. The database half is a jsonb column on
 * order_deliverables; every write goes through these helpers so the shape
 * can never drift screen by screen.
 *
 * Approval gates follow the studio's real rules, not a template: script and
 * voiceover need approval only when WE made them (a client approving their
 * own script is theatre), design approval is off by default because clients
 * prefer reacting to animation, animation is THE review moment, sound is
 * internal, and delivery is the final sign-off.
 */

export type StationKey = "script" | "voiceover" | "design" | "animation" | "sfx" | "delivery";

export type StationState = "todo" | "with_us" | "with_client" | "done";

export type Station = {
  state: StationState;
  /* the client supplied this piece themselves, so no gate applies */
  provided?: boolean;
  /* whether client approval is wanted at this station */
  gate?: boolean;
  /* the current file or link for this station */
  url?: string | null;
  /* when it last moved, ISO */
  at?: string | null;
  /* when the studio expects this station to land, ISO date */
  eta?: string | null;
};

export type Pipeline = Record<StationKey, Station>;

export const STATION_ORDER: StationKey[] = [
  "script",
  "voiceover",
  "design",
  "animation",
  "sfx",
  "delivery",
];

/* How a stage's work is reviewed. The script reads as a document, the
   voiceover plays as audio, the concept is a PDF, the animation and the final
   cut are video, and sound design has nothing to show. One map, read by the
   client's review room, the studio's, and the APIs behind both, so a stage
   can never mean one medium on one screen and another elsewhere. */
export type ReviewMedium = "doc" | "audio" | "pdf" | "video";

export const STATIONS: Record<
  StationKey,
  {
    label: string;
    /* can the client be handed this station's file */
    clientFile: boolean;
    /* can "provided by client" apply here */
    providable: boolean;
    defaultGate: boolean;
    /* how this stage's work is shown for review, null when nothing is shown */
    reviewMedium: ReviewMedium | null;
  }
> = {
  /*
   * Only the video stops and waits (owner decision, 22 August 2026). A
   * client gives feedback by watching the animation, which is why they
   * never needed an approve button on a script, and certainly not on a
   * script they wrote themselves. Scripting, voiceover and design carry a
   * state and a file; the animation draft and the final delivery are the
   * two moments the work pauses for a person.
   */
  script: { label: "Scripting", clientFile: true, providable: true, defaultGate: false, reviewMedium: "doc" },
  voiceover: { label: "Voiceover", clientFile: true, providable: true, defaultGate: false, reviewMedium: "audio" },
  design: { label: "Concept and Design", clientFile: true, providable: false, defaultGate: false, reviewMedium: "pdf" },
  animation: { label: "Animation", clientFile: true, providable: false, defaultGate: true, reviewMedium: "video" },
  sfx: { label: "Sound Design", clientFile: false, providable: false, defaultGate: false, reviewMedium: null },
  delivery: { label: "Final delivery", clientFile: true, providable: false, defaultGate: true, reviewMedium: "video" },
};

export function defaultPipeline(): Pipeline {
  const p = {} as Pipeline;
  for (const k of STATION_ORDER) {
    p[k] = { state: "todo", gate: STATIONS[k].defaultGate, provided: false, url: null, at: null };
  }
  return p;
}

/** Whatever is stored, made whole: unknown keys dropped, missing ones defaulted. */
export function normalizePipeline(raw: unknown): Pipeline {
  const base = defaultPipeline();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  for (const k of STATION_ORDER) {
    const st = r[k];
    if (!st || typeof st !== "object") continue;
    const s = st as Record<string, unknown>;
    const state = s.state;
    base[k] = {
      state:
        state === "with_us" || state === "with_client" || state === "done" ? state : "todo",
      provided: STATIONS[k].providable ? Boolean(s.provided) : false,
      /* the gate is the station's, not the row's: a project written under
         the old four-gate model must not carry an approve button on its
         script forever */
      gate: STATIONS[k].defaultGate,
      url: typeof s.url === "string" && s.url.trim() ? s.url.trim() : null,
      at: typeof s.at === "string" ? s.at : null,
      eta: typeof s.eta === "string" && s.eta ? s.eta : null,
    };
    /* a piece the client provides carries no approval gate, but marking it
       theirs is a promise, not a receipt: the state still has to walk to
       done when the file actually lands */
    if (base[k].provided) base[k].gate = false;
  }
  return base;
}

/** The first station that is not finished: where the work stands. */
export function currentStation(p: Pipeline): StationKey | null {
  for (const k of STATION_ORDER) if (p[k].state !== "done") return k;
  return null;
}

/** Whose court the ball is in. Null once everything is done. */
export function ballInCourt(p: Pipeline): "us" | "client" | null {
  if (STATION_ORDER.every((k) => p[k].state === "done")) return null;
  return STATION_ORDER.some((k) => p[k].state === "with_client") ? "client" : "us";
}

/** 0..100, stations finished over stations total. */
export function pipelinePercent(p: Pipeline): number {
  const done = STATION_ORDER.filter((k) => p[k].state === "done").length;
  return Math.floor((done / STATION_ORDER.length) * 100);
}

/**
 * The coarse deliverable status every existing screen reads, derived from
 * the line, so the board, the dashboard counts and the client cards keep
 * telling the truth without learning anything new.
 */
export function statusForPipeline(
  p: Pipeline,
  revisionRound: number,
): "queued" | "in_production" | "ready" | "revisions" | "approved" {
  if (STATION_ORDER.every((k) => p[k].state === "done")) return "approved";
  if (STATION_ORDER.some((k) => p[k].state === "with_client")) return "ready";
  if (p.animation.state === "with_us" && revisionRound > 0) return "revisions";
  if (STATION_ORDER.some((k) => p[k].state !== "todo")) return "in_production";
  return "queued";
}

/** The station line in the client's words, saying exactly what is needed. */
export function clientStationWord(key: StationKey, s: Station): string {
  if (s.provided) {
    if (s.state === "done") return "You provided this";
    return s.url ? "Yours, checking it" : "We need this from you";
  }
  if (s.state === "done") return STATIONS[key].defaultGate ? "Approved" : "Done";
  if (s.state === "with_client") return s.gate ? "Needs your approval" : "With you";
  if (s.state === "with_us") return "With us";
  return "Not started";
}

/**
 * A client gate approval: the station closes and the next unfinished one
 * moves into our hands, so the ball never silently sits with nobody.
 */
export function approveStation(p: Pipeline, key: StationKey, atIso: string): Pipeline {
  const next: Pipeline = { ...p, [key]: { ...p[key], state: "done" as const, at: atIso } };
  for (const k of STATION_ORDER) {
    if (next[k].state !== "done" && next[k].state !== "with_client") {
      if (next[k].state === "todo") next[k] = { ...next[k], state: "with_us", at: atIso };
      break;
    }
    if (next[k].state === "with_client") break;
  }
  return next;
}

/** Changes requested at a gate: the station comes back to us. */
export function returnStation(p: Pipeline, key: StationKey, atIso: string): Pipeline {
  return { ...p, [key]: { ...p[key], state: "with_us", at: atIso } };
}

/* ---------------- the chase policy ---------------- */

/*
 * When a piece sits with the client, we remind them: once after three full
 * days, once more three days later, then we stop. A third nag is how a
 * studio email address ends up in a spam filter, and by then it is a phone
 * call anyway. The ledger of what was already sent lives in the email log,
 * so the policy here stays pure arithmetic.
 */
export const CHASE_AFTER_DAYS = 3;
export const CHASE_GAP_DAYS = 3;
export const CHASE_MAX = 2;

const DAY_MS = 86_400_000;

export function needsChase(
  withClientSinceIso: string | null,
  priorChases: { count: number; lastAtIso: string | null },
  nowIso: string,
): boolean {
  if (!withClientSinceIso) return false;
  if (priorChases.count >= CHASE_MAX) return false;
  const now = Date.parse(nowIso);
  if (now - Date.parse(withClientSinceIso) < CHASE_AFTER_DAYS * DAY_MS) return false;
  if (priorChases.lastAtIso && now - Date.parse(priorChases.lastAtIso) < CHASE_GAP_DAYS * DAY_MS)
    return false;
  return true;
}

/** Whole days a station has been waiting, for the reminder's wording. */
export function daysWaiting(sinceIso: string, nowIso: string): number {
  return Math.max(1, Math.floor((Date.parse(nowIso) - Date.parse(sinceIso)) / DAY_MS));
}

/* ---------------- the derived stage ---------------- */

/*
 * The list category computes itself from the line (owner decision,
 * 22 August 2026). Two hand-managed truths about where a project stands
 * kept drifting apart; now the studio moves stations and the category
 * follows, every time. Closed and cancelled stay manual: finishing a
 * relationship is a decision, not arithmetic.
 */
export type DerivedStage =
  | "backlog"
  | "planning"
  | "in_progress"
  | "review"
  | "revision"
  | "approved"
  | "cutdowns";

export function derivedStage(
  p: Pipeline,
  opts: { revisionRound: number; openFormats: number },
): DerivedStage {
  /* anything gated sitting in the client's court is a review, wherever
     the line otherwise stands */
  if (STATION_ORDER.some((k) => p[k].state === "with_client" && p[k].gate && !p[k].provided))
    return "review";
  if (p.delivery.state === "done") return opts.openFormats > 0 ? "cutdowns" : "approved";
  if (p.animation.state === "with_us" && opts.revisionRound > 0) return "revision";
  if (p.animation.state !== "todo" || p.sfx.state !== "todo" || p.delivery.state !== "todo")
    return "in_progress";
  /* pre-production: a script being written, a voiceover promised, a design
     underway. Marking a piece theirs counts: the wait for materials is work. */
  const pre: StationKey[] = ["script", "voiceover", "design"];
  if (pre.some((k) => p[k].state !== "todo" || p[k].provided)) return "planning";
  return "backlog";
}
