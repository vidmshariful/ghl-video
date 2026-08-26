/*
 * Affiliate partners: the single source of truth mapping a referral `ref` to
 * its Stripe coupon and discount terms. Read by three places, one job each:
 *   - the checkout page (app/checkout/[sku]/page.tsx) to DISPLAY the discount,
 *   - /api/checkout/create-subscription to APPLY it server-side (the client
 *     never sends a discount, only a ref that we resolve here), and
 *   - the partner landing pages (lib/sales/pages.ts entries + PartnerLanding).
 *
 * Kept separate from landing-page CONTENT (lib/sales/pages.ts) so editing a
 * page never touches the money path, the same discipline as lib/bundles.ts.
 *
 * To add a partner:
 *   1. add an entry to `affiliates` below,
 *   2. run `npm run seed:affiliates` to create their Stripe coupon,
 *   3. give them a page: an entry in lib/sales/pages.ts with `affiliateRef` set.
 *
 * Stripe coupons are immutable. To CHANGE a partner's terms, point them at a
 * new `stripeCouponId` (and re-run the seed) rather than editing the old one.
 */
export type Affiliate = {
  /** url-safe slug, used in ?ref= links and the ghlv_ref cookie */
  ref: string;
  /** partner's display name */
  name: string;
  /** the Stripe Coupon object id, created by scripts/seed-affiliate-coupons.mjs */
  stripeCouponId: string;
  /** percent off; MUST match the seeded Stripe coupon (display re-derives from it) */
  discountPercent: number;
  /** number of months the discount repeats (Stripe coupon duration_in_months) */
  discountMonths: number;
  /** short label shown on the checkout order summary, e.g. "Friend of Jonah" */
  summaryLabel: string;
  /** customer-facing fallback code, typable at checkout if the automatic
   *  discount ever fails to apply. For it to work it must exist in the DB
   *  coupons table as a percent-off, sub_eligible (for editing), all-sku code.
   *  Create it in admin -> Coupons before the partner page goes live. */
  code: string;
};

export const affiliates: Affiliate[] = [
  {
    ref: "jonah",
    name: "Jonah Cockshaw",
    // Live Stripe coupon (10% off, repeating 3 months), created in the dashboard.
    stripeCouponId: "bzD89jmL",
    discountPercent: 10,
    discountMonths: 3,
    summaryLabel: "Friend of Jonah",
    code: "JONAH10",
  },
];

/** the first-touch attribution cookie, set in proxy.ts */
export const REF_COOKIE = "ghlv_ref";

/* refs ride in attacker-controllable query strings, so keep them to a short,
 * url-safe shape before they ever touch a cookie, the DB, or Stripe. */
const REF_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;

export function normalizeRef(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const r = raw.trim().toLowerCase();
  return REF_RE.test(r) ? r : null;
}

/** resolve a raw ref to a known partner, or undefined (also validates shape) */
export function affiliateByRef(raw: string | null | undefined): Affiliate | undefined {
  const r = normalizeRef(raw);
  return r ? affiliates.find((a) => a.ref === r) : undefined;
}

/** pull + normalize the ghlv_ref value out of a raw Cookie header (server routes) */
export function refFromCookieHeader(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(/(?:^|;\s*)ghlv_ref=([^;]+)/);
  return m ? normalizeRef(decodeURIComponent(m[1])) : null;
}

/** FirstPromoter's visitor tracking id, set by its fpr.js on the public
 *  pages. Passed to Stripe as fp_tid metadata so FP attributes the sale to
 *  the clicked link even before any email match. */
/**
 * Affixo's visitor id, set first-party by their sa.js as `_sa_vid`.
 *
 * The strongest attribution signal they take: it ties a paid order back to
 * the exact click, which survives a buyer who arrives on a partner link,
 * leaves, and comes back a fortnight later from a bookmark. Carried onto
 * the PaymentIntent at finalize so the webhook, which never sees a browser
 * cookie, can still name the visit that earned the commission.
 */
export function saVidFromCookieHeader(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(/(?:^|;\s*)_sa_vid=([^;]+)/);
  if (!m) return null;
  const vid = decodeURIComponent(m[1]).trim().slice(0, 100);
  return vid || null;
}

export function fpTidFromCookieHeader(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(/(?:^|;\s*)_fprom_tid=([^;]+)/);
  if (!m) return null;
  const tid = decodeURIComponent(m[1]).trim().slice(0, 100);
  return tid || null;
}
