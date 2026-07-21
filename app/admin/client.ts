import { createClient } from "@supabase/supabase-js";
import { SB_ANON, SB_URL } from "@/lib/chrome";

/*
 * One shared Supabase client for the whole admin. The anon key is public;
 * after login supabase-js sends the admin's session JWT, so RLS sees the
 * authenticated role. Screens import this instance so they share the same
 * session, and admin API routes receive that session's access token.
 */
export const supabase = createClient(SB_URL, SB_ANON);

export const money = (cents: number, cur = "usd") =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: cur.toUpperCase(),
    minimumFractionDigits: 0,
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
