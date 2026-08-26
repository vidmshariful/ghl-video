import "server-only";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import type { PartnerRow } from "@/lib/partners";
import { site } from "@/lib/site";

/*
 * Affixo, the affiliate platform. Replaces lib/firstpromoter.ts.
 *
 * Two jobs, and they are worth keeping apart in your head:
 *
 *  1. READ, for the partner portal. Each partner sees their own numbers.
 *     Commissions and payouts are still calculated and paid over there; we
 *     only display them.
 *
 *  2. WRITE, exactly once, from the Stripe webhook. Our checkout is native
 *     PaymentIntents, not Stripe Checkout Sessions, so Affixo's own Stripe
 *     listener would never see most of our orders. We tell it ourselves the
 *     moment an order settles.
 *
 * Auth: Authorization: Bearer AFFIXO_API_KEY. Without it every function
 * returns the "not configured" shape and the portal shows its graceful card,
 * so this file is safe to ship ahead of the key.
 *
 * MONEY. Affixo speaks major units: 89.25 means eighty nine dollars and
 * twenty five cents. Everything in this codebase is integer cents. `toCents`
 * is the only place that conversion happens on the way in, and `trackSale`
 * is the only place it happens on the way out. Do not scatter more.
 *
 * FILTERING. The list endpoints take limit and offset. /v1/affiliates also
 * takes `q` and `status`, but nothing else filters: asking commissions for
 * ?affiliate_id=x returns the whole programme. So the filtering is done
 * here, after paging. Fine at this size, and `pageAll` caps itself so a
 * growing programme cannot turn one portal load into an unbounded crawl.
 */

const BASE = "https://go.affixo.dev/v1";
const TIMEOUT_MS = 15_000;
/* 10 pages of 100 is 1000 rows, far past what any one partner needs to see */
const MAX_PAGES = 10;
const PAGE = 100;

export function affixoConfigured(): boolean {
  return Boolean(process.env.AFFIXO_API_KEY);
}

export type AffixoAffiliate = {
  id: string;
  ref_code: string | null;
  email: string | null;
  name: string | null;
  status: string | null;
  created_at?: string | null;
};

/** One row of /v1/reports/affiliates. Money fields are MAJOR units. */
export type AffixoReportRow = {
  affiliate_id: string;
  ref_code?: string | null;
  email?: string | null;
  clicks?: number;
  conversions?: number;
  leads?: number;
  sales?: number;
  revenue?: number;
  commissions_earned?: number;
  commissions_paid?: number;
};

export type AffixoCommission = {
  id: string;
  affiliate_id: string;
  conversion_id: string | null;
  amount: number;
  currency?: string | null;
  status?: string | null;
  created_at?: string | null;
};

export type AffixoConversion = {
  id: string;
  affiliate_id?: string | null;
  email?: string | null;
  amount?: number;
  currency?: string | null;
  status?: string | null;
  created_at?: string | null;
  external_id?: string | null;
};

export type AffixoPayout = {
  id: string;
  affiliate_id?: string | null;
  amount?: number;
  currency?: string | null;
  status?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
  method?: string | null;
};

export type AffixoLink = {
  id: string;
  affiliate_id: string;
  ref_param: string | null;
  destination_url: string | null;
  campaign_id: string | null;
};

export type AffixoCampaign = {
  id: string;
  name: string | null;
  status?: string | null;
  cookie_window_days?: number | null;
};

/** Major units to integer cents. The one conversion point on the way in. */
export function toCents(amount: number | null | undefined): number {
  return Math.round((amount ?? 0) * 100);
}

async function afx(
  path: string,
  params?: Record<string, string>,
  init?: RequestInit,
): Promise<{ ok: boolean; body: unknown }> {
  const key = process.env.AFFIXO_API_KEY;
  if (!key) return { ok: false, body: null };
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      signal: ctrl.signal,
      cache: "no-store",
    });
    return { ok: r.ok, body: await r.json().catch(() => null) };
  } catch {
    return { ok: false, body: null };
  } finally {
    clearTimeout(t);
  }
}

