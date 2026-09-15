/*
 * HighLevel (LeadConnector) API v2: the one HTTP client every caller shares.
 *
 * No "server-only" marker on purpose. The sync worker runs from a script
 * (npm run hl:sync) as well as from the cron route, and a script cannot
 * import a server-only module. The token is a plain server variable that a
 * browser bundle never carries, so nothing is exposed by this file being
 * importable; lib/checkout/highlevel.ts keeps its server-only guard for the
 * money path and builds on this.
 */
import { HighLevelError } from "@/lib/checkout/highlevel-errors";

export const HL_BASE = "https://services.leadconnectorhq.com";
export const HL_APP = "https://app.gohighlevel.com";

export function hlHeaders(): Record<string, string> {
  const token = process.env.HIGHLEVEL_API_TOKEN;
  if (!token) throw new Error("Missing HIGHLEVEL_API_TOKEN");
  return {
    Authorization: `Bearer ${token}`,
    Version: process.env.HIGHLEVEL_API_VERSION || "2021-07-28",
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export function locationId(): string {
  const id = process.env.HIGHLEVEL_LOCATION_ID;
  if (!id) throw new Error("Missing HIGHLEVEL_LOCATION_ID");
  return id;
}

/**
 * A failure that is HighLevel's moment, not our request: their gateway
 * answers "Command timed out" with a 401 when its own back end is slow
 * (seen on 14 and 15 September 2026, four crashes of the minute sync), and
 * a 429 or a 5xx says the same in other words. None of them mean the token
 * is wrong or the call was bad, so a read is worth one more try.
 */
export function isTransientHlFailure(status: number, body: string): boolean {
  if (status === 429 || status === 408 || status >= 500) return true;
  return /timed out|timeout|ECONNRESET|ETIMEDOUT|temporarily unavailable/i.test(body);
}

const RETRY_AFTER_MS = 1500;

/**
 * One call, with a hard 10 second timeout: a hung HighLevel must fail fast
 * and be caught, never hang long enough for the platform to kill the
 * invocation after an order was already marked paid. A read that hits one
 * of HighLevel's own hiccups is tried once more after a short pause; a
 * write is not, because a second write is a second record.
 */
export async function hlFetch(path: string, init: RequestInit): Promise<Record<string, unknown>> {
  const method = (init.method ?? "GET").toUpperCase();
  for (let attempt = 0; ; attempt += 1) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    let r: Response;
    try {
      r = await fetch(`${HL_BASE}${path}`, { ...init, headers: hlHeaders(), signal: ctrl.signal });
    } catch (e) {
      clearTimeout(timer);
      if (method === "GET" && attempt === 0) {
        await new Promise((res) => setTimeout(res, RETRY_AFTER_MS));
        continue;
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
    const text = await r.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON body */
    }
    if (r.ok) return (json ?? {}) as Record<string, unknown>;
    if (method === "GET" && attempt === 0 && isTransientHlFailure(r.status, text)) {
      await new Promise((res) => setTimeout(res, RETRY_AFTER_MS));
      continue;
    }
    throw new HighLevelError(`HL ${method} ${path} -> ${r.status}: ${text.slice(0, 300)}`, r.status, json);
  }
}

/** The contact's page in the HighLevel app. */
export function contactUrl(location: string, contactId: string): string {
  return `${HL_APP}/v2/location/${location}/contacts/detail/${contactId}`;
}

/** The deal card in the HighLevel app, opened from the pipeline list. */
export function opportunityUrl(location: string, opportunityId: string): string {
  return `${HL_APP}/v2/location/${location}/opportunities/list/${opportunityId}`;
}
