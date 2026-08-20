/*
 * Which portal sections admin can hide for one client.
 *
 * A plain module with no imports, so both the admin screen and the portal's
 * server route can read it. The list is deliberately shorter than the portal's
 * own section list: Dashboard, Settings and Help are never hideable, because a
 * client with no way to reach their account or ask for help is not a
 * restricted account, it is a broken one.
 */
export const HIDEABLE_SECTIONS: { key: string; label: string }[] = [
  { key: "videos", label: "My Videos" },
  { key: "library", label: "Video Library" },
  { key: "coming-soon", label: "Coming Soon" },
  { key: "book", label: "Book a Call" },
  { key: "brand", label: "Brand Kit" },
  { key: "orders", label: "Orders and Invoices" },
  { key: "subscriptions", label: "My Plan" },
  { key: "messages", label: "Messages" },
  { key: "affiliate", label: "Affiliate program" },
  { key: "whitelabel", label: "White-label" },
  { key: "socialx", label: "SocialX" },
];

export const HIDEABLE_KEYS = new Set(HIDEABLE_SECTIONS.map((s) => s.key));
