/*
 * Code <-> database drift check.
 *
 * Fails (exit 1) when the price a page shows in CODE disagrees with the
 * `products` row that CHECKOUT actually charges. That gap is real: the two
 * only agree after somebody presses "Sync from catalog" in the admin.
 *
 * The comparison itself lives in lib/checkout/price-drift.ts, because the
 * scheduled check raises an alarm from the same function. Two copies of a
 * money check is two chances to fix one and forget the other.
 *
 * Run:  npm run check:drift      (needs .env.local with the service-role key)
 * Use it after any price/bundle edit, before or after a deploy.
 *
 * You do not have to remember: /api/cron/price-drift runs this every morning
 * and raises a critical alarm if anything has drifted.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { findPriceDrift } from "@/lib/checkout/price-drift";

// --- env (parse .env.local the same way the other scripts do) ---
const env: Record<string, string> = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(2);
}
const db = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const report = await findPriceDrift(db).catch((e: Error) => {
    console.error(e.message);
    process.exit(2);
  });

  console.log(
    `\nChecked ${report.checkedProducts} one-time products + ${report.checkedBundles} bundles against the database.\n`,
  );
  if (report.warnings.length) {
    console.log(`${report.warnings.length} warning(s):`);
    for (const w of report.warnings) console.log("  - " + w);
    console.log("");
  }
  if (report.problems.length) {
    console.log(`FOUND ${report.problems.length} DRIFT PROBLEM(S):`);
    for (const p of report.problems) console.log("  x " + p);
    console.log("");
    process.exit(1);
  }
  console.log("OK: every code price and bundle composition matches the database.\n");
  process.exit(0);
}

void main();
