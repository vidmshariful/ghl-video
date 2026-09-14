import { supabaseBrowser } from "@/lib/supabase-browser";

/*
 * The admin screens use the shared browser client (one auth session per
 * tab). After login supabase-js sends the admin's session JWT, so RLS
 * (now gated on the admins allowlist) admits only real admins.
 */
export const supabase = supabaseBrowser;

/* one formatter for admin and portal alike, so $1,396.50 never renders as
   the typo-looking $1,396.5 on either */
export { money } from "@/lib/money-format";

export const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/** Authorization header carrying the current admin session token, for
 *  calls to the admin API routes (which re-verify it server-side). */
export async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
