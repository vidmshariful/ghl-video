/*
 * Seed the email_templates table from the code defaults (lib/email/templates).
 * Idempotent upsert on key; safe to re-run. The send path + admin screen fall
 * back to the code defaults if a row is missing, so this is a convenience.
 *
 * Run: node_modules/.bin/tsx scripts/seed-email-templates.ts
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { DEFAULT_TEMPLATES } from "../lib/email/templates";

const dot: Record<string, string> = {};
const envPath = new URL("../.env.local", import.meta.url);
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    dot[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}
const env = (k: string) => dot[k] ?? process.env[k];
const sb = createClient(env("NEXT_PUBLIC_SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!);

async function main() {
  const rows = DEFAULT_TEMPLATES.map((t) => ({
    key: t.key,
    name: t.name,
    description: t.description,
    subject: t.subject,
    body: t.body,
  }));
  // insert-only: NEVER overwrite a template the team has edited in admin
  const { error } = await sb
    .from("email_templates")
    .upsert(rows, { onConflict: "key", ignoreDuplicates: true });
  if (error) {
    console.error("seed failed:", error.message);
    process.exit(1);
  }
  console.log(`Seeded ${rows.length} email template(s): ${rows.map((r) => r.key).join(", ")}`);
}
main();
