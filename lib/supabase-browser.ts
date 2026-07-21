import { createClient } from "@supabase/supabase-js";
import { SB_ANON, SB_URL } from "@/lib/chrome";

/*
 * One browser Supabase client, shared by /admin and /account, so a tab has
 * a single auth session (no duplicate GoTrueClient instances). The anon key
 * is public; RLS decides what each signed-in user can touch. detectSessionInUrl
 * (on by default) lets the /account magic-link redirect establish the session.
 */
export const supabaseBrowser = createClient(SB_URL, SB_ANON);
