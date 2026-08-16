import "server-only";
import { accessTokenFor, googleAccount, googleTargets, noteGoogleResult } from "./auth";

/*
 * Google Analytics 4, read only. Two APIs: the Admin API lists the properties
 * the service account can see (so the screen offers a picker instead of asking
 * for a numeric id), and the Data API answers the actual questions.
 *
 * Scope is deliberately narrow. This is not a GA clone: it answers "how many
 * people came, where from, and which page did they land on", which is what
 * pairs with the Search tab. Anything deeper belongs in GA itself.
 */

const ADMIN = "https://analyticsadmin.googleapis.com/v1beta";
const DATA = "https://analyticsdata.googleapis.com/v1beta";

export type GaProperty = {
  /** the API name, e.g. "properties/523834827" */
  property: string;
  displayName: string;
  account: string;
  measurementId?: string;
};

export type GaTotals = {
  sessions: number;
  users: number;
  engagementRate: number;
  avgSeconds: number;
};

export type GaRow = { key: string; sessions: number; engagementRate: number };

export type GaSummary = {
  property: string;
  range: { start: string; end: string };
  current: GaTotals;
  previous: GaTotals;
  channels: GaRow[];
  landingPages: GaRow[];
};

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const account = await googleAccount();
  if (!account) throw new Error("Google is not connected yet.");
  const token = await accessTokenFor(account);
  const res = await fetch(url, {
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
    let message = body.error?.message ?? `Google returned ${res.status}.`;
    if (/has not been used in project|is disabled/.test(message)) {
      message =
        "The Google Analytics APIs are not enabled for this Cloud project yet. In Google Cloud, APIs and Services, Library, enable both the Google Analytics Data API and the Google Analytics Admin API.";
    } else if (res.status === 403) {
      message = `${message} Check that the service account was added to this property in Analytics, under Admin, Property access management.`;
    }
    await noteGoogleResult(false, message);
    throw new Error(message);
  }
  await noteGoogleResult(true);
  return (await res.json()) as T;
}

/** Every GA4 property this service account can read, newest-looking last. */
export async function listGaProperties(): Promise<GaProperty[]> {
  const data = await call<{
    accountSummaries?: {
      displayName: string;
      propertySummaries?: { property: string; displayName: string }[];
    }[];
  }>(`${ADMIN}/accountSummaries`);

  return (data.accountSummaries ?? []).flatMap((a) =>
    (a.propertySummaries ?? []).map((p) => ({
      property: p.property,
      displayName: p.displayName,
      account: a.displayName,
    })),
  );
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/* GA4 settles same day, so a one day lag is plenty. Ending on today would show
 * a half-finished day and read as a slump every morning. */
function window(days: number, back = 0) {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1 - back * days);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  // the Data API names these startDate/endDate; keep that shape so a window
  // can be handed straight to dateRanges without renaming at each call site
  return { startDate: iso(start), endDate: iso(end) };
}

type ReportRow = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] };

async function report(
  property: string,
  body: Record<string, unknown>,
): Promise<ReportRow[]> {
  const data = await call<{ rows?: ReportRow[] }>(`${DATA}/${property}:runReport`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data.rows ?? [];
}

const n = (row: ReportRow | undefined, i: number) => Number(row?.metricValues?.[i]?.value ?? 0);

const METRICS = [
  { name: "sessions" },
  { name: "totalUsers" },
  { name: "engagementRate" },
  { name: "averageSessionDuration" },
];

function totals(rows: ReportRow[]): GaTotals {
  const r = rows[0];
  return {
    sessions: n(r, 0),
    users: n(r, 1),
    engagementRate: n(r, 2),
    avgSeconds: n(r, 3),
  };
}

/** Everything the Traffic tab shows, in one pass. */
export async function gaSummary(days = 28): Promise<GaSummary> {
  const { gaPropertyId } = await googleTargets();
  if (!gaPropertyId) throw new Error("Pick which Analytics property to read first.");
  const property = gaPropertyId.startsWith("properties/")
    ? gaPropertyId
    : `properties/${gaPropertyId}`;

  const now = window(days);
  const before = window(days, 1);

  const [current, previous, channels, landing] = await Promise.all([
    report(property, { dateRanges: [now], metrics: METRICS }),
    report(property, { dateRanges: [before], metrics: METRICS }),
    report(property, {
      dateRanges: [now],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }, { name: "engagementRate" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 10,
    }),
    report(property, {
      dateRanges: [now],
      dimensions: [{ name: "landingPage" }],
      metrics: [{ name: "sessions" }, { name: "engagementRate" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 15,
    }),
  ]);

  const rows = (list: ReportRow[]): GaRow[] =>
    list.map((r) => ({
      key: r.dimensionValues?.[0]?.value ?? "(not set)",
      sessions: n(r, 0),
      engagementRate: n(r, 1),
    }));

  return {
    property,
    range: { start: now.startDate, end: now.endDate },
    current: totals(current),
    previous: totals(previous),
    channels: rows(channels),
    landingPages: rows(landing),
  };
}
