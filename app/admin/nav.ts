/* The admin's screens, shared between the shell and screens that navigate
 * (e.g. the dashboard's shortcuts into Orders). */
export type View =
  | "dashboard"
  | "journal"
  | "orders"
  | "messages"
  | "subscriptions"
  | "products"
  | "coupons"
  | "links"
  | "invoices"
  | "customers"
  | "partners"
  | "code"
  | "pages"
  | "catalog"
  | "studio"
  | "emails"
  | "settings"
  | "help";
