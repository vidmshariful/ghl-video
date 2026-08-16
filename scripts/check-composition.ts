/*
 * Composition drift check: does what the DATABASE says is inside each pack and
 * bundle still match what the CODE renders on the site?
 *
 * Phase 1 of the one-catalog rebuild puts pack contents in the database while
 * the site still renders from code. Until phase 2 switches the readers over,
 * the two must agree, and this is what proves it. Exit 1 on any mismatch.
 *
 *   npm run check:composition
 *
 * Once the screens read from the database this check inverts: it becomes the
 * guard that the code fallbacks have not gone stale. Keep it either way.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { premadePacks } from "@/lib/content/premade";
import { bundleCategories, videoStack } from "@/lib/content/catalog-extra";
import { salesBundles } from "@/lib/bundles";
import { skuFor } from "@/lib/content/codes";

const env: Record<string, string> = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const problems: string[] = [];

async function main() {
  const [{ data: items }, { data: rules }] = await Promise.all([
    db.from("catalog_pack_items").select("pack_code, item_code"),
    db.from("catalog_bundle_rules").select("bundle_code, label, count"),
  ]);

  const packCount = new Map<string, number>();
  for (const i of items ?? []) packCount.set(i.pack_code, (packCount.get(i.pack_code) ?? 0) + 1);
  const ruleCount = new Map<string, number>();
  const ruleSum = new Map<string, number>();
  for (const r of rules ?? []) {
    ruleCount.set(r.bundle_code, (ruleCount.get(r.bundle_code) ?? 0) + 1);
    ruleSum.set(r.bundle_code, (ruleSum.get(r.bundle_code) ?? 0) + r.count);
  }

  /* 1. every fixed pack holds as many videos as the offer advertises */
  for (const pack of premadePacks) {
    const code = skuFor(pack.slug);
    const inDb = packCount.get(code) ?? 0;
    if (pack.count != null && inDb !== pack.count) {
      problems.push(`${code}: sells ${pack.count} videos, database holds ${inDb}`);
    }
  }

  /* 2. the sales-LP bundles: fixed ones by member count, pick ones by rule sum */
  for (const b of salesBundles) {
    if (b.pickAtIntake) {
      const sum = ruleSum.get(b.sku) ?? 0;
      if (sum !== b.videoCount) {
        problems.push(`${b.sku}: picks ${b.videoCount} videos, rules add to ${sum}`);
      }
    } else {
      const inDb = packCount.get(b.sku) ?? 0;
      if (inDb !== b.videoCount) {
        problems.push(`${b.sku}: includes ${b.videoCount} videos, database holds ${inDb}`);
      }
    }
  }

  /* 3. every website bundle kept all of its advertised lines */
  for (const cat of bundleCategories) {
    for (const t of cat.tiers) {
      const code = skuFor(t.slug);
      const inDb = ruleCount.get(code) ?? 0;
      if (inDb !== t.items.length) {
        problems.push(`${code}: advertises ${t.items.length} lines, database holds ${inDb}`);
      }
    }
  }

  /* 4. the stack kept its format lines */
  const stackCode = skuFor(videoStack.sku);
  const stackRules = ruleCount.get(stackCode) ?? 0;
  if (stackRules !== videoStack.formats.length) {
    problems.push(
      `${stackCode}: advertises ${videoStack.formats.length} format lines, database holds ${stackRules}`,
    );
  }

  /* 5. no member points at a catalog code that does not exist */
  const { data: catalog } = await db.from("catalog").select("code");
  const known = new Set((catalog ?? []).map((c) => c.code));
  for (const i of items ?? []) {
    if (!known.has(i.item_code)) {
      problems.push(`${i.pack_code}: member ${i.item_code} is not in the catalog`);
    }
  }

  if (problems.length) {
    console.error(`Composition drift, ${problems.length} problem(s):\n`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log(
    `OK: ${packCount.size} packs and ${ruleCount.size} bundles in the database match the code.`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
