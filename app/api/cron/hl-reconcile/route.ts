import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { drainOutbox, reconcile } from "@/lib/highlevel/sync";
import { loadHlConfig } from "@/lib/highlevel/config";
import { locationId } from "@/lib/highlevel/client";
import { pullInvoices, syncProductsToHighLevel } from "@/lib/highlevel/money";
import { raise } from "@/lib/alarm";
import { pullContactChanges } from "@/lib/highlevel/inbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/*
 * The nightly "is anything adrift" between us and HighLevel: queue what
 * has no link or changed after its last send, check a slice of the links
 * against HighLevel, send what that queued, and raise an alarm on the
 * Health screen when something is stuck or was deleted over there.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const signed = Boolean(secret && req.headers.get("authorization") === `Bearer ${secret}`);
  if (!signed && !(await verifyAdmin(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!process.env.HIGHLEVEL_API_TOKEN || !process.env.HIGHLEVEL_LOCATION_ID)
    return NextResponse.json({ ok: true, note: "HighLevel is not configured here." });

  const db = supabaseAdmin();
  try {
    return NextResponse.json(await run(db));
  } catch (e) {
    /* a throw here was a 500 in Vercel's logs and nothing else, with Health
       green all the while (audit, 15 September 2026) */
    const message = e instanceof Error ? e.message : String(e);
    await raise(db, {
      kind: "cron.failed",
      fingerprint: "cron:hl-reconcile",
      notifyAfter: 2,
      message: `The nightly HighLevel check stopped part way: ${message}`,
      context: { route: "hl-reconcile", error: message },
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

async function run(db: ReturnType<typeof supabaseAdmin>) {
  const drift = await reconcile(db);
  const sent = drift.provisioned ? await drainOutbox(db, { limit: 40 }) : null;
  const stuck = sent ? drift.stuck : 0;

  /* the catalogue as HighLevel products, and every invoice made over there */
  const cfg = drift.provisioned ? await loadHlConfig(db, locationId()) : null;
  const products = cfg ? await syncProductsToHighLevel(db, cfg) : null;
  const pulled = cfg ? await pullInvoices(db, cfg, { pages: 3 }) : null;
  /* a day's worth of contact edits, in case the minute cron missed any */
  const contacts = cfg ? await pullContactChanges(db, cfg.locationId, 25 * 3600_000) : null;
  if (drift.errors.length) {
    await raise(db, {
      kind: "highlevel.reconcile_failed",
      severity: "error",
      fingerprint: "highlevel:reconcile_failed",
      message: `The nightly HighLevel check could not read ${drift.errors.length} of its ${drift.errors.length === 1 ? "table" : "tables"}, so nothing was queued for ${drift.errors.length === 1 ? "it" : "them"}: ${drift.errors.join(" | ")}`,
      context: { errors: drift.errors },
    });
  }
  if (products?.errors.length) {
    await raise(db, {
      kind: "highlevel.products",
      severity: "warn",
      message: `${products.errors.length} catalogue ${products.errors.length === 1 ? "product" : "products"} could not be mirrored into HighLevel.`,
      fingerprint: "highlevel:products",
      context: { errors: products.errors.slice(0, 10) },
    });
  }

  if (drift.missing > 0) {
    await raise(db, {
      kind: "highlevel.drift",
      severity: "warn",
      message: `${drift.missing} of ${drift.verified} checked HighLevel links pointed at something deleted over there. Queued again.`,
      fingerprint: "highlevel:drift",
      context: { verified: drift.verified, missing: drift.missing },
    });
  }
  if (stuck > 0) {
    await raise(db, {
      kind: "highlevel.sync_stuck",
      severity: "error",
      message: `${stuck} HighLevel sync ${stuck === 1 ? "row has" : "rows have"} failed three times or more. See hl_sync_outbox.last_error.`,
      fingerprint: "highlevel:stuck",
      context: { stuck, pending: drift.pending },
    });
  }
  return {
    ok: true,
    ...drift,
    sent: sent ? { processed: sent.processed, failed: sent.failed, deadLettered: sent.deadLettered } : null,
    products,
    invoices: pulled,
    contacts,
  };
}
