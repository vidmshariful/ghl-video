import "server-only";
import { getSessionEmail } from "@/lib/account/session";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";

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
