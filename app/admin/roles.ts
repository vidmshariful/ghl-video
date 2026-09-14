import type { View } from "./nav";

/*
 * Admin roles + the per-user menu gating. A role is a template: it sets a
 * default set of menu items, and an admin can then add or remove individual
 * items for one person (stored as a features override on their admins row).
 * Admin always has full access and is the only role that manages the team.
 */
export type { Role } from "@/lib/admin-roles";
import type { Role } from "@/lib/admin-roles";
import {
  ALL_TOGGLEABLE,
  ROLES as ROLE_KEYS,
  ROLE_DEFAULTS,
  TOGGLEABLE_VIEW_ROWS,
  canAccessView,
  effectiveViews,
  isRole as isRoleKey,
} from "@/lib/admin-roles";

/* The rule itself lives in lib/admin-roles.ts, shared with the admin API
 * (lib/checkout/admin-auth.ts), so the menu and the routes can never
 * disagree. This file keeps the labels and the View typing the shell uses. */
export const ROLES: Role[] = ROLE_KEYS;

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

/*
 * The order the grant checkboxes are grouped in, mirroring the sidebar.
 *
 * It lives beside TOGGLEABLE_VIEWS rather than in the screen that draws it,
 * because a view whose group is missing from this list silently loses its
 * checkbox and then nobody can grant or revoke it. A unit test holds the two
 * together.
 */
export const VIEW_GROUPS = [
  "Daily",
  "Sales",
  "Production",
  "Affiliate",
  "Products & Packs",
  "CMS",
  "Settings",
] as const;

export const TOGGLEABLE_VIEWS = TOGGLEABLE_VIEW_ROWS as { key: View; label: string; group: string }[];

/* Default menu set for a role when a user has no explicit override. */
export const ROLE_DEFAULT_FEATURES = ROLE_DEFAULTS as Record<Role, View[]>;

/* A user's effective granted menu items (excludes the always-on views). */
export function effectiveFeatures(role: Role, features: string[] | null | undefined): View[] {
  return effectiveViews(role, features) as View[];
}

/* Whether a user with this role + features may open a given view. */
export function canAccess(view: View, role: Role, features: string[] | null | undefined): boolean {
  return canAccessView(view, role, features);
}

export function isRole(v: unknown): v is Role {
  return isRoleKey(v);
}

/* kept for callers that read the plain list */
export const TOGGLEABLE_KEYS: View[] = ALL_TOGGLEABLE as View[];
