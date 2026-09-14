/* The customer portal's sections. Each is a URL segment
 * (/portal/<section>/); the [[...view]] route validates against this list.
 * Plain module on purpose: the server route needs the VALUES, and data
 * exported from a "use client" file never crosses to server components. */
export const PORTAL_SECTIONS = [
  "dashboard",
  "orders",
  "videos",
  "projects",
  "brand",
  "library",
  "coming-soon",
  "messages",
  "subscriptions",
  "billing",
  "book",
  "affiliate",
  "whitelabel",
  "socialx",
  "settings",
  "help",
] as const;
export type PortalSection = (typeof PORTAL_SECTIONS)[number];
