import type { SupabaseClient } from "@supabase/supabase-js";
// Relative (not "@/lib/site") on purpose: this module is imported both by
// the admin route (inside Next) and by the one-off seed script run through
// tsx (outside Next, where the "@/" alias is not resolved). lib/site has no
// imports of its own, so it is safe to pull into either context.
import { oneTimeSellableProducts } from "../site";

export type SyncResult = {
  total: number;
  inserted: number;
  skipped: number;
  insertedSkus: string[];
};

/*
 * Seed the products table from the one sellable-catalog source. INSERT-ONLY:
 * a sku that already has a row (a curated price, the POC flagship, or a
 * hand-seeded subscription) is left untouched. Ongoing price changes happen
 * in the admin Products screen, which owns the row once it exists. This keeps
 * the catalog (display + routing) and the products table (price authority)
 * in sync without ever clobbering an intentional edit.
 *
 * Subscriptions are excluded here (they carry a Stripe price id set by hand),
 * so this only ever creates one-time video and pack products.
 */
export async function syncProductsFromCatalog(
  db: SupabaseClient,
): Promise<SyncResult> {
  const catalog = oneTimeSellableProducts;
  const skus = catalog.map((p) => p.sku);

  // which skus already exist, so we can report and skip them
  const { data: existing, error: readErr } = await db
    .from("products")
    .select("sku")
    .in("sku", skus);
  if (readErr) throw new Error(`products read failed: ${readErr.message}`);
  const have = new Set((existing ?? []).map((r: { sku: string }) => r.sku));
  const insertedSkus = catalog.map((p) => p.sku).filter((s) => !have.has(s));

  // Upsert the full catalog with ON CONFLICT DO NOTHING: race-safe (a row
  // created between the read and here is simply skipped) and never updates
  // an existing row.
  const rows = catalog.map((p) => ({
    sku: p.sku,
    name: p.name,
    description: p.description,
    type: p.type,
    price_cents: p.priceCents,
    currency: "usd",
    active: true,
    metadata: p.metadata,
  }));
  const { error: upErr } = await db
    .from("products")
    .upsert(rows, { onConflict: "sku", ignoreDuplicates: true });
  if (upErr) throw new Error(`products upsert failed: ${upErr.message}`);

  return {
    total: catalog.length,
    inserted: insertedSkus.length,
    skipped: catalog.length - insertedSkus.length,
    insertedSkus,
  };
}
