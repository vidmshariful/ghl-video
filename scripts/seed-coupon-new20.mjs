/*
 * Seed / update the NEW20 newsletter coupon in public.coupons.
 *
 * NEW20 = 20% off any one-time product (sku = null), valid through
 * Monday Aug 10 2026, 11:59 PM ET (03:59Z Aug 11). The checkout reads
 * this row server-side (lib/checkout/coupons.ts); valid_until is the real
 * enforcement, so the code is refused after the window even if the
 * on-site promo banner is left on.
 *
 * Idempotent: keyed by the unique `code`. Re-running updates the discount
 * and window but never resets redemption_count. Insert-only for a new
 * code, so it cannot clobber other coupons.
 *
 * Run (uses .env.local, same as seed-editing-subscriptions):
 *   node scripts/seed-coupon-new20.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

// dev convenience: load .env.local if present; production sets real env vars.
const dotenv = {};
const envPath = new URL("../.env.local", import.meta.url);
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    dotenv[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}
const env = (k) => dotenv[k] ?? process.env[k];

const SB_URL = env("NEXT_PUBLIC_SUPABASE_URL");
const SB_SERVICE = env("SUPABASE_SERVICE_ROLE_KEY");
if (!SB_URL || !SB_SERVICE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
console.log(`Supabase: ${SB_URL}`);

const sb = createClient(SB_URL, SB_SERVICE);

const CODE = "NEW20";
const DISCOUNT = {
  percent_off: 20,
  amount_off_cents: null, // exactly one discount kind (DB constraint)
  sku: null, // applies to any one-time product
  valid_from: null,
  valid_until: "2026-08-11T03:59:00Z", // Mon Aug 10 2026, 11:59 PM ET
  active: true,
};

const { data: existing, error: selErr } = await sb
  .from("coupons")
  .select("id, redemption_count")
  .eq("code", CODE)
  .maybeSingle();
if (selErr) {
  console.error("lookup failed:", selErr.message);
  process.exit(1);
}

if (existing) {
  const { error } = await sb.from("coupons").update(DISCOUNT).eq("id", existing.id);
  if (error) {
    console.error("update failed:", error.message);
    process.exit(1);
  }
  console.log(`Updated ${CODE} (kept redemption_count = ${existing.redemption_count}).`);
} else {
  const { error } = await sb.from("coupons").insert({ code: CODE, ...DISCOUNT });
  if (error) {
    console.error("insert failed:", error.message);
    process.exit(1);
  }
  console.log(`Inserted ${CODE}.`);
}

const { data: row } = await sb
  .from("coupons")
  .select("code, percent_off, sku, valid_until, active, redemption_count, max_redemptions")
  .eq("code", CODE)
  .maybeSingle();
console.log("Row now:", JSON.stringify(row));
console.log("Done.");
