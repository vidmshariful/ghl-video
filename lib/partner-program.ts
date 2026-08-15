/*
 * The partnership program, in one file: tiers, rates, cookie windows,
 * FirstPromoter campaign names, and the public copy blocks. This mirrors
 * the internal program document (source of truth, August 2026) the same
 * way lib/site.ts carries prices: every portal page, site page, and admin
 * screen reads from HERE, so a program change is one edit.
 *
 * The commission model: the rate attaches to the CLIENT, not the product.
 * The first order a referred client places pays the first-order rate;
 * every order that same client places afterward pays the follow-on rate,
 * on any product, for the life of the client. Verified live on Stripe +
 * FirstPromoter (August 2026): a second one-time order paid the follow-on
 * rate.
 */

export type PartnerTier = "affiliate" | "vip" | "partnership";

export type TierDef = {
  tier: PartnerTier;
  name: string;
  entry: string;
  firstOrderPct: number;
  followOnPct: number;
  cookieDays: number;
  audienceDiscountPct: number | null;
  fpCampaign: string;
  /* the public description, ready for FirstPromoter and the site */
  copy: string;
};

export const TIERS: Record<PartnerTier, TierDef> = {
  affiliate: {
    tier: "affiliate",
    name: "Affiliate Partner",
    entry: "Open signup, instant approval",
    firstOrderPct: 10,
    followOnPct: 5,
    cookieDays: 45,
    audienceDiscountPct: null,
    fpCampaign: "GHL Video Affiliate Program",
    copy: "Promote GHL Video however you want. Share your link in posts, newsletters, DMs, videos, or anywhere your audience already is. You earn 10% on a client's first order and 5% on everything they order afterward, for as long as they stay a client. Open to anyone, including current GHL Video clients applying from the customer portal.",
  },
  vip: {
    tier: "vip",
    name: "VIP Affiliate Partner",
    entry: "Invitation only",
    firstOrderPct: 20,
    followOnPct: 10,
    cookieDays: 60,
    audienceDiscountPct: 10,
    fpCampaign: "GHL Video VIP Affiliate Partner",
    copy: "An invitation-only tier for established voices in the HighLevel ecosystem who promote GHL Video to their community and list it in their directories and resources. You get a dedicated partner page carrying your name, and your audience gets 10% off their order. You earn 20% on a client's first order and 10% on everything they order afterward, for as long as they stay a client.",
  },
  partnership: {
    tier: "partnership",
    name: "Partnership Program",
    entry: "Signed agreement, limited seats",
    firstOrderPct: 30,
    followOnPct: 15,
    cookieDays: 60,
    audienceDiscountPct: null,
    fpCampaign: "GHL Video Partnership Program",
    copy: "A contracted tier for platforms and studios that add GHL Video to their service menu. Your visitors land on a co-branded page built for your brand and your audience, with dedicated account handling and direct access to the production team. You earn 30% on a client's first order and 15% on everything they order afterward, for as long as they stay a client. Limited to a small number of partners by agreement.",
  },
};

export const TIER_ORDER: PartnerTier[] = ["affiliate", "vip", "partnership"];

export function tierDef(tier: string | null | undefined): TierDef {
  return TIERS[(tier as PartnerTier) ?? "affiliate"] ?? TIERS.affiliate;
}

export function isPartnerTier(v: unknown): v is PartnerTier {
  return v === "affiliate" || v === "vip" || v === "partnership";
}

/* the longest cookie window in the program drives our own attribution
 * cookie, so a click never outlives FP's window unmatched */
export const MAX_COOKIE_DAYS = 60;

/* Program rules, one line each, shown to partners in their portal.
 * The full terms live at /legal/partner-terms. */
export const PROGRAM_RULES: string[] = [
  "Your referral link is the tracking method. A client is attributed to you once, permanently: every later order they place credits you at the follow-on rate.",
  "Commission is calculated on net product revenue, after any partner discount, excluding tax and payment fees.",
  "Commission is earned on delivery, net 30 after the refund window closes. Refunded and charged-back orders reverse their commission in full.",
  "No self-referral: your own link never applies to your own orders.",
  "No paid search on GHL Video brand terms, and no implying affiliation with GoHighLevel Inc.",
  "Quote prices only as they appear on the live site, and offer no discounts beyond the ones defined in your tier.",
];
