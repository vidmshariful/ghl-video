import "server-only";
import { getSessionEmail } from "@/lib/account/session";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { canAccessAny, normalizeRole } from "@/lib/admin-roles";

/*
 * Gate for the admin API routes. Now that customers can also log in via
 * Supabase Auth, a valid session is no longer enough: the email must be in
 * the admins allowlist. Returns the email or null.
 */
export async function verifyAdmin(req: Request): Promise<{ email: string } | null> {
  const email = await getSessionEmail(req);
  if (!email) return null;
  // Case-insensitive like the is_admin() RLS function, so a row seeded with
  // any casing still gates the same. The allowlist is a handful of rows, so
  // reading it whole beats wrestling ilike wildcard escaping.
  const { data } = await supabaseAdmin().from("admins").select("email");
  const ok = (data ?? []).some((r) => (r.email ?? "").toLowerCase() === email.toLowerCase());
  return ok ? { email } : null;
}

/*
 * The caller's role from the allowlist ('admin' | 'manager' | 'sales_rep'),
 * or null if the email is not an admin. Used to gate the team-management
 * routes to the 'admin' role server-side, so a limited user cannot escalate
 * by hitting the API directly.
 */
export async function adminRole(email: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from("admins").select("email, role");
  const row = (data ?? []).find(
    (r) => (r.email ?? "").toLowerCase() === email.toLowerCase(),
  );
  return (row?.role as string | undefined) ?? null;
}

/*
 * The gate for a route that serves one screen: the caller must be an admin
 * AND their role and grants must include the view that screen is, by the
 * same rule the shell uses to draw the menu (lib/admin-roles.ts). A route
 * that several boards share names all of them; any one is enough. Answers
 * null for a stranger and for an admin whose role does not include the
 * view, so every caller's existing "no admin, 401" branch holds; the
 * refusal is logged with the reason so a locked-out teammate can be
 * diagnosed from the logs.
 */
export async function verifyAdminFor(req: Request, view: string | string[]): Promise<{ email: string } | null> {
  const email = await getSessionEmail(req);
  if (!email) return null;
  const { data } = await supabaseAdmin().from("admins").select("email, role, features");
  const row = (data ?? []).find((r) => (r.email ?? "").toLowerCase() === email.toLowerCase());
  if (!row) return null;
  const views = Array.isArray(view) ? view : [view];
  const role = normalizeRole(row.role);
  const features = Array.isArray(row.features) ? (row.features as string[]) : null;
  if (!canAccessAny(views, role, features)) {
    console.warn(`[admin] ${email} (${role}) refused: the role does not include ${views.join(" or ")}`);
    return null;
  }
  return { email };
}