/** Every row of a list resource, paged, with a hard ceiling. */
async function pageAll<T>(resource: string): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const r = await afx(`/${resource}`, { limit: String(PAGE), offset: String(i * PAGE) });
    if (!r.ok) break;
    const rows = (r.body as { data?: unknown })?.data;
    if (!Array.isArray(rows) || rows.length === 0) break;
    out.push(...(rows as T[]));
    if (rows.length < PAGE) break;
  }
  return out;
}

/* ---------------------------------------------------------------- reads */

/**
 * Resolve one of our partners to their Affixo affiliate.
 *
 * Prefers the stored id; otherwise matches on email and PERSISTS what it
 * found, so this costs a full listing once per partner and never again.
 * Returns null when Affixo has no matching affiliate, which the portal
 * renders as "not linked yet" rather than as an error.
 */
export async function resolveAffiliate(partner: PartnerRow): Promise<AffixoAffiliate | null> {
  if (partner.affixo_affiliate_id) {
    const r = await afx(`/affiliates/${encodeURIComponent(partner.affixo_affiliate_id)}`);
    const one = (r.body as { data?: AffixoAffiliate })?.data;
    if (r.ok && one?.id) return one;
    /* fall through on a stale id: an affiliate deleted over there should
       re-link by email rather than leave the partner staring at nothing */
  }
  if (!partner.email) return null;

  const all = await pageAll<AffixoAffiliate>("affiliates");
  const want = partner.email.toLowerCase();
  const found = all.find((a) => (a.email ?? "").toLowerCase() === want);
  if (!found) return null;

  /* auto-link, best effort. Never fail a read over bookkeeping. */
  await supabaseAdmin()
    .from("partners")
    .update({ affixo_affiliate_id: found.id })
    .eq("id", partner.id)
    .then(undefined, () => {});
  return found;
}

/** The affiliate's own row of the program report: clicks, sales, money. */
export async function getReport(affiliateId: string): Promise<AffixoReportRow | null> {
  const r = await afx("/reports/affiliates");
  const rows = (r.body as { data?: AffixoReportRow[] })?.data;
  if (!r.ok || !Array.isArray(rows)) return null;
  return rows.find((x) => x.affiliate_id === affiliateId) ?? null;
}

export async function getCommissions(affiliateId: string): Promise<AffixoCommission[]> {
  const all = await pageAll<AffixoCommission>("commissions");
  return all.filter((c) => c.affiliate_id === affiliateId);
}

export async function getConversions(affiliateId: string): Promise<AffixoConversion[]> {
  const all = await pageAll<AffixoConversion>("conversions");
  return all.filter((c) => c.affiliate_id === affiliateId);
}

export async function getPayouts(affiliateId: string): Promise<AffixoPayout[]> {
  const all = await pageAll<AffixoPayout>("payouts");
  return all.filter((p) => p.affiliate_id === affiliateId);
}

/** The partner's referral links, with the campaign each one belongs to. */
export async function getLinks(
  affiliateId: string,
): Promise<{ link: AffixoLink; campaign: AffixoCampaign | null }[]> {
  const [links, campaigns] = await Promise.all([
    pageAll<AffixoLink>("links"),
    pageAll<AffixoCampaign>("campaigns"),
  ]);
  const byId = new Map(campaigns.map((c) => [c.id, c]));
  return links
    .filter((l) => l.affiliate_id === affiliateId)
    .map((link) => ({ link, campaign: link.campaign_id ? byId.get(link.campaign_id) ?? null : null }));
}

/* --------------------------------------------------------------- writes */

/* Where a self-serve signup lands. Looked up by name rather than pinned to
   an id, so this keeps working if the campaign is rebuilt over there. */
const DEFAULT_CAMPAIGN_NAME = "GHL Video Affiliate Program";

