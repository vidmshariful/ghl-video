/* The partner portal's views. Each is a URL segment
 * (/partners/<view>/); the [[...view]] route validates against this list.
 * Plain module on purpose: the server route needs the VALUES, and data
 * exported from a "use client" file never crosses to server components. */
export const PARTNER_VIEWS = [
  "dashboard",
  "performance",
  "referrals",
  "earnings",
  "assets",
  "resources",
  "book",
  "whitelabel",
  "settings",
] as const;
export type View = (typeof PARTNER_VIEWS)[number];
