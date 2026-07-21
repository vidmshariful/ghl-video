import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SB_ANON, SB_URL } from "@/lib/chrome";

/*
 * Gate for the admin API routes. The client sends its Supabase Auth session
 * token as a Bearer header; here we verify it against Supabase and confirm
 * it belongs to a real user. Same trust model as the admin's RLS: signups
 * are disabled, so any valid session is an admin. Returns the email or null.
 */
export async function verifyAdmin(req: Request): Promise<{ email: string } | null> {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const { data, error } = await createClient(SB_URL, SB_ANON).auth.getUser(token);
  if (error || !data.user?.email) return null;
  return { email: data.user.email };
}
