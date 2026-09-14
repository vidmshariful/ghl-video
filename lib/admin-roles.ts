/*
 * Admin roles and the per-user menu grants, as one rule shared by the admin
 * shell (which hides menu items) and the admin API (which refuses the call).
 *
 * Until 15 September 2026 only the shell applied it: sixty of the admin
 * routes checked the allowlist alone, so a Sales Rep's token could read
 * sales figures, subscription detail and the site's SEO tools by calling
 * the API directly. The rule now lives here, import-free, and
 * lib/checkout/admin-auth.ts applies it to every route by the view the
 * route serves.
 *
 * A role is a template: it sets a default set of menu items, and an admin
 * can add or remove individual items for one person (the features column
 * on their admins row). Admin always has everything and is the only role
 * that manages the team. dashboard, settings and help are always open.
 */
export type Role = "admin" | "manager" | "sales_rep";

export const ROLES: Role[] = ["admin", "manager", "sales_rep"];

/* The menu items that can be granted or removed per user, in sidebar order. */
export const TOGGLEABLE_VIEW_ROWS: { key: string; label: string; group: string }[] = [
  { key: "messages", label: "Messages", group: "Daily" },
  { key: "sales", label: "Sales Dashboard", group: "Sales" },
  { key: "orders", label: "Orders", group: "Sales" },
  { key: "invoices", label: "Invoices", group: "Sales" },
  { key: "subscriptions", label: "Subscriptions", group: "Sales" },
  { key: "links", label: "Links", group: "Sales" },
  { key: "coupons", label: "Coupons", group: "Sales" },
  { key: "campaigns", label: "Offers", group: "Sales" },
  { key: "customers", label: "Customers", group: "Sales" },
  { key: "production", label: "Premade", group: "Production" },
  { key: "custom", label: "Custom", group: "Production" },
  { key: "editing", label: "Editing", group: "Production" },
  { key: "partners", label: "Partners", group: "Affiliate" },
  { key: "catalog", label: "Products, packs and bundles", group: "Products & Packs" },
  { key: "journal", label: "Journal", group: "CMS" },
  { key: "reference", label: "Reference", group: "CMS" },
  { key: "pages", label: "Pages", group: "CMS" },
  { key: "blog", label: "Blog", group: "CMS" },
  { key: "seo", label: "SEO", group: "CMS" },
  { key: "studio", label: "Studio Insights", group: "CMS" },
  { key: "emails", label: "Emails and notifications", group: "Daily" },
  { key: "code", label: "Site code (in Settings)", group: "Settings" },
  /* Toggleable rather than always-on: it reports payments that did not become
   * orders and orders that did not reach the studio, which is the owner's and
   * the manager's problem. A sales rep seeing it would be alarmed by something
   * they cannot act on, so the sales_rep default below leaves it out. */
  { key: "health", label: "Health", group: "Daily" },
];

export const ALL_TOGGLEABLE: string[] = TOGGLEABLE_VIEW_ROWS.map((v) => v.key);

/* The views every admin may open, whatever the role. */
export const ALWAYS_OPEN: string[] = ["dashboard", "settings", "help"];

/* Default menu set for a role when a user has no explicit override. */
export const ROLE_DEFAULTS: Record<Role, string[]> = {
  admin: ALL_TOGGLEABLE,
  manager: ALL_TOGGLEABLE.filter((k) => k !== "code"),
  sales_rep: ["orders", "invoices", "links", "messages", "customers"],
};

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as string[]).includes(v);
}

/** A stored role, or the role a row without one has always been treated as. */
export function normalizeRole(v: unknown): Role {
  return isRole(v) ? v : "manager";
}

/* A user's effective granted menu items (excludes the always-open views). A
 * null features value means "use the role default"; an array is an explicit
 * override the admin has set. */
export function effectiveViews(role: Role, features: string[] | null | undefined): string[] {
  if (role === "admin") return ALL_TOGGLEABLE;
  if (features == null) return ROLE_DEFAULTS[role];
  return features.filter((f) => ALL_TOGGLEABLE.includes(f));
}

/** Whether a user with this role and features may open one view. */
export function canAccessView(view: string, role: Role, features: string[] | null | undefined): boolean {
  if (ALWAYS_OPEN.includes(view)) return true;
  return effectiveViews(role, features).includes(view);
}

/** Whether they may open any of several views (a route that serves more than one board). */
export function canAccessAny(views: string[], role: Role, features: string[] | null | undefined): boolean {
  return views.some((v) => canAccessView(v, role, features));
}
