import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SB_ANON, SB_URL } from "@/lib/chrome";

/*
 * Verify a Supabase Auth session token from a request and return the
 * signed-in email, or null. Used by both the customer portal routes (any
 * valid session, scoped to their own email) and the admin gate (which adds
 * an allowlist check on top). Email verification via Supabase Auth is what
 * proves the caller owns the email their data is keyed on.
 */
export async function getSessionEmail(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const { data, error } = await createClient(SB_URL, SB_ANON).auth.getUser(token);
  if (error || !data.user?.email) return null;
  return data.user.email.toLowerCase();
}
