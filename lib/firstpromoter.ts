import "server-only";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import type { PartnerRow } from "@/lib/partners";

/*
 * RETIRED, 26 August 2026. Affixo replaced FirstPromoter; nothing in the
 * app imports this any more. Kept, not deleted, because the fp_* columns on
 * partners are the only record of who was who over there, and this is the
 * only way to read FirstPromoter back if a partner ever disputes a number
 * from before the move. Delete it once a full payout cycle has run on
 * Affixo and nobody needs to look back.
 *
 * FirstPromoter admin API v2 client, read-only. The portal shows each
 * partner THEIR OWN numbers; commissions and payouts still run inside
 * FirstPromoter. Docs: docs.firstpromoter.com, api-reference-v2.
 *
 * Auth: Authorization: Bearer FIRSTPROMOTER_API_KEY plus an ACCOUNT-ID
 * header, both from env (set in Vercel + .env.local, never committed).
 * Without them everything returns "not configured" and the portal shows
 * its graceful card, so this file is safe to ship ahead of the keys.
 *
 * Linking: a partners row maps to a FirstPromoter promoter via
 * fp_promoter_id. When it is not set yet we look the promoter up by the
 * partner's email and persist the id + their ref token (auto-link), so
 * the team never has to copy ids by hand for matching emails.
 *
 * Money units: FP returns cash amounts in cents (fpMoney is the single
 * conversion point if that ever proves wrong for an account).
 */

const BASE = "https://api.firstpromoter.com/api/v2";

export function fpConfigured(): boolean {
  return Boolean(process.env.FIRSTPROMOTER_API_KEY && process.env.FIRSTPROMOTER_ACCOUNT_ID);
}

/**
 * Create a promoter in FirstPromoter for an auto-approved Tier 1 signup.
 * The ref token is set to OUR partner ref so ?ref=<slug> links match FP's
 * tracking with no second token. New promoters land in the account's
 * default campaign (the Affiliate Program per the program document), and
 * FP's own invite email is suppressed: ours is the one that sends.
 * Fail-soft: on any error the partner still exists and the portal shows
 * its graceful "not linked yet" card; the team links by hand later.
 */
