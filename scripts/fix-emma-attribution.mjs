/*
 * One-off: three review notes on the Ask AI cut were written by Emma but
 * stamped with the account owner's name, because every client write path
 * used to sign itself with the owner's customer row. The code is fixed;
 * this corrects the rows that were already written.
 *
 * It refuses to run unless portal_activity proves Emma was the only person
 * signed into the account across the window those notes were written in.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
}
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const ACCOUNT = "chase@gohighlevel.com";
const EMMA = "emma.jackson@gohighlevel.com";
const FROM = "2026-08-27T15:20:00Z";
const TO = "2026-08-27T15:35:00Z";

const { data: acts } = await db
  .from("portal_activity")
  .select("actor_email")
  .eq("account_email", ACCOUNT)
  .gte("at", FROM)
  .lte("at", TO);
const actors = [...new Set((acts ?? []).map((a) => a.actor_email))];
console.log("actors signed in across the window:", actors);
if (actors.length !== 1 || actors[0] !== EMMA) {
  console.log("REFUSING: the window is not unambiguously Emma's.");
  process.exit(1);
}

const { data: rows } = await db
  .from("deliverable_comments")
  .select("id, author_email, author_name, body, created_at")
  .eq("author_side", "client")
  .eq("author_email", ACCOUNT)
  .gte("created_at", FROM)
  .lte("created_at", TO)
  .order("created_at");

console.log(`\n${rows.length} rows to correct:`);
for (const r of rows) {
  console.log(`  ${r.created_at}  ${r.author_name} -> ${JSON.stringify(String(r.body).slice(0, 60))}`);
}

const ids = rows.map((r) => r.id);
const { error } = await db
  .from("deliverable_comments")
  .update({ author_email: EMMA, author_name: "Emma Jackson" })
  .in("id", ids);
if (error) {
  console.log("FAILED:", error.message);
  process.exit(1);
}

const { data: after } = await db
  .from("deliverable_comments")
  .select("id, author_email, author_name, created_at")
  .in("id", ids)
  .order("created_at");
console.log("\nafter:");
for (const r of after) console.log(`  ${r.created_at}  ${r.author_name}  <${r.author_email}>`);

const { count } = await db
  .from("deliverable_comments")
  .select("id", { count: "exact", head: true })
  .eq("author_side", "client")
  .eq("author_email", ACCOUNT);
console.log(`\nclient comments still attributed to the owner: ${count}`);
