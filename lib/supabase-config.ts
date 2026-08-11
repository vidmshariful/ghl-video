/*
 * Public Supabase handles (URL + anon key) for RUNTIME reads from the browser
 * and from non-secret server code: the DB catalog, studio slots + capacity
 * chips, and portal/admin auth session checks. These are the PUBLIC values
 * (the anon key is RLS-limited by design); the service-role key lives only in
 * lib/checkout/supabase-admin.ts behind a server-only guard.
 *
 * Env-first, with a baked fallback so a missing env var never yields an empty
 * client. Lives here (not in lib/chrome.ts) so DB config is not hidden inside
 * a file about nav/footer/tracking.
 */
export const SB_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://xdarleyimthsnareuoxl.supabase.co";
export const SB_ANON =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkYXJsZXlpbXRoc25hcmV1b3hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NzI2NzAsImV4cCI6MjEwMDE0ODY3MH0.x0rM_RbjlFi9tvA7XTf74NVDDkagICkEPQcQyeaean8";
