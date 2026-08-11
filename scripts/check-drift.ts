/*
 * Code <-> database drift check.
 *
 * Fails (exit 1) when the price/composition a page shows in CODE disagrees
 * with the `products` row that CHECKOUT actually charges. This is the guard for
 * the two money surfaces the build-time gate cannot see (they live in the DB):
 *
 *   1. One-time sellable products  (code priceCents == products.price_cents)
 *   2. The sales-LP bundles lp-*   (price + video_count + delivery_days + anchor)
 *
 * Subscriptions are excluded (their price lives in Stripe, set by hand).
 *
 * Run:  npm run check:drift      (needs .env.local with the service-role key)
 * Use it after any price/bundle edit, before/after a deploy, or in CI.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { oneTimeSellableProducts } from "@/lib/site";
import { salesBundles } from "@/lib/sales/pages";

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

type ProductRow = {
  sku: string;
  price_cents: number;
  active: boolean;
  metadata: Record<string, unknown> | null;
};

const problems: string[] = [];
const warnings: string[] = [];
const dollars = (cents: number) => `$${(cents / 100).toLocaleString("en-US")}`;

const allSkus = [
  ...new Set([...oneTimeSellableProducts.map((p) => p.sku), ...salesBundles.map((b) => b.sku)]),
];

async function main() {
const { data, error } = await db
  .from("products")
  .select("sku, price_cents, active, metadata")
  .in("sku", allSkus);
if (error) {
  console.error("products read failed:", error.message);
  process.exit(2);
}
const bySku = new Map<string, ProductRow>((data as ProductRow[]).map((r) => [r.sku, r]));

// 1) One-time sellables: the product must exist and its price must match code.
const inactiveOneTime: string[] = [];
for (const p of oneTimeSellableProducts) {
  const row = bySku.get(p.sku);
  if (!row) {
    problems.push(`MISSING product for "${p.sku}" (${p.name}). Run admin > Products > "Sync from catalog".`);
    continue;
  }
  if (row.price_cents !== p.priceCents) {
    problems.push(
      `PRICE DRIFT "${p.sku}": code ${dollars(p.priceCents)} vs DB ${dollars(row.price_cents)}. Run "Sync from catalog".`,
    );
  }
  // Inactive one-time products are an admin kill-switch decision, not drift, so
  // this is a single informational line, not a per-product warning.
  if (!row.active) inactiveOneTime.push(p.sku);
}
if (inactiveOneTime.length) {
  warnings.push(`${inactiveOneTime.length} one-time product(s) inactive (buy button off): ${inactiveOneTime.join(", ")}`);
}

// 2) Sales-LP bundles: must exist, be active, and match price + composition.
for (const b of salesBundles) {
  const row = bySku.get(b.sku);
  if (!row) {
    problems.push(`MISSING bundle product "${b.sku}": the LP "Order Now" will 404. Create the product row.`);
    continue;
  }
  if (!row.active) problems.push(`INACTIVE bundle "${b.sku}": the LP shows it but checkout is off.`);
  if (row.price_cents !== b.price * 100) {
    problems.push(`PRICE DRIFT bundle "${b.sku}": code $${b.price} vs DB ${dollars(row.price_cents)}.`);
  }
  const m = row.metadata ?? {};
  if (Number(m.video_count) !== b.videoCount) {
    problems.push(`COUNT DRIFT bundle "${b.sku}": code videoCount ${b.videoCount} vs DB ${m.video_count}.`);
  }
  if (Number(m.delivery_days) !== b.deliveryDays) {
    problems.push(`DELIVERY DRIFT bundle "${b.sku}": code ${b.deliveryDays} vs DB ${m.delivery_days}.`);
  }
  if (Number(m.anchor_cents) !== b.anchorPrice * 100) {
    problems.push(`ANCHOR DRIFT bundle "${b.sku}": code $${b.anchorPrice} vs DB ${dollars(Number(m.anchor_cents) || 0)}.`);
  }
}

// --- report ---
console.log(
  `\nChecked ${oneTimeSellableProducts.length} one-time products + ${salesBundles.length} bundles against the database.\n`,
);
if (warnings.length) {
  console.log(`${warnings.length} warning(s):`);
  for (const w of warnings) console.log("  - " + w);
  console.log("");
}
if (problems.length) {
  console.log(`FOUND ${problems.length} DRIFT PROBLEM(S):`);
  for (const p of problems) console.log("  x " + p);
  console.log("");
  process.exit(1);
}
console.log("OK: every code price and bundle composition matches the database.\n");
process.exit(0);
}

void main();
