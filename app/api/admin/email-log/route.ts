import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";

export const runtime = "nodejs";

/*
 * The email log, read. One page of the most recent attempts, filterable to
 * the ones that went wrong, plus the summary numbers the screen leads with:
 * how many sent, failed, were skipped or held in the last 7 days. The
 * summary is the answer to the question the screen exists for, "is email
 * working", before anybody reads a single row.
 */

type Row = Record<string, unknown>;
const STATUSES = ["sent", "failed", "skipped", "held"] as const;

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  const db = supabaseAdmin();
  let query = db
    .from("email_log")
    .select("id, to_email, to_name, subject, template_key, source, status, error, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status && (STATUSES as readonly string[]).includes(status)) query = query.eq("status", status);
  if (q) query = query.or(`to_email.ilike.%${q}%,subject.ilike.%${q}%`);

  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const counts: Record<string, number> = {};
  await Promise.all(
    STATUSES.map(async (s) => {
      const { count } = await db
        .from("email_log")
        .select("id", { count: "exact", head: true })
        .eq("status", s)
        .gte("created_at", weekAgo);
      counts[s] = count ?? 0;
    }),
  );

  const { data: rows } = await query;

  return NextResponse.json({
    week: counts,
    /* the platform-wide switch, said plainly: with no key, every email is
       a skipped row and the screen should lead with why */
    keyConfigured: Boolean(process.env.BREVO_API_KEY),
    entries: ((rows ?? []) as Row[]).map((r) => ({
      id: String(r.id),
      to: String(r.to_email),
      toName: (r.to_name as string | null) ?? null,
      subject: String(r.subject),
      templateKey: (r.template_key as string | null) ?? null,
      source: String(r.source),
      status: String(r.status),
      error: (r.error as string | null) ?? null,
      at: String(r.created_at),
    })),
  });
}
