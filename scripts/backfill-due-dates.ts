/*
 * Give the videos we already owe a promised date.
 *
 * Due dates are stamped when a brief lands, so every order whose brief landed
 * before this feature existed has none. Without this they would show no date
 * forever, which for a client who is waiting is the same as us having no idea.
 *
 * Idempotent, and safe to run whenever: it recomputes from each order's own
 * intake date, so running it twice cannot move a date, and finished videos are
 * left alone by setDueDatesForOrder so the record of whether we were on time
 * survives.
 *
 *   npx tsx scripts/backfill-due-dates.ts            # show what it would do
 *   npx tsx scripts/backfill-due-dates.ts --write    # do it
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { setDueDatesForOrder } from "@/lib/deliverables";
import { turnaroundDays, dueAtFrom, formatDay } from "@/lib/delivery-dates";

const env: Record<string, string> = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const write = process.argv.includes("--write");

async function main() {
  const { data: orders, error } = await db
    .from("orders")
    .select("id, invoice_number, intake_completed_at, products(name, metadata)")
    .eq("status", "paid")
    .not("intake_completed_at", "is", null);
  if (error) {
    console.error("orders read failed:", error.message);
    process.exit(2);
  }

  const rows = orders ?? [];
  console.log(
    `\n${rows.length} paid order(s) have a brief date to count from.${write ? "" : " (dry run)"}\n`,
  );

  let dated = 0;
  for (const o of rows) {
    const meta = (o.products as { metadata?: unknown } | null)?.metadata;
    const days = turnaroundDays(meta);
    const due = dueAtFrom(o.intake_completed_at as string, days);
    const label = `${o.invoice_number ?? (o.id as string).slice(0, 8)}  brief ${formatDay(o.intake_completed_at as string)}  +${days}d  due ${formatDay(due)}`;

    if (!write) {
      console.log(`  would date  ${label}`);
      continue;
    }
    const { dated: n, reason } = await setDueDatesForOrder(db, o.id as string);
    dated += n;
    console.log(`  ${String(n).padStart(2)} video(s)  ${label}${reason ? `  (${reason})` : ""}`);
  }

  console.log(
    write
      ? `\nDone. ${dated} video(s) now carry a promised date.\n`
      : `\nNothing written. Re-run with --write to apply.\n`,
  );
}

void main();
