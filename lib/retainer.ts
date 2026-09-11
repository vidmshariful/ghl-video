/*
 * A retainer partnership: a flat monthly fee for a number of videos a month.
 *
 * HighLevel was the first (September 2026): $11,000 a month for 8 to 12
 * videos, two in production at a time, three business days each, a
 * white-label version of every one, paid upfront on the first. Their work
 * is not priced per video, so every screen that says "unpaid" or "no price
 * yet" about it is wrong, and the one question the studio has each month,
 * how many have we made them, needs an answer nobody counts by hand.
 *
 * The terms live as JSON on the customer row; this file is the only place
 * that decides the shape. A job under the retainer carries the month it
 * counts in and whether it counts at all: a video does, a small social
 * animation is included in the fee but sits outside the count (owner
 * decisions, 12 September 2026).
 *
 * Client-safe: no server imports, so the portal, the admin and the routes
 * all read the same numbers.
 */

export type Retainer = {
  /** what the client's screen calls it */
  name: string;
  monthlyCents: number;
  videosMin: number;
  videosMax: number;
  /** how many jobs may be in production at once */
  activeMax: number;
  /** business days from brief to delivery */
  turnaroundDays: number;
  /** a white-label version of every video */
  whiteLabel: boolean;
  /** first day of the first month, YYYY-MM-DD */
  startedOn: string;
  /** the next check-in, YYYY-MM-DD, or null */
  checkInOn: string | null;
  note: string | null;
};

export const RETAINER_KINDS = ["video", "animation"] as const;
export type RetainerKind = (typeof RETAINER_KINDS)[number];

export const RETAINER_KIND_LABEL: Record<RetainerKind, string> = {
  video: "Counted video",
  animation: "Small animation, included",
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

const int = (v: unknown, fallback: number, min = 0): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min ? n : fallback;
};

/**
 * The terms, from whatever is stored or typed. Null unless there is a real
 * monthly fee, so a cleared card and an empty object both mean "no retainer".
 * Missing fields take the HighLevel defaults, which are the terms the
 * partnership was built around.
 */
export function parseRetainer(raw: unknown): Retainer | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const monthlyCents = int(r.monthlyCents, 0);
  if (monthlyCents <= 0) return null;
  const videosMin = int(r.videosMin, 8, 1);
  const videosMax = Math.max(videosMin, int(r.videosMax, 12, 1));
  const startedOn =
    typeof r.startedOn === "string" && DAY.test(r.startedOn) ? r.startedOn : `${monthKey(new Date())}-01`;
  return {
    name: typeof r.name === "string" && r.name.trim() ? r.name.trim().slice(0, 80) : "Retainer partnership",
    monthlyCents,
    videosMin,
    videosMax,
    activeMax: int(r.activeMax, 2, 1),
    turnaroundDays: int(r.turnaroundDays, 3, 1),
    whiteLabel: r.whiteLabel !== false,
    startedOn,
    checkInOn: typeof r.checkInOn === "string" && DAY.test(r.checkInOn) ? r.checkInOn : null,
    note: typeof r.note === "string" && r.note.trim() ? r.note.trim().slice(0, 1000) : null,
  };
}

/** YYYY-MM for a date, in UTC, which is the month the platform files under. */
export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const isMonthKey = (v: unknown): v is string => typeof v === "string" && MONTH.test(v);

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "September 2026" for "2026-09". */
export function monthLabel(key: string): string {
  const m = Number(key.slice(5, 7));
  return MONTHS[m - 1] ? `${MONTHS[m - 1]} ${key.slice(0, 4)}` : key;
}

/**
 * Every month the retainer has run, newest first, from the month it started
 * to the month containing `now`. The history table reads this so a quiet
 * month still shows as a row with zeros rather than vanishing.
 */
export function retainerMonths(startedOn: string, now: Date): string[] {
  const out: string[] = [];
  const first = isMonthKey(startedOn.slice(0, 7)) ? startedOn.slice(0, 7) : monthKey(now);
  const last = monthKey(now);
  let y = Number(first.slice(0, 4));
  let m = Number(first.slice(5, 7));
  for (let i = 0; i < 120; i += 1) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push(key);
    if (key >= last) break;
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out.reverse();
}

/* the studio's project stages, read as three states a partner cares about */
const ACTIVE = new Set(["planning", "in_progress", "review", "revision"]);
const DELIVERED = new Set(["approved", "cutdowns", "closed"]);

export type RetainerJob = {
  retainerMonth: string | null;
  retainerKind: RetainerKind | null;
  status: string;
};

export type MonthSummary = {
  month: string;
  /** videos briefed this month that count toward the 8 to 12 */
  counted: number;
  delivered: number;
  inProduction: number;
  queued: number;
  /** small animations this month, included in the fee, outside the count */
  animations: number;
  /** jobs in production right now, whatever month they were briefed in */
  activeNow: number;
};

/** How a month stands, from the jobs on the account. Cancelled jobs are not jobs. */
export function monthSummary(jobs: RetainerJob[], month: string): MonthSummary {
  const live = jobs.filter((j) => j.retainerKind && j.status !== "cancelled");
  const mine = live.filter((j) => j.retainerMonth === month);
  const videos = mine.filter((j) => j.retainerKind === "video");
  return {
    month,
    counted: videos.length,
    delivered: videos.filter((j) => DELIVERED.has(j.status)).length,
    inProduction: videos.filter((j) => ACTIVE.has(j.status)).length,
    queued: videos.filter((j) => j.status === "backlog").length,
    animations: mine.filter((j) => j.retainerKind === "animation").length,
    activeNow: live.filter((j) => ACTIVE.has(j.status)).length,
  };
}

/** "2 of 8 to 12" and its friends, said once here rather than on three screens. */
export function countLine(s: MonthSummary, r: Retainer): string {
  const videos = `${s.counted} ${s.counted === 1 ? "video" : "videos"} briefed of ${r.videosMin} to ${r.videosMax}`;
  const anim = s.animations
    ? `, ${s.animations} small ${s.animations === 1 ? "animation" : "animations"} included`
    : "";
  return `${videos}${anim}.`;
}
