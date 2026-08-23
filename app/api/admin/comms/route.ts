import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";

export const runtime = "nodejs";

/*
 * Everything the Emails and notifications screen needs in one call: the
 * team's edits to both kinds of template, whether Brevo is even configured,
 * and how often each email and each bell actually fired in the last 30 days.
 * The counts are the part a dropdown could never show: an email that went out
 * two hundred times this month is worth rewording, one that never fires is
 * not worth the afternoon.
 */

type Row = Record<string, unknown>;

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = supabaseAdmin();
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const [{ data: emailTemplates }, { data: notifTemplates }, { data: log }, { data: bells }] =
    await Promise.all([
      db.from("email_templates").select("key, subject, body, enabled"),
      db.from("notification_templates").select("audience, kind, title, body, enabled"),
      db
        .from("email_log")
        .select("template_key, status")
        .gte("created_at", since)
        .not("template_key", "is", null)
        .limit(10000),
      db
        .from("notifications")
        .select("audience, kind, created_at")
        .gte("created_at", since)
        .limit(10000),
    ]);

  /* per template: sent / failed / skipped / held in the window */
  const emailCounts: Record<string, { sent: number; failed: number; skipped: number; held: number }> = {};
  for (const r of (log ?? []) as Row[]) {
    const k = String(r.template_key);
    const s = String(r.status) as "sent" | "failed" | "skipped" | "held";
    emailCounts[k] ??= { sent: 0, failed: 0, skipped: 0, held: 0 };
    if (s in emailCounts[k]) emailCounts[k][s] += 1;
  }

  /* per audience and kind: how many events, not rows. A team bell fans out
     to every admin in one insert, so the rows share a timestamp and the
     distinct timestamps are the honest count. */
  const seen = new Set<string>();
  const bellCounts: Record<string, number> = {};
  for (const r of (bells ?? []) as Row[]) {
    const id = `${String(r.audience)}:${String(r.kind)}`;
    const stamp = `${id}@${String(r.created_at)}`;
    if (seen.has(stamp)) continue;
    seen.add(stamp);
    bellCounts[id] = (bellCounts[id] ?? 0) + 1;
  }

  return NextResponse.json({
    brevoConfigured: Boolean(process.env.BREVO_API_KEY),
    emailTemplates: emailTemplates ?? [],
    notificationTemplates: notifTemplates ?? [],
    emailCounts,
    bellCounts,
    windowDays: 30,
  });
}
