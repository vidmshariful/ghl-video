/*
 * The nightly invariant check, by hand.
 *
 *   npm run check:invariants            report against .env.local (staging)
 *   GHLV_ENV=prod npm run check:invariants   the same, read-only, on production
 *   npm run check:invariants -- --alarm  also raise an alarm per failing check
 *
 * Exit 1 when any error-severity check fails, so it can gate a deploy.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { runInvariants, invariantMessage } from "../lib/invariants";

for (const line of readFileSync(process.env.GHLV_ENV === "prod" ? ".env.prod.local" : ".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const alarm = process.argv.includes("--alarm");

(async () => {
  const db = createClient(url, key, { auth: { persistSession: false } });
  const results = await runInvariants(db);
  const failing = results.filter((r) => r.count > 0);
  console.log(`\nINVARIANTS on ${url.replace(/^https?:\/\//, "").split(".")[0]} (${process.env.GHLV_ENV ?? "staging"})\n`);
  for (const r of results) {
    const mark = r.count === 0 ? "ok  " : r.severity === "error" ? "FAIL" : "warn";
    console.log(`  ${mark}  ${r.key.padEnd(26)} ${r.rule}`);
    if (r.count > 0) console.log(`        ${r.count} ${r.count === 1 ? "row" : "rows"}: ${r.sample.join("; ")}`);
  }
  if (alarm && failing.length) {
    /* the same statement lib/alarm.ts runs; that module is server-only and
       cannot be imported here, so the call is made directly */
    for (const r of failing) {
      const { error } = await db.rpc("raise_alarm", {
        p_kind: `invariant.${r.key}`,
        p_severity: r.severity === "error" ? "error" : "warn",
        p_fingerprint: `invariant:${r.key}`,
        p_message: invariantMessage(r),
        p_context: { count: r.count, sample: r.sample },
      });
      if (error) console.error(`  could not raise invariant.${r.key}: ${error.message}`);
    }
    console.log(`\n${failing.length} alarm${failing.length === 1 ? "" : "s"} raised on the Health screen.`);
  }
  const errors = failing.filter((r) => r.severity === "error").length;
  console.log(
    `\n${results.length - failing.length} of ${results.length} hold. ${failing.length} failing, ${errors} of them errors.\n`,
  );
  process.exit(errors ? 1 : 0);
})();
