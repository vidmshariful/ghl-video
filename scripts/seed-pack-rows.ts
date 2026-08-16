/*
 * Phase 2 backfill: give every pack and bundle a CATALOG row.
 *
 * Until now they existed only in the products table (what checkout charges),
 * which is why the admin had a video list in one place and a product list in
 * another. After this, one catalog holds all three shapes and the new Products
 * screen can list them from a single source.
 *
 * Reads price and name from the products table so nothing can disagree with
 * what checkout charges, and pulls tagline, delivery and anchor price from the
 * code that renders the offer.
 *
 *   npm run seed:pack-rows          write
 *   npm run seed:pack-rows -- --dry preview
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { premadePacks } from "@/lib/content/premade";
import { bundleCategories, videoStack } from "@/lib/content/catalog-extra";
import { salesBundles } from "@/lib/bundles";
import { skuFor } from "@/lib/content/codes";

const DRY = process.argv.includes("--dry");

const env: Record<string, string> = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/* what the offer says, keyed by sku */
const extras = new Map<string, { tagline?: string; anchor?: number; days?: number }>();
for (const p of premadePacks) {
  extras.set(skuFor(p.slug), { tagline: p.tagline, anchor: (p.anchorPrice ?? 0) * 100 || undefined });
}
extras.set(skuFor(videoStack.sku), {
  tagline: videoStack.tagline,
  anchor: videoStack.anchorPrice * 100,
  days: videoStack.deliveryDays,
});
for (const c of bundleCategories) {
  for (const t of c.tiers) {
    extras.set(skuFor(t.slug), { anchor: t.anchorPrice * 100, days: t.deliveryDays });
  }
}
for (const b of salesBundles) {
  extras.set(b.sku, { anchor: b.anchorPrice * 100, days: b.deliveryDays });
}

/* which skus are fixed packs vs pick-later bundles, decided by phase 1's data */
async function main() {
  const [{ data: products }, { data: catalog }, { data: packItems }, { data: rules }] =
    await Promise.all([
      db.from("products").select("sku, name, description, price_cents, active, metadata"),
      db.from("catalog").select("code"),
      db.from("catalog_pack_items").select("pack_code"),
      db.from("catalog_bundle_rules").select("bundle_code"),
    ]);

  const have = new Set((catalog ?? []).map((c) => c.code));
  const fixed = new Set((packItems ?? []).map((p) => p.pack_code));
  const picky = new Set((rules ?? []).map((r) => r.bundle_code));

  const rows: Record<string, unknown>[] = [];
  for (const p of products ?? []) {
    const kindMeta = (p.metadata as { kind?: string } | null)?.kind;
    if (kindMeta !== "pack" && kindMeta !== "bundle") continue;
    if (have.has(p.sku)) continue; // already a catalog row (the FA packs)

    const isFixed = fixed.has(p.sku);
    const isPicky = picky.has(p.sku);
    // something with neither members nor rules is a legacy inactive row; skip
    if (!isFixed && !isPicky) continue;

    const x = extras.get(p.sku) ?? {};
    rows.push({
      code: p.sku,
      title: p.name,
      kind: isFixed ? "pack" : "bundle",
      category: null,
      price_cents: p.price_cents,
      tagline: x.tagline ?? p.description ?? null,
      anchor_price_cents: x.anchor ?? null,
      delivery_days: x.days ?? null,
      on_site: p.active,
      sellable_alone: true,
      library: "new",
    });
  }

  console.log(`catalog rows to create: ${rows.length}`);
  for (const r of rows) {
    console.log(
      `   ${String(r.code).padEnd(16)} ${String(r.kind).padEnd(7)} $${(Number(r.price_cents) / 100).toLocaleString()}  ${r.title}`,
    );
  }
  const skipped = (products ?? []).filter((p) => {
    const k = (p.metadata as { kind?: string } | null)?.kind;
    return (k === "pack" || k === "bundle") && !fixed.has(p.sku) && !picky.has(p.sku) && !have.has(p.sku);
  });
  if (skipped.length) {
    console.log(`\nskipped, no contents defined (legacy rows):`);
    for (const s of skipped) console.log(`   ${s.sku}${s.active ? "" : "  [inactive]"}`);
  }

  if (DRY) {
    console.log("\nDry run, nothing written.");
    return;
  }
  if (rows.length) {
    const { error } = await db.from("catalog").insert(rows);
    if (error) throw new Error(error.message);
  }
  console.log("\nWritten. Verify with: npm run check:composition");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
