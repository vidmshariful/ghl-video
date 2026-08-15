import { supabaseBrowser } from "@/lib/supabase-browser";

/*
 * The admin screens use the shared browser client (one auth session per
 * tab). After login supabase-js sends the admin's session JWT, so RLS
 * (now gated on the admins allowlist) admits only real admins.
 */
export const supabase = supabaseBrowser;

export const money = (cents: number, cur = "usd") =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: cur.toUpperCase(),
    // whole dollars stay clean ($495); fractional amounts keep BOTH cents
    // digits so $1,396.50 never renders as the typo-looking $1,396.5
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });

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
