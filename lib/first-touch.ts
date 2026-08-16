/*
 * First-touch attribution: the page a buyer FIRST landed on, where they came
 * from, and when. Set once by proxy.ts and never overwritten, so a visitor who
 * reads a blog post in August and orders in October is still credited to that
 * post rather than to whatever page they happened to be on when they clicked
 * buy. At these price points nobody buys on the first visit, so last-click
 * would credit the checkout page for everything and teach us nothing.
 *
 * Kept small and edge-safe: this parses on every request.
 */

export const FIRST_TOUCH_COOKIE = "ghlv_ft";
/** the same 90 day window the affiliate ref cookie uses */
export const FIRST_TOUCH_TTL = 60 * 60 * 24 * 90;

export type FirstTouch = {
  /** path only, no query or hash */
  path: string;
  /** the referring host, e.g. "google.com", or null for direct */
  referrer: string | null;
  /** utm_source or utm_campaign if the link carried one */
  campaign: string | null;
  /** unix seconds of the first visit */
  at: number;
};

/* Everything here comes off a URL or a header a stranger controls, so each
 * field is length-capped and stripped of anything that is not tame. */
const clean = (s: string, max: number) =>
  s.replace(/[^\w\-./: ]/g, "").trim().slice(0, max) || "";

export function buildFirstTouch(
  pathname: string,
  referrerHeader: string | null,
  params: URLSearchParams,
): FirstTouch {
  let referrer: string | null = null;
  if (referrerHeader) {
    try {
      const host = new URL(referrerHeader).hostname.replace(/^www\./, "");
      // our own pages are not a referral source
      if (host && !/(^|\.)ghlvideo\.com$/i.test(host)) referrer = clean(host, 60);
    } catch {
      /* malformed referer: treat as direct */
    }
  }
  const campaignRaw =
    params.get("utm_campaign") ?? params.get("utm_source") ?? params.get("gclid") ?? null;

  return {
    path: clean(pathname.split("?")[0], 160) || "/",
    referrer,
    campaign: campaignRaw ? clean(campaignRaw, 60) || null : null,
    at: Math.floor(Date.now() / 1000),
  };
}

/* Plain JSON on purpose: NextResponse.cookies.set() percent-encodes the value
 * itself, and encoding here too produced a double-encoded cookie that
 * decodeFirstTouch could not parse. One encode out, one decode back. */
export function encodeFirstTouch(ft: FirstTouch): string {
  return JSON.stringify({ p: ft.path, r: ft.referrer, c: ft.campaign, t: ft.at });
}

function decodeFirstTouch(raw: string): FirstTouch | null {
  try {
    const o = JSON.parse(decodeURIComponent(raw)) as {
      p?: string;
      r?: string | null;
      c?: string | null;
      t?: number;
    };
    if (!o.p) return null;
    return {
      path: clean(o.p, 160) || "/",
      referrer: o.r ? clean(o.r, 60) || null : null,
      campaign: o.c ? clean(o.c, 60) || null : null,
      at: Number(o.t) || Math.floor(Date.now() / 1000),
    };
  } catch {
    return null;
  }
}

/** Read the first touch out of a raw Cookie header (server routes). */
export function firstTouchFromCookieHeader(
  cookieHeader: string | null | undefined,
): FirstTouch | null {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(/(?:^|;\s*)ghlv_ft=([^;]+)/);
  return m ? decodeFirstTouch(m[1]) : null;
}

/* Paths that are not a first touch worth recording: someone deep-linked
 * straight into checkout or a portal did not "discover" us there. */
const NOT_A_LANDING = ["/checkout", "/admin", "/portal", "/partners", "/api", "/unlock"];

export function isRecordableLanding(pathname: string): boolean {
  const p = pathname.toLowerCase();
  return !NOT_A_LANDING.some((pre) => p === pre || p.startsWith(`${pre}/`));
}

/** One plain-language line for the admin order screen. */
export function describeFirstTouch(ft: FirstTouch, paidAtIso?: string | null): string {
  const source = ft.referrer
    ? ft.referrer.includes("google")
      ? "Google"
      : ft.referrer
    : "typed the address or a link we cannot see";
  const parts = [`First landed on ${ft.path}`, `from ${source}`];
  if (ft.campaign) parts.push(`campaign ${ft.campaign}`);
  if (paidAtIso) {
    const days = Math.round((new Date(paidAtIso).getTime() / 1000 - ft.at) / 86_400);
    if (days >= 1) parts.push(`${days} day${days === 1 ? "" : "s"} before ordering`);
    else parts.push("and ordered the same day");
  }
  return `${parts.join(", ")}.`;
}
