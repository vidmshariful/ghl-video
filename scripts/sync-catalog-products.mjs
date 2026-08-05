/*
 * Phase 3, step 1: mirror the `catalog` table into `products` (the checkout
 * truth) so every NEW code is checkout-able. REST only (no direct DB needed).
 *
 * Skips the two REUSED codes (exp-001/exp-002) so the live master/pitch
 * checkout is not disturbed before the site render flips; those flip in the
 * deploy that switches the render. Never touches `active` (kill switch) or
 * hand-created rows. Idempotent (upsert on sku).
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

const dot = {};
const envPath = new URL("../.env.local", import.meta.url);
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    dot[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}
const env = (k) => dot[k] ?? process.env[k];
const sb = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

// The two REUSED codes (exp-001/exp-002) are skipped by default so the live
// master/pitch checkout is untouched before the site render flips. Pass
// --include-reused to flip them to the classics AT the render deploy.
const SKIP = process.argv.includes("--include-reused")
  ? new Set()
  : new Set(["exp-001", "exp-002"]);

const { data: cat, error: readErr } = await sb.from("catalog").select("*").order("code");
if (readErr) {
  console.error("catalog read failed:", readErr.message);
  process.exit(1);
}

const rows = cat
  .filter((c) => !SKIP.has(c.code))
  .map((c) => ({
    sku: c.code,
    name: c.title,
    description: c.subject ? `${c.category}. ${c.subject}.` : `${c.category}.`,
    type: "one_time",
    price_cents: c.price_cents,
    metadata: {
      code: c.code.toUpperCase(),
      kind: c.category === "Feature Animation" ? "pack" : "video",
      category: c.category,
      subject: c.subject ?? null,
      video_type: c.category,
    },
  }));

const { error: upErr } = await sb.from("products").upsert(rows, { onConflict: "sku" });
if (upErr) {
  console.error("upsert failed:", upErr.message);
  process.exit(1);
}
console.log(`Synced ${rows.length} catalog rows into products (skipped ${SKIP.size} reused: ${[...SKIP].join(", ")}).`);
