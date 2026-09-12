/*
 * The HighLevel sync, by hand. The cron does this every minute on Vercel;
 * locally there is no cron, so this is how a change is pushed across.
 *
 *   npm run hl:sync                    send what is waiting, once
 *   npm run hl:sync -- --watch         keep sending every 15 seconds
 *   npm run hl:sync -- --all           queue every customer, project and video first (the first fill)
 *   npm run hl:sync -- --reconcile     queue whatever drifted, verify a slice of the links, then send
 *   GHLV_ENV=prod npm run hl:sync      the same against production, only when asked
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { drainOutbox, enqueue, reconcile, type SyncKind } from "../lib/highlevel/sync";

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
  const n = await drainAll();
  console.log(n === 0 ? "  nothing waiting" : `  ${n} processed`);
  if (!args.has("--watch")) return;
  console.log("\n  watching: every 15 seconds, Ctrl+C to stop\n");
  for (;;) {
    await new Promise((r) => setTimeout(r, 15000));
    const m = await drainAll();
    if (m) console.log(`  ${new Date().toLocaleTimeString()} ${m} processed`);
  }
})().catch((e) => {
  console.error(`\nSync stopped: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
