/*
 * Seed what is INSIDE each pack and bundle, from the code that renders the
 * site today into the tables added by migration 0037.
 *
 * Phase 1 of the one-catalog rebuild. Nothing reads these tables yet, so this
 * is safe to run repeatedly: it is idempotent (delete + reinsert per pack), it
 * never touches prices, and it never touches the products table that checkout
 * charges from.
 *
 *   npm run seed:composition            write it
 *   npm run seed:composition -- --dry   show what it would write
 *
 * Members are resolved against the CATALOG TABLE by title, not against the
 * code's product-code map. The catalog is the newer source of truth for
 * videos and already carries the two AI-pack videos that are still in
 * production (fexp-036, fexp-037); the code map has no entry for those, so
 * matching on code alone silently produced a seven video pack that we sell
 * as nine.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { premadePacks, premadeVideos } from "@/lib/content/premade";
import { bundleCategories, videoStack } from "@/lib/content/catalog-extra";
import { salesBundles, bundlePickPools, PICK_LABEL, type BundlePickKey } from "@/lib/bundles";
import { codeFor, skuFor } from "@/lib/content/codes";

const DRY = process.argv.includes("--dry");

const env: Record<string, string> = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type PackItem = { pack_code: string; item_code: string; group_label: string | null; sort: number };
type BundleRule = {
  bundle_code: string;
  label: string;
  category: string | null;
  library: string | null;
  count: number;
  sort: number;
};

async function main() {
  const { data: catalog, error } = await db.from("catalog").select("code, title");
  if (error) throw new Error(`catalog read: ${error.message}`);
  const byTitle = new Map((catalog ?? []).map((c) => [c.title.trim().toLowerCase(), c.code]));

  const packItems: PackItem[] = [];
  const bundleRules: BundleRule[] = [];
  const unresolved: string[] = [];

  /** catalog code for a video, by exact title, falling back to the code map */
  const resolve = (title: string, slug?: string): string | null => {
    const hit = byTitle.get(title.trim().toLowerCase());
    if (hit) return hit;
    if (slug && codeFor(slug)) return skuFor(slug);
    unresolved.push(title);
    return null;
  };

  /* ---- fixed packs: the premade packs list their videos by name ---- */
  const bySlugTitle = new Map(premadeVideos.map((v) => [v.title, v]));
  for (const pack of premadePacks) {
    const packCode = skuFor(pack.slug);
    let sort = 0;
    for (const cat of pack.categories) {
      for (const v of cat.videos) {
        const code = resolve(v.title, bySlugTitle.get(v.title)?.slug);
        if (!code) continue;
        packItems.push({ pack_code: packCode, item_code: code, group_label: cat.name, sort: sort++ });
      }
    }
  }

  /* ---- the sales-LP Ultimate bundle is fixed: every video in the pool ---- */
  const pools = bundlePickPools();
  for (const b of salesBundles) {
    if (b.pickAtIntake) continue;
    let sort = 0;
    for (const key of Object.keys(pools) as BundlePickKey[]) {
      for (const v of pools[key]) {
        const code = resolve(v.title, v.slug);
        if (!code) continue;
        packItems.push({
          pack_code: b.sku,
          item_code: code,
          group_label: PICK_LABEL[key],
          sort: sort++,
        });
      }
    }
  }

  /* ---- pick-at-intake bundles: the LP tiers carry explicit counts ---- */
  for (const b of salesBundles) {
    if (!b.pickAtIntake || !b.pick) continue;
    let sort = 0;
    for (const key of Object.keys(b.pick) as BundlePickKey[]) {
      const count = b.pick[key] ?? 0;
      if (count === 0) continue;
      bundleRules.push({
        bundle_code: b.sku,
        label: `${count}x ${PICK_LABEL[key]}`,
        category: PICK_LABEL[key],
        library: "any",
        count,
        sort: sort++,
      });
    }
  }

  /* ---- the eight website bundles: their advertised lines ---- */
  for (const cat of bundleCategories) {
    for (const t of cat.tiers) {
      const code = skuFor(t.slug);
      t.items.forEach((item, i) => {
        // "4x Explainer" or "All 6x Explainer" -> a count and a category
        const m = item.label.match(/^(?:All\s+)?(\d+)\s*[x×]\s*(.+)$/i);
        bundleRules.push({
          bundle_code: code,
          label: item.label,
          category: (m ? m[2] : item.label).trim(),
          library: item.library === "New Library" ? "new" : "classic",
          count: m ? Number(m[1]) : 1,
          sort: i,
        });
      });
    }
  }

  /* ---- the Complete Video Stack: counts per format ---- */
  videoStack.formats.forEach((f, i) => {
    bundleRules.push({
      bundle_code: skuFor(videoStack.sku),
      label: `${f.count}x ${f.name}`,
      category: f.sampleType,
      library: "any",
      count: f.count,
      sort: i,
    });
  });

  const packCodes = [...new Set(packItems.map((p) => p.pack_code))];
  const bundleCodes = [...new Set(bundleRules.map((b) => b.bundle_code))];

  console.log(`fixed packs      ${packCodes.length}  (${packItems.length} member videos)`);
  for (const c of packCodes) {
    const items = packItems.filter((p) => p.pack_code === c);
    console.log(`   ${c.padEnd(16)} ${items.length} videos`);
  }
  console.log(`\npick bundles     ${bundleCodes.length}  (${bundleRules.length} rules)`);
  for (const c of bundleCodes) {
    const rs = bundleRules.filter((b) => b.bundle_code === c);
    console.log(`   ${c.padEnd(16)} ${rs.map((r) => r.label).join(", ")}`);
  }
  if (unresolved.length) {
    console.log(`\nNOT MATCHED to a catalog row (${unresolved.length}):`);
    for (const t of [...new Set(unresolved)]) console.log(`   ${t}`);
  }

  if (DRY) {
    console.log("\nDry run, nothing written.");
    return;
  }

  await db.from("catalog_pack_items").delete().in("pack_code", packCodes);
  const { error: e1 } = await db.from("catalog_pack_items").insert(packItems);
  if (e1) throw new Error(`pack items: ${e1.message}`);

  await db.from("catalog_bundle_rules").delete().in("bundle_code", bundleCodes);
  const { error: e2 } = await db.from("catalog_bundle_rules").insert(bundleRules);
  if (e2) throw new Error(`bundle rules: ${e2.message}`);

  for (const c of packCodes) await db.from("catalog").update({ kind: "pack" }).eq("code", c);
  for (const c of bundleCodes) await db.from("catalog").update({ kind: "bundle" }).eq("code", c);

  console.log("\nWritten. Verify with: npm run check:composition");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
