/*
 * The HighLevel sync, by hand. The cron does this every minute on Vercel;
 * locally there is no cron, so this is how a change is pushed across.
 *
 *   npm run hl:sync                    send what is waiting, once
 *   npm run hl:sync -- --watch         keep sending every 15 seconds
 *   npm run hl:sync -- --all           queue every customer, project and video first (the first fill)
 *   npm run hl:sync -- --reconcile     queue whatever drifted, verify a slice of the links, then send
 *   npm run hl:sync -- --products      mirror the catalogue into HighLevel products first
 *
 * Every run also reads money back: which open invoices HighLevel says are
 * paid, and any invoice made over there that we do not have yet.
 *   GHLV_ENV=prod npm run hl:sync      the same against production, only when asked
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { drainOutbox, enqueue, reconcile, type SyncKind } from "../lib/highlevel/sync";
import { loadHlConfig } from "../lib/highlevel/config";
import { pollOpenInvoices, pullInvoices, syncProductsToHighLevel } from "../lib/highlevel/money";
import { mirrorMissing, pullRecentConversations } from "../lib/highlevel/conversations";
import { refreshEmailStatuses } from "../lib/highlevel/email-log";
import { pullContactChanges } from "../lib/highlevel/inbound";

for (const line of readFileSync(process.env.GHLV_ENV === "prod" ? ".env.prod.local" : ".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !process.env.HIGHLEVEL_API_TOKEN || !process.env.HIGHLEVEL_LOCATION_ID) {
  console.error("Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, HIGHLEVEL_API_TOKEN and HIGHLEVEL_LOCATION_ID.");
  process.exit(1);
}
const args = new Set(process.argv.slice(2));
const db = createClient(url, key, { auth: { persistSession: false } });
const where = `${url.replace(/^https?:\/\//, "").split(".")[0]} -> HighLevel ${process.env.HIGHLEVEL_LOCATION_ID}`;

async function queueEverything() {
  const tables: [SyncKind, string][] = [
    ["customer", "customers"],
    ["project", "projects"],
    ["video", "order_deliverables"],
  ];
  for (const [kind, table] of tables) {
    const { data } = await db.from(table).select("id").limit(5000);
    for (const r of data ?? []) await enqueue(db, kind, String(r.id), "first fill");
    console.log(`  queued ${data?.length ?? 0} ${kind}${(data?.length ?? 0) === 1 ? "" : "s"}`);
  }
}

async function money(): Promise<void> {
  const cfg = await loadHlConfig(db, process.env.HIGHLEVEL_LOCATION_ID as string);
  if (!cfg) return;
  const polled = await pollOpenInvoices(db, cfg);
  const pulled = await pullInvoices(db, cfg, { pages: 1 });
  if (polled.changed || pulled.imported || pulled.skipped.length)
    console.log(
      `  money: ${polled.checked} open invoices checked, ${polled.paid} now paid, ${polled.changed} changed; ${pulled.imported} imported from HighLevel${pulled.skipped.length ? `; skipped: ${pulled.skipped.join(" | ")}` : ""}`,
    );
  const talk = await pullRecentConversations(db, cfg);
  const mirrored = await mirrorMissing(db);
  if (talk.landed || mirrored) console.log(`  messages: ${talk.landed} pulled from HighLevel, ${mirrored} sent across`);
  const mail = await refreshEmailStatuses(db);
  if (mail.checked) console.log(`  email: ${mail.checked} checked, ${mail.failed} failed, ${mail.delivered} delivered`);
}

/** HighLevel's edits first, so the drain never sends our copy back over them. */
async function edits(): Promise<void> {
  const cfg = await loadHlConfig(db, process.env.HIGHLEVEL_LOCATION_ID as string);
  if (!cfg) return;
  const e = await pullContactChanges(db, cfg.locationId, 5 * 60_000);
  if (e.changed) console.log(`  contacts: ${e.changed} edited in HighLevel: ${e.outcomes.join(" | ")}`);
}

async function drainAll(): Promise<number> {
  let total = 0;
  for (;;) {
    const out = await drainOutbox(db, { limit: 40 });
    if (!out.provisioned) {
      console.log("  HighLevel is not provisioned for this location: npm run hl:provision first.");
      return total;
    }
    for (const r of out.rows) {
      const mark = r.status === "failed" ? "FAIL" : r.status === "done" ? "sent" : r.status;
      console.log(`  ${mark.padEnd(9)} ${r.kind.padEnd(8)} ${r.entityId}  ${r.note}`);
    }
    total += out.processed;
    if (out.processed < 40) return total;
  }
}

(async () => {
  console.log(`\nHIGHLEVEL SYNC ${where}\n`);
  if (args.has("--all")) await queueEverything();
  if (args.has("--reconcile")) {
    const r = await reconcile(db);
    console.log(
      `  reconcile: queued ${r.enqueued.customer} customers, ${r.enqueued.project} projects, ${r.enqueued.video} videos; verified ${r.verified} links, ${r.missing} gone; ${r.pending} pending, ${r.stuck} stuck`,
    );
  }
  if (args.has("--products")) {
    const cfg = await loadHlConfig(db, process.env.HIGHLEVEL_LOCATION_ID as string);
    if (cfg) {
      const r = await syncProductsToHighLevel(db, cfg);
      console.log(`  products: ${r.seen} seen, ${r.made} made, ${r.repriced} repriced, ${r.unchanged} unchanged${r.errors.length ? `; errors: ${r.errors.join(" | ")}` : ""}`);
    }
  }
  await edits();
  const n = await drainAll();
  await money();
  console.log(n === 0 ? "  nothing waiting" : `  ${n} processed`);
  if (!args.has("--watch")) return;
  console.log("\n  watching: every 15 seconds, Ctrl+C to stop\n");
  for (;;) {
    await new Promise((r) => setTimeout(r, 15000));
    await edits();
    const m = await drainAll();
    await money();
    if (m) console.log(`  ${new Date().toLocaleTimeString()} ${m} processed`);
  }
})().catch((e) => {
  console.error(`\nSync stopped: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
