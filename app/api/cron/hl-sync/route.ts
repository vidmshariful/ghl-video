import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { drainOutbox } from "@/lib/highlevel/sync";
import { loadHlConfig } from "@/lib/highlevel/config";
import { locationId } from "@/lib/highlevel/client";
import { pollOpenInvoices, pullInvoices } from "@/lib/highlevel/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/*
 * The minute-by-minute send to HighLevel: whatever the triggers queued
 * since the last run goes across now. Like the other crons: Vercel
 * presents CRON_SECRET, or a signed-in admin runs it by hand.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const signed = Boolean(secret && req.headers.get("authorization") === `Bearer ${secret}`);
  if (!signed && !(await verifyAdmin(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!process.env.HIGHLEVEL_API_TOKEN || !process.env.HIGHLEVEL_LOCATION_ID)
    return NextResponse.json({ ok: true, note: "HighLevel is not configured here." });

  const db = supabaseAdmin();
  const started = Date.now();
  const totals = { processed: 0, done: 0, unchanged: 0, skipped: 0, failed: 0 };
  const rows: unknown[] = [];
  let provisioned = true;
  /* keep going while there is more and time allows; the row limit keeps one call short */
  for (;;) {
    const out = await drainOutbox(db, { limit: 40 });
    provisioned = out.provisioned;
    for (const k of Object.keys(totals) as (keyof typeof totals)[]) totals[k] += out[k];
    rows.push(...out.rows);
    if (!out.provisioned || out.processed < 40 || Date.now() - started > 40_000) break;
  }
  /* money moves the other way too: what was paid on HighLevel's page, and
     invoices made over there (by hand or by a retainer schedule) */
  let invoices: unknown = null;
  if (provisioned) {
    const cfg = await loadHlConfig(db, locationId());
    if (cfg) {
      const polled = await pollOpenInvoices(db, cfg);
      const pulled = await pullInvoices(db, cfg, { pages: 1 });
      invoices = { ...polled, imported: pulled.imported, seen: pulled.seen, skipped: pulled.skipped };
    }
  }
  return NextResponse.json({ ok: true, provisioned, ...totals, rows, invoices });
}