/**
 * Create an affiliate for a newly approved partner, with the referral link
 * that makes their ?ref= actually resolve.
 *
 * Both halves are needed and the second is the one that is easy to miss.
 * Attribution matches an incoming ?ref= against a LINK, not against the
 * affiliate: an unknown value comes back link_not_found. An affiliate
 * created without a link is a partner whose every referral earns nothing,
 * and nothing about their record would look wrong.
 *
 * ref_code is asked for but not depended on. Affixo mints a variant of its
 * own when the code collides with an existing one, which is exactly what
 * happened to Jonah in the migration. The link carries our slug either way,
 * so the link is what we check.
 *
 * Fail-soft, like the FirstPromoter call it replaces: on any error the
 * partner still exists with their row and their portal, and the studio
 * links them by hand. A signup must never fail because a third party did.
 */
export async function createAffiliate(input: {
  email: string;
  name: string;
  ref: string;
}): Promise<{ id: string; refCode: string | null } | null> {
  if (!affixoConfigured()) return null;

  const made = await afx("/affiliates", undefined, {
    method: "POST",
    body: JSON.stringify({ email: input.email, name: input.name, ref_code: input.ref }),
  });
  const affiliate = (made.body as { data?: AffixoAffiliate })?.data;
  if (!made.ok || !affiliate?.id) {
    console.error("[affixo] could not create affiliate for", input.email);
    return null;
  }

  const campaigns = await pageAll<AffixoCampaign>("campaigns");
  const campaign = campaigns.find((c) => c.name === DEFAULT_CAMPAIGN_NAME);
  if (!campaign) {
    console.error(`[affixo] no campaign named "${DEFAULT_CAMPAIGN_NAME}"; link not created`);
    return { id: affiliate.id, refCode: affiliate.ref_code ?? null };
  }

  const link = await afx("/links", undefined, {
    method: "POST",
    body: JSON.stringify({
      affiliate_id: affiliate.id,
      ref_param: input.ref,
      destination_url: `${site.url}/?ref=${encodeURIComponent(input.ref)}`,
      campaign_id: campaign.id,
    }),
  });
  if (!link.ok) {
    /* loud: the affiliate exists but nothing they send us will attribute */
    console.error("[affixo] affiliate created WITHOUT a link:", input.email, input.ref);
  }

  return { id: affiliate.id, refCode: affiliate.ref_code ?? null };
}

/**
 * Record a settled sale.
 *
 * Called from the Stripe webhook once an order is paid, because our checkout
 * builds PaymentIntents by hand and Affixo's Stripe listener is looking for
 * Checkout Sessions and invoices it will never see.
 *
 * Idempotent on `external_id`, so a webhook Stripe retries three times still
 * counts once. That id is our order id, which is also what makes this safe to
 * call from a handler that is itself retried.
 *
 * Returns true only when Affixo accepted it. Callers must treat false as
 * "nothing happened" and carry on: a partner's commission is not worth
 * failing a customer's paid order over.
 */
export async function trackSale(input: {
  orderId: string;
  amountCents: number;
  currency: string;
  /* whichever identity signals we have; Affixo picks by its own precedence */
  ref?: string | null;
  email?: string | null;
  visitorId?: string | null;
}): Promise<boolean> {
  if (!affixoConfigured()) return false;
  if (!input.ref && !input.email && !input.visitorId) return false;

  const r = await afx(
    "/track/sale",
    undefined,
    {
      method: "POST",
      body: JSON.stringify({
        external_id: input.orderId,
        /* major units, and never a fraction of a cent */
        amount: Math.round(input.amountCents) / 100,
        currency: (input.currency || "usd").toLowerCase(),
        ...(input.ref ? { ref: input.ref } : {}),
        ...(input.email ? { email: input.email } : {}),
        ...(input.visitorId ? { visitor_id: input.visitorId } : {}),
      }),
    },
  );
  if (!r.ok) {
    console.error("[affixo] track sale failed for order", input.orderId);
    return false;
  }
  return true;
}
