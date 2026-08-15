/*
 * The feature grants a portal owner can give a team member, shared by the
 * server gates and the Settings UI. Null features on a member row means
 * "everything below"; an array is the explicit grant list. Team management
 * itself is never a grant: it stays owner-only.
 */

export type TeamFeature = { key: string; label: string; blurb: string };

export const CUSTOMER_TEAM_FEATURES: TeamFeature[] = [
  {
    key: "orders",
    label: "Orders & projects",
    blurb: "See orders, progress, briefs, and deliveries.",
  },
  {
    key: "messages",
    label: "Messages",
    blurb: "Chat with the studio on your projects.",
  },
  {
    key: "subscriptions",
    label: "View plans",
    blurb: "See your editing plan and its renewal date.",
  },
  {
    key: "billing",
    label: "Manage billing",
    blurb: "Cancel or resume plans and open billing. Leave off for view-only.",
  },
];

export const PARTNER_TEAM_FEATURES: TeamFeature[] = [
  {
    key: "performance",
    label: "Performance",
    blurb: "Clicks, referrals, and revenue stats.",
  },
  {
    key: "referrals",
    label: "Referrals",
    blurb: "Who signed up through your links.",
  },
  {
    key: "earnings",
    label: "Earnings & payouts",
    blurb: "Balance, commissions, and payout history.",
  },
  {
    key: "assets",
    label: "Links & assets",
    blurb: "Tracked links, banners, and swipe copy.",
  },
  {
    key: "profile",
    label: "Edit public profile",
    blurb: "Change the name, tagline, and bio your partner page shows.",
  },
];

export function teamFeaturesFor(accountType: "customer" | "partner"): TeamFeature[] {
  return accountType === "customer" ? CUSTOMER_TEAM_FEATURES : PARTNER_TEAM_FEATURES;
}

/** Whether a member's grant list allows a feature. Null = everything. */
export function memberCan(features: string[] | null | undefined, key: string): boolean {
  if (features == null) return true;
  return features.includes(key);
}

/** Keep only known keys; an empty result stays an explicit empty grant. */
export function sanitizeFeatures(
  accountType: "customer" | "partner",
  input: unknown,
): string[] | null {
  if (input == null) return null;
  if (!Array.isArray(input)) return null;
  const known = teamFeaturesFor(accountType).map((f) => f.key);
  return input.filter((v): v is string => typeof v === "string" && known.includes(v));
}
