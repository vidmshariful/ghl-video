import type { View } from "./nav";

/*
 * Admin roles + the per-user menu gating. A role is a template: it sets a
 * default set of menu items, and an admin can then add or remove individual
 * items for one person (stored as a features override on their admins row).
 * Admin always has full access and is the only role that manages the team.
 */
export type Role = "admin" | "manager" | "sales_rep";

export const ROLES: Role[] = ["admin", "manager", "sales_rep"];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  sales_rep: "Sales Rep",
};

export const ROLE_BLURB: Record<Role, string> = {
  admin: "Full access, and the only role that can manage the team.",
  manager: "Runs the business day to day. Everything except the team and site code.",
  sales_rep: "Sales tools: orders, clients, invoices, and buy links.",
};

/* The menu items that can be granted or removed per user. 'dashboard',
 * 'settings', and 'help' are always visible; inside Settings, the Team and
 * Integrations tabs are admin-only and never a per-user toggle. */
export const TOGGLEABLE_VIEWS: { key: View; label: string; group: string }[] = [
  { key: "orders", label: "Orders", group: "Sales" },
  { key: "invoices", label: "Invoices", group: "Sales" },
  { key: "subscriptions", label: "Subscriptions", group: "Sales" },
  { key: "links", label: "Links", group: "Sales" },
  { key: "coupons", label: "Coupons", group: "Sales" },
  { key: "customers", label: "Customers", group: "Sales" },
  { key: "production", label: "Production", group: "Production" },
  { key: "messages", label: "Messages", group: "Production" },
  { key: "partners", label: "Partners", group: "Affiliate" },
  { key: "catalog", label: "Videos", group: "Products & Packs" },
  { key: "products", label: "Products & Pricing", group: "Products & Packs" },
  { key: "journal", label: "Journal", group: "CMS" },
  { key: "pages", label: "Pages", group: "CMS" },
  { key: "blog", label: "Blog", group: "CMS" },
  { key: "studio", label: "Studio Insights", group: "CMS" },
  { key: "emails", label: "Emails (in Settings)", group: "Settings" },
  { key: "code", label: "Site code (in Settings)", group: "Settings" },
];

const ALL_TOGGLEABLE = TOGGLEABLE_VIEWS.map((v) => v.key);

/* Default menu set for a role when a user has no explicit override. */
export const ROLE_DEFAULT_FEATURES: Record<Role, View[]> = {
  admin: ALL_TOGGLEABLE,
  manager: ALL_TOGGLEABLE.filter((k) => k !== "code"),
  sales_rep: ["orders", "invoices", "links", "messages", "customers"],
};

/* A user's effective granted menu items (excludes the always-on views). A null
 * features value means "use the role default"; an array is an explicit
 * override the admin has set. */
export function effectiveFeatures(
  role: Role,
  features: string[] | null | undefined,
): View[] {
  if (role === "admin") return ALL_TOGGLEABLE;
  if (features == null) return ROLE_DEFAULT_FEATURES[role];
  return features.filter((f): f is View => (ALL_TOGGLEABLE as string[]).includes(f));
}

/* Whether a user with this role + features may open a given view. */
export function canAccess(
  view: View,
  role: Role,
  features: string[] | null | undefined,
): boolean {
  if (view === "dashboard" || view === "settings" || view === "help") return true;
  return effectiveFeatures(role, features).includes(view);
}

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as string[]).includes(v);
}
