/* The admin's screens, shared between the shell and screens that navigate
 * (e.g. the dashboard's shortcuts into Orders). Every view is also a URL
 * segment (/admin/<view>/); ALL_VIEWS is what the route validates against. */
export type View =
  | "dashboard"
  | "journal"
  | "reference"
  | "health"
  | "orders"
  | "messages"
  | "subscriptions"
  | "products"
  | "coupons"
  | "campaigns"
  | "links"
  | "invoices"
  | "customers"
  | "partners"
  | "code"
  | "pages"
  | "blog"
  | "seo"
  | "catalog"
  | "studio"
  | "emails"
  | "production"
  | "settings"
  | "help";

export const ALL_VIEWS: View[] = [
  "dashboard",
  "journal",
  "reference",
  "health",
  "orders",
  "messages",
  "subscriptions",
  "products",
  "coupons",
  "campaigns",
  "links",
  "invoices",
  "customers",
  "partners",
  "code",
  "pages",
  "blog",
  "seo",
  "catalog",
  "studio",
  "emails",
  "production",
  "settings",
  "help",
];
