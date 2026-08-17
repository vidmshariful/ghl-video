import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * Which offer, if any, this person should see.
 *
 * The rules are separated from the database on purpose. Picking an offer is a
 * pile of small decisions (is it live, is it in its window, is this person the
 * audience, which one wins when two fit) and every one of them is a place to
 * be quietly wrong in a way nobody notices for a month. Kept pure, they can be
 * checked directly instead of by creating rows and refreshing a portal.
 *
 * One offer is returned, never a list. A dashboard showing three offers is a
 * dashboard showing none, and the moment a slot can hold several it grows a
 * carousel nobody reads.
 */

export type Audience = "all" | "customers" | "prospects" | "dormant";

export type Campaign = {
  id: string;
  title: string;
  body: string | null;
  ctaLabel: string;
  targetSku: string | null;
  targetPath: string | null;
  couponCode: string | null;
  audience: Audience;
  dormantDays: number;
  startsAt: string | null;
  endsAt: string | null;
  priority: number;
  active: boolean;
  clickCount: number;
};

/** What we know about the person looking, worked out on the server. */
export type Viewer = {
  /** paid orders they have, ever */
  paidOrders: number;
  /** when they last paid for something, ISO, or null if never */
  lastOrderAt: string | null;
};

/** Is this offer switched on and inside its dates? */
export function isLive(c: Campaign, now: Date): boolean {
  if (!c.active) return false;
  if (c.startsAt && new Date(c.startsAt) > now) return false;
  /* ends_at is the moment it stops, so equal counts as over */
  if (c.endsAt && new Date(c.endsAt) <= now) return false;
  return true;
}

/**
 * Is this person who the offer is for?
 *
 * Dormant deliberately requires a previous order AND enough silence since. A
 * client who bought last week is not dormant, and somebody who has never
 * bought is not dormant either, they are a prospect. Collapsing those two
 * would send a "we miss you" offer to somebody who has never met us, which is
 * the exact thing that makes this kind of message embarrassing.
 */
export function matchesAudience(c: Campaign, v: Viewer, now: Date): boolean {
  switch (c.audience) {
    case "all":
      return true;
    case "customers":
      return v.paidOrders > 0;
    case "prospects":
      return v.paidOrders === 0;
    case "dormant": {
      if (v.paidOrders === 0 || !v.lastOrderAt) return false;
      const days = (now.getTime() - new Date(v.lastOrderAt).getTime()) / 86_400_000;
      return days >= c.dormantDays;
    }
  }
}

/**
 * The one offer to show, or null.
 *
 * Highest priority wins; a tie goes to the more specific audience, because an
 * offer aimed at dormant clients is worth more than a general one and somebody
 * setting both to priority zero clearly meant the aimed one.
 */
const SPECIFICITY: Record<Audience, number> = {
  dormant: 3,
  prospects: 2,
  customers: 2,
  all: 1,
};

export function pickCampaign(all: Campaign[], v: Viewer, now: Date): Campaign | null {
  const fits = all.filter((c) => isLive(c, now) && matchesAudience(c, v, now));
  if (!fits.length) return null;
  return fits.sort(
    (a, b) =>
      b.priority - a.priority ||
      SPECIFICITY[b.audience] - SPECIFICITY[a.audience] ||
      /* last resort, so the order is at least stable between requests */
      a.id.localeCompare(b.id),
  )[0];
}

/** Where the button goes. A sku beats a path; one of the two always exists. */
export function campaignHref(c: Campaign): string {
  if (c.targetSku) {
    const q = c.couponCode ? `?code=${encodeURIComponent(c.couponCode)}` : "";
    return `/checkout/${encodeURIComponent(c.targetSku.toLowerCase())}/${q}`;
  }
  return c.targetPath ?? "/portal/library/";
}

/* ---------- the database side ---------- */

type DB = SupabaseClient;
type Row = Record<string, unknown>;

export function rowToCampaign(r: Row): Campaign {
  return {
    id: String(r.id),
    title: String(r.title),
    body: (r.body as string | null) ?? null,
    ctaLabel: String(r.cta_label),
    targetSku: (r.target_sku as string | null) ?? null,
    targetPath: (r.target_path as string | null) ?? null,
    couponCode: (r.coupon_code as string | null) ?? null,
    audience: String(r.audience) as Audience,
    dormantDays: Number(r.dormant_days),
    startsAt: (r.starts_at as string | null) ?? null,
    endsAt: (r.ends_at as string | null) ?? null,
    priority: Number(r.priority),
    active: Boolean(r.active),
    clickCount: Number(r.click_count ?? 0),
  };
}

export async function listCampaigns(db: DB): Promise<Campaign[]> {
  const { data } = await db
    .from("campaigns")
    .select("*")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });
  return ((data ?? []) as Row[]).map(rowToCampaign);
}

/**
 * What this account is, for audience purposes.
 *
 * Reads paid orders only. An abandoned or refunded order should not make
 * somebody a customer, and should not stop them being a prospect.
 */
export async function viewerFor(db: DB, email: string): Promise<Viewer> {
  const { data } = await db
    .from("orders")
    .select("created_at")
    .eq("customer_email", email)
    .eq("status", "paid")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Row[];
  return {
    paidOrders: rows.length,
    lastOrderAt: rows.length ? String(rows[0].created_at) : null,
  };
}
