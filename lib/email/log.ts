import { createClient } from "@supabase/supabase-js";

/*
 * The email log's one writer.
 *
 * Deliberately NOT the shared supabase-admin helper: that chain carries the
 * server-only marker, and this module has to be importable by the plain
 * node scripts that exercise the send path in tests. It builds its own
 * service-role client from the same env, which only exists on the server
 * anyway, so the effective boundary is unchanged.
 *
 * Logging must never break sending. Every failure in here is swallowed:
 * an email that went out but could not be recorded beats an email that was
 * not sent because the record failed.
 */

export type EmailLogEntry = {
  to: string;
  toName?: string | null;
  subject: string;
  templateKey?: string | null;
  source?: string;
  status: "sent" | "failed" | "skipped" | "held";
  error?: string | null;
  meta?: Record<string, unknown>;
};

export async function logEmail(entry: EmailLogEntry): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    const db = createClient(url, key, { auth: { persistSession: false } });
    await db.from("email_log").insert({
      to_email: entry.to.toLowerCase().slice(0, 320),
      to_name: entry.toName?.slice(0, 160) ?? null,
      subject: entry.subject.slice(0, 500),
      template_key: entry.templateKey ?? null,
      source: (entry.source ?? "direct").slice(0, 60),
      status: entry.status,
      error: entry.error?.slice(0, 1000) ?? null,
      meta: entry.meta ?? {},
    });
  } catch (e) {
    console.error("[email] log write failed:", e instanceof Error ? e.message : e);
  }
}
