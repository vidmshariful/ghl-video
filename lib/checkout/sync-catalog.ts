import type { SupabaseClient } from "@supabase/supabase-js";

export type CatalogSyncResult = {
  total: number;
  active: number;
  hidden: number;
  retired: number;
};

/* the video-code namespace the catalog owns. Packs (pack-*), bundles, editing
 * subscriptions (editing-*), and bumps live outside it and are never touched. */
const VIDEO_CODE = /^(exp|fexp|demo|mkt|fa)-\d+$/;

type CatalogSrc = {
  code: string;
  title: string;
  subject: string | null;
  category: string;
  price_cents: number;
  on_site: boolean;
  coming_soon: boolean;
};

/*
 * Publish the admin-managed `catalog` table into `products` (the table checkout
 * charges from), so an edit in the Catalog screen actually reaches checkout.
 *
 * This is the bridge the migration needs: the marketing library reads `catalog`,
 * but checkout reads `products`, and without this they only agree by luck. Every
 * catalog row is upserted by its code, and `active` is driven by the catalog:
 * a hidden (on_site=false) or still-in-production (coming_soon) video is set
 * inactive, so it stops being buyable by direct link. Idempotent (upsert on sku).
 *
 * Only touches catalog-coded video/pack rows (exp-/fexp-/demo-/mkt-/fa-*); the
 * hand-seeded packs, bundles, and subscriptions carry other skus and are never
 * matched, so they are left alone.
 */
export async function syncProductsFromCatalogTable(
  db: SupabaseClient,
): Promise<CatalogSyncResult> {
  const { data, error } = await db
    .from("catalog")
    .select("code,title,subject,category,price_cents,on_site,coming_soon");
  if (error) throw new Error(`catalog read failed: ${error.message}`);

  const src = (data ?? []) as CatalogSrc[];
  const rows = src.map((c) => ({
    sku: c.code,
    name: c.title,
    description: c.subject ? `${c.category}. ${c.subject}.` : `${c.category}.`,
    type: "one_time" as const,
    price_cents: c.price_cents,
    // the catalog owns buyability: hidden or in-production videos go inactive
    active: Boolean(c.on_site) && !c.coming_soon,
    metadata: {
      code: c.code.toUpperCase(),
      kind: c.category === "Feature Animation" ? "pack" : "video",
      category: c.category,
      subject: c.subject ?? null,
      video_type: c.category,
    },
  }));

  const { error: upErr } = await db
    .from("products")
    .upsert(rows, { onConflict: "sku" });
  if (upErr) throw new Error(`products upsert failed: ${upErr.message}`);

  // Retire any video-code product that is no longer a current catalog code:
  // catalog deletes, and superseded codes from the renumber (e.g. exp-005..008).
  // Old links keep working through the checkout old_code -> code redirect.
  const currentCodes = new Set(src.map((c) => c.code));
  const { data: liveRows } = await db
    .from("products")
    .select("sku")
    .eq("active", true);
  const toRetire = ((liveRows ?? []) as { sku: string }[])
    .map((r) => r.sku)
    .filter((s) => VIDEO_CODE.test(s) && !currentCodes.has(s));
  if (toRetire.length) {
    await db.from("products").update({ active: false }).in("sku", toRetire);
  }

  const active = rows.filter((r) => r.active).length;
  return { total: rows.length, active, hidden: rows.length - active, retired: toRetire.length };
}
