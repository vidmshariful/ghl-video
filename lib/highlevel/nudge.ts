import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadHlConfig } from "./config";
import { locationId } from "./client";
import { syncEntity } from "./sync";

/*
 * Send one invoice across right now, from the screen that just raised or
 * changed it, so the pay link is there before the page refreshes. The
 * outbox row the trigger wrote is still processed by the cron and finds
 * nothing left to do. Never throws: HighLevel being down is the cron's
 * problem a minute later, not the admin's now.
 */
export async function nudgeInvoice(db: SupabaseClient, id: string): Promise<Record<string, unknown> | null> {
  try {
    if (!process.env.HIGHLEVEL_API_TOKEN || !process.env.HIGHLEVEL_LOCATION_ID) return null;
    const cfg = await loadHlConfig(db, locationId());
    if (!cfg) return null;
    const out = await syncEntity(db, cfg, "invoice", id);
    if (out.status === "skipped") console.warn(`[highlevel] invoice ${id} not sent now: ${out.note}`);
  } catch (e) {
    console.error(`[highlevel] invoice ${id} nudge failed: ${e instanceof Error ? e.message : e}`);
  }
  const { data } = await db.from("invoices").select("*").eq("id", id).maybeSingle();
  return data ?? null;
}