export async function createPromoter(input: {
  email: string;
  name: string;
  ref: string;
}): Promise<{ id: string; refToken: string | null } | null> {
  if (!fpConfigured()) return null;
  const [first, ...rest] = input.name.trim().split(/\s+/);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const r = await fetch(`${BASE}/company/promoters`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FIRSTPROMOTER_API_KEY}`,
        "ACCOUNT-ID": process.env.FIRSTPROMOTER_ACCOUNT_ID ?? "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: input.email,
        first_name: first || input.name,
        last_name: rest.join(" ") || undefined,
        ref_id: input.ref,
        skip_email_notification: true,
      }),
      signal: ctrl.signal,
      cache: "no-store",
    });
    const body = (await r.json().catch(() => null)) as {
      id?: number | string;
      promoter_campaigns?: { id?: number | string; ref_token?: string }[];
    } | null;
    if (!r.ok || !body?.id) {
      console.error(`[fp] promoter create failed (${r.status}):`, JSON.stringify(body)?.slice(0, 300));
      return null;
    }

    // FP mints its own ref token at create; align it with OUR ref so the
    // partner's ?ref=<slug> link is the one FP tracks (verified live: the
    // promoter_campaign PATCH is what changes the token).
    let refToken = body.promoter_campaigns?.[0]?.ref_token ?? null;
    const campaignId = body.promoter_campaigns?.[0]?.id;
    if (campaignId && refToken !== input.ref) {
      const patch = await fetch(`${BASE}/company/promoter_campaigns/${campaignId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${process.env.FIRSTPROMOTER_API_KEY}`,
          "ACCOUNT-ID": process.env.FIRSTPROMOTER_ACCOUNT_ID ?? "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref_token: input.ref }),
        cache: "no-store",
      });
      const patched = (await patch.json().catch(() => null)) as { ref_token?: string } | null;
      if (patch.ok && patched?.ref_token === input.ref) refToken = input.ref;
      else
        console.error(
          `[fp] ref token align failed for ${input.ref} (${patch.status}); FP token stays ${refToken}`,
        );
    }
    return { id: String(body.id), refToken };
  } catch (e) {
    console.error("[fp] promoter create failed:", e instanceof Error ? e.message : e);
    return null;
  } finally {
    clearTimeout(t);
  }
}

/* tiny per-instance cache so a partner clicking around does not hammer FP */
const cache = new Map<string, { at: number; body: unknown }>();
const CACHE_MS = 60_000;

type FpResult = { ok: true; body: unknown } | { ok: false; status: number };

async function fpFetch(
  path: string,
  params?: Record<string, string | string[]>,
): Promise<FpResult> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params ?? {})) {
    for (const one of Array.isArray(v) ? v : [v]) url.searchParams.append(k, one);
  }
  const key = url.toString();

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return { ok: true, body: hit.body };

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const r = await fetch(key, {
      headers: {
        Authorization: `Bearer ${process.env.FIRSTPROMOTER_API_KEY}`,
        "ACCOUNT-ID": process.env.FIRSTPROMOTER_ACCOUNT_ID ?? "",
      },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!r.ok) return { ok: false, status: r.status };
    const body = await r.json();
    cache.set(key, { at: Date.now(), body });
    return { ok: true, body };
  } catch {
    return { ok: false, status: 0 }; // network / timeout
  } finally {
    clearTimeout(t);
  }
}

/* list endpoints wrap rows in { data: [...] }; details return the object */
const unwrap = (body: unknown): unknown =>
  body && typeof body === "object" && "data" in (body as Record<string, unknown>)
    ? (body as Record<string, unknown>).data
    : body;

export type FpPromoter = {
  id: number;
  email: string | null;
  name: string | null;
  joined_at?: string;
  stats?: {
    clicks_count?: number;
    referrals_count?: number;
    sales_count?: number;
    customers_count?: number;
    revenue_amount?: number;
    active_customers_count?: number;
  };
  /* live shape: balances are nested per bucket, cash in cents,
   * e.g. { current_balance: { cash: 8925 }, pending_balance: {...} } */
  balances?: {
    current_balance?: { cash?: number | null };
    pending_balance?: { cash?: number | null };
    earnings_balance?: { cash?: number | null };
  };
  promoter_campaigns?: {
    state?: string;
    ref_token?: string;
    ref_link?: string;
    coupon?: string | null;
    campaign?: { name?: string };
  }[];
};

export type FpReferral = {
  id: number;
  email?: string | null;
  state?: string;
  created_at?: string;
  customer_since?: string | null;
};

export type FpPayout = {
  id: number;
  status?: string;
  amount?: number;
  unit?: string;
  period_start?: string | null;
  period_end?: string | null;
  paid_at?: string | null;
  created_at?: string;
  payout_method?: { method?: string };
};

export type FpSeriesPoint = {
  period: string;
  clicks: number;
  referrals: number;
  revenueCents: number;
  earningsCents: number;
};

export async function getPromoterById(id: string | number): Promise<FpPromoter | null> {
  const r = await fpFetch(`/company/promoters/${encodeURIComponent(String(id))}`, {
    exclude_payout_method: "true",
  });
  return r.ok ? ((unwrap(r.body) as FpPromoter) ?? null) : null;
}

export async function findPromoterByEmail(email: string): Promise<FpPromoter | null> {
  const r = await fpFetch(`/company/promoters/${encodeURIComponent(email)}`, {
    find_by: "email",
    exclude_payout_method: "true",
  });
  return r.ok ? ((unwrap(r.body) as FpPromoter) ?? null) : null;
}

/* the promoter's primary ref token: an accepted campaign first */
export function primaryRefToken(p: FpPromoter): string | null {
  const cs = p.promoter_campaigns ?? [];
  const accepted = cs.find((c) => c.state === "accepted") ?? cs[0];
  return accepted?.ref_token ?? null;
}

/*
 * Resolve a partner to their FirstPromoter promoter. Prefers the stored
 * fp_promoter_id; falls back to an email lookup and PERSISTS what it
 * found (id + ref token) so the next call is direct. Returns null when
 * FP has no matching promoter (the portal shows "not linked yet").
 */
export async function resolvePromoter(partner: PartnerRow): Promise<FpPromoter | null> {
  if (partner.fp_promoter_id) {
    const byId = await getPromoterById(partner.fp_promoter_id);
    if (byId) return byId;
  }
  if (!partner.email) return null;
  const byEmail = await findPromoterByEmail(partner.email);
  if (!byEmail) return null;
  // auto-link, best effort; never fail the read over bookkeeping. When the
  // FP token IS the partner's own ref (this account tracks via ?ref=), skip
  // fp_ref so links stay clean instead of doubling up with &fpr=.
  const patch: Record<string, string> = { fp_promoter_id: String(byEmail.id) };
  const token = primaryRefToken(byEmail);
  if (token && !partner.fp_ref && token !== partner.ref) patch.fp_ref = token;
  await supabaseAdmin().from("partners").update(patch).eq("id", partner.id);
  return byEmail;
}

export async function getReferrals(promoterId: number): Promise<FpReferral[]> {
  const r = await fpFetch(`/company/referrals`, { "filters[promoter_id]": String(promoterId) });
  if (!r.ok) return [];
  const rows = unwrap(r.body);
  return Array.isArray(rows) ? (rows as FpReferral[]) : [];
}

export async function getPayouts(promoterId: number): Promise<FpPayout[]> {
  const r = await fpFetch(`/company/payouts`, { "filters[promoter_id]": String(promoterId) });
  if (!r.ok) return [];
  const rows = unwrap(r.body);
  return Array.isArray(rows) ? (rows as FpPayout[]) : [];
}

/* last-30-days daily series for one promoter, via the reports endpoint
 * (q narrows the report; we still match the promoter id exactly). */
export async function getDailySeries(
  promoter: FpPromoter,
  days = 30,
): Promise<FpSeriesPoint[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const r = await fpFetch(`/company/reports/promoters`, {
    "columns[]": [
      "clicks_count",
      "referrals_count",
      "revenue_amount",
      "promoter_earnings_amount",
    ],
    group_by: "day",
    start_date: start.toISOString(),
    end_date: end.toISOString(),
    q: promoter.email ?? "",
  });
  if (!r.ok) return [];
  const rows = unwrap(r.body);
  if (!Array.isArray(rows)) return [];
  type ReportRow = {
    promoter?: { id?: number };
    sub_data?: { period?: string; data?: Record<string, number> }[];
  };
  const mine = (rows as ReportRow[]).find((row) => row.promoter?.id === promoter.id);

  // FP only returns days WITH activity (as "Jul 25, 2026" labels); densify to
  // a full grid so the chart shows real day-by-day rhythm, quiet days included.
  const byDay = new Map<string, Omit<FpSeriesPoint, "period">>();
  for (const p of mine?.sub_data ?? []) {
    const d = new Date(p.period ?? "");
    if (Number.isNaN(d.getTime())) continue;
    byDay.set(d.toDateString(), {
      clicks: p.data?.clicks_count ?? 0,
      referrals: p.data?.referrals_count ?? 0,
      revenueCents: p.data?.revenue_amount ?? 0,
      earningsCents: p.data?.promoter_earnings_amount ?? 0,
    });
  }
  // the grid date is ALWAYS the period key (local date parts, matching the
  // toDateString lookups above), so densified days can never collide
  const series: FpSeriesPoint[] = [];
  const pad = (n: number) => String(n).padStart(2, "0");
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86_400_000);
    const period = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const hit = byDay.get(d.toDateString());
    series.push({
      period,
      clicks: hit?.clicks ?? 0,
      referrals: hit?.referrals ?? 0,
      revenueCents: hit?.revenueCents ?? 0,
      earningsCents: hit?.earningsCents ?? 0,
    });
  }
  return series;
}
