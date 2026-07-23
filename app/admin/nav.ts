/* The admin's screens, shared between the shell and screens that navigate
 * (e.g. the dashboard's shortcuts into Orders). */
export type View =
  | "dashboard"
  | "orders"
  | "subscriptions"
  | "products"
  | "bumps"
  | "customers"
  | "code"
  | "pages"
  | "videos";
