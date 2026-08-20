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

export const STATIONS: Record<
  StationKey,
  {
    label: string;
    /* can the client be handed this station's file */
    clientFile: boolean;
    /* can "provided by client" apply here */
    providable: boolean;
    defaultGate: boolean;
  }
> = {
  script: { label: "Script", clientFile: true, providable: true, defaultGate: true },
  voiceover: { label: "Voiceover", clientFile: true, providable: true, defaultGate: true },
  design: { label: "Concept and design", clientFile: true, providable: false, defaultGate: false },
  animation: { label: "Animation", clientFile: true, providable: false, defaultGate: true },
  sfx: { label: "Sound design", clientFile: false, providable: false, defaultGate: false },
  delivery: { label: "Final delivery", clientFile: true, providable: false, defaultGate: true },
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
      gate: typeof s.gate === "boolean" ? s.gate : STATIONS[k].defaultGate,
      url: typeof s.url === "string" && s.url.trim() ? s.url.trim() : null,
      at: typeof s.at === "string" ? s.at : null,
      eta: typeof s.eta === "string" && s.eta ? s.eta : null,
    };
    /* a piece the client provided is done by definition and never gated */
    if (base[k].provided) {
      base[k].state = "done";
      base[k].gate = false;
    }
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

/** The station line in the client's words. */
export function clientStationWord(key: StationKey, s: Station): string {
  if (s.provided) return "You provided this";
  if (s.state === "done") return STATIONS[key].defaultGate && s.gate ? "Approved" : "Done";
  if (s.state === "with_client") return "Waiting on you";
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
