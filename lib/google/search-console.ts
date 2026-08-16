import "server-only";
import { accessTokenFor, googleAccount, googleTargets, noteGoogleResult } from "./auth";

/*
 * Search Console, read only. Everything the SEO screen shows comes from two
 * endpoints: the property list and the search analytics query.
 *
 * On Google's reporting lag: Search Console data settles two to three days
 * behind, so every window here ENDS three days ago. Reporting yesterday would
 * show a fake collapse in clicks every single day, and the owner would chase
 * a problem that does not exist.
 */

const LAG_DAYS = 3;
const API = "https://searchconsole.googleapis.com/webmasters/v3";

export type SearchRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type Totals = { clicks: number; impressions: number; ctr: number; position: number };

export type SearchSummary = {
  property: string;
  range: { start: string; end: string };
  current: Totals;
  previous: Totals;
  queries: SearchRow[];
  pages: SearchRow[];
  opportunities: SearchRow[];
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Window of `days` ending at Google's freshest settled day. */
export function window(days: number, offsetPeriods = 0) {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - LAG_DAYS - offsetPeriods * days);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { start: iso(start), end: iso(end) };
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const account = await googleAccount();
  if (!account) throw new Error("Google is not connected yet.");
  const token = await accessTokenFor(account);
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    const message = body.error?.message ?? `Google returned ${res.status}.`;
    await noteGoogleResult(false, message);
    throw new Error(
      res.status === 403
        ? `${message} Check that the service account was added as a user on this property in Search Console.`
        : message,
    );
  }
  await noteGoogleResult(true);
  return (await res.json()) as T;
}

/** Properties this service account can read. Empty means it was never added. */
export async function listProperties(): Promise<{ siteUrl: string; permissionLevel: string }[]> {
  const data = await call<{ siteEntry?: { siteUrl: string; permissionLevel: string }[] }>("/sites");
  return data.siteEntry ?? [];
}

async function query(
  property: string,
  body: Record<string, unknown>,
): Promise<SearchRow[]> {
  const data = await call<{ rows?: SearchRow[] }>(
    `/sites/${encodeURIComponent(property)}/searchAnalytics/query`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return data.rows ?? [];
}

function totals(rows: SearchRow[]): Totals {
  if (rows.length === 0) return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  const clicks = rows.reduce((n, r) => n + r.clicks, 0);
  const impressions = rows.reduce((n, r) => n + r.impressions, 0);
  // position must be weighted by impressions, not averaged flat, or one
  // obscure keyword ranking #1 would drag the whole site's average up
  const position =
    impressions > 0 ? rows.reduce((n, r) => n + r.position * r.impressions, 0) / impressions : 0;
  return { clicks, impressions, ctr: impressions > 0 ? clicks / impressions : 0, position };
}

/**
 * Everything the Search tab shows, in one pass: this period against the last,
 * the queries and pages that earn the clicks, and the near-miss list.
 */
export async function searchSummary(days = 28): Promise<SearchSummary> {
  const { property } = await googleTargets();
  if (!property) throw new Error("Pick which Search Console property to read first.");

  const now = window(days);
  const before = window(days, 1);

  const [currentByDate, previousByDate, queries, pages] = await Promise.all([
    query(property, { startDate: now.start, endDate: now.end, dimensions: ["date"], rowLimit: 500 }),
    query(property, { startDate: before.start, endDate: before.end, dimensions: ["date"], rowLimit: 500 }),
    query(property, { startDate: now.start, endDate: now.end, dimensions: ["query"], rowLimit: 100 }),
    query(property, { startDate: now.start, endDate: now.end, dimensions: ["page"], rowLimit: 50 }),
  ]);

  /* The near misses: ranking on page two or the bottom of page one, with
   * real search volume behind them. These are the cheapest wins on the site,
   * because Google already trusts the page for that phrase. */
  const opportunities = queries
    .filter((r) => r.position >= 6 && r.position <= 20 && r.impressions >= 10)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 15);

  return {
    property,
    range: now,
    current: totals(currentByDate),
    previous: totals(previousByDate),
    queries: queries.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, 25),
    pages: pages.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, 25),
    opportunities,
  };
}

/** The queries one specific page ranks for, for the blog editor. */
export async function queriesForPage(pageUrl: string, days = 28): Promise<SearchRow[]> {
  const { property } = await googleTargets();
  if (!property) throw new Error("Pick which Search Console property to read first.");
  const now = window(days);
  const rows = await query(property, {
    startDate: now.start,
    endDate: now.end,
    dimensions: ["query"],
    dimensionFilterGroups: [
      { filters: [{ dimension: "page", operator: "equals", expression: pageUrl }] },
    ],
    rowLimit: 25,
  });
  return rows.sort((a, b) => b.impressions - a.impressions);
}
