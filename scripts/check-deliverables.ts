/*
 * Does the deliverable expansion give every product the number of videos the
 * offer actually promises?
 *
 * This is the phase 3 counterpart to check:composition. That one proves the
 * database agrees with the code about what is inside a pack; this one proves
 * that when somebody BUYS that pack, the studio gets the right number of rows
 * to work through. A silent off-by-one here means a customer is quietly owed a
 * video nobody is building.
 *
 *   npm run check:deliverables
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { planDeliverables } from "@/lib/deliverables";
import { premadePacks } from "@/lib/content/premade";
import { salesBundles } from "@/lib/bundles";
import { bundleCategories, videoStack } from "@/lib/content/catalog-extra";
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

/** expected video count per sku, from the code that renders the offer */
function expectations(): Map<string, number> {
  const want = new Map<string, number>();
  for (const p of premadePacks) if (p.count != null) want.set(skuFor(p.slug), p.count);
  for (const b of salesBundles) want.set(b.sku, b.videoCount);
  for (const c of bundleCategories) {
    for (const t of c.tiers) {
      want.set(
        skuFor(t.slug),
        t.items.reduce((n, i) => {
          const m = i.label.match(/^(?:All\s+)?(\d+)\s*[x×]\s*/i);
          return n + (m ? Number(m[1]) : 1);
        }, 0),
      );
    }
  }
  want.set(
    skuFor(videoStack.sku),
    videoStack.formats.reduce((n, f) => n + f.count, 0),
  );
  return want;
}

async function main() {
  const want = expectations();

  // 1. every pack and bundle expands to the advertised number of videos
  for (const [sku, count] of want) {
    const plans = await planDeliverables(db, sku);
    if (plans.length !== count) {
      problems.push(`${sku}: offer promises ${count} videos, expansion produces ${plans.length}`);
    }
  }

  // 2. a feature animation pack expands to its stated set size
  const { data: fa } = await db
    .from("catalog")
    .select("code, pack_count")
    .eq("category", "Feature Animation");
  for (const p of fa ?? []) {
    const n = (p.pack_count as number | null) ?? 0;
    if (!n) continue;
    const plans = await planDeliverables(db, p.code as string);
    if (plans.length !== n) {
      problems.push(`${p.code}: sold as a set of ${n}, expansion produces ${plans.length}`);
    }
  }

  // 3. a single video expands to exactly one row, and that row is named
  const { data: videos } = await db
    .from("catalog")
    .select("code")
    .eq("kind", "video")
    .limit(400);
  let checked = 0;
  for (const v of videos ?? []) {
    const plans = await planDeliverables(db, v.code as string);
    checked++;
    if (plans.length !== 1) {
      problems.push(`${v.code}: a single video expanded to ${plans.length} rows`);
    } else if (!plans[0].title.trim()) {
      problems.push(`${v.code}: expanded row has no title`);
    }
  }

  // 4. no expansion may produce an unnamed row, ever. A blank title is what a
  //    customer would read on their My Videos card.
  for (const [sku] of want) {
    for (const p of await planDeliverables(db, sku)) {
      if (!p.title.trim()) problems.push(`${sku}: produced a row with no title`);
    }
  }

  if (problems.length) {
    console.error(`Deliverable expansion is wrong, ${problems.length} problem(s):\n`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log(
    `OK: ${want.size} packs and bundles expand to their advertised counts, ${checked} single videos expand to one named row each.`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
