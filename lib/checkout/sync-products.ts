import type { SupabaseClient } from "@supabase/supabase-js";
// Relative (not "@/lib/site") on purpose: this module is imported both by
// the admin route (inside Next) and by the one-off seed script run through
// tsx (outside Next, where the "@/" alias is not resolved). lib/site has no
// imports of its own, so it is safe to pull into either context.
import { oneTimeSellableProducts } from "../site";

export type SyncResult = {
  total: number;
  inserted: number;
  updated: number;
  unchanged: number;
  insertedSkus: string[];
  updatedSkus: { sku: string; fromCents: number; toCents: number }[];
};

/*
 * Sync the products table from the one sellable-catalog source (lib/site.ts).
 * The catalog is the price authority: existing catalog rows get their name,
 * description, type, price and metadata updated to match it, so the price a
 * marketing page displays can never drift from the price checkout charges.
 *
 * Admin-owned state is never touched: `active` (the kill switch) and
 * `currency` are omitted from the upsert, and rows that exist only in the DB
 * (hand-created products, hand-seeded subscriptions) are never modified or
 * removed.
 *
 * Subscriptions are excluded here (they carry a Stripe price id set by hand),
 * so this only ever creates or updates one-time video and pack products.
 */
export async function syncProductsFromCatalog(
  db: SupabaseClient,
): Promise<SyncResult> {
  const catalog = oneTimeSellableProducts;
  const skus = catalog.map((p) => p.sku);

  // Read what exists so the result can say exactly what changed.
  const { data: existing, error: readErr } = await db
    .from("products")
    .select("sku, name, description, price_cents")
    .in("sku", skus);
  if (readErr) throw new Error(`products read failed: ${readErr.message}`);
  type Row = { sku: string; name: string; description: string | null; price_cents: number };
  const have = new Map<string, Row>(((existing ?? []) as Row[]).map((r) => [r.sku, r]));

  const insertedSkus = skus.filter((s) => !have.has(s));
  const updatedSkus = catalog
    .filter((p) => {
      const row = have.get(p.sku);
      return (
        row &&
        (row.price_cents !== p.priceCents ||
          row.name !== p.name ||
          (row.description ?? null) !== (p.description ?? null))
      );
    })
    .map((p) => ({
      sku: p.sku,
      fromCents: have.get(p.sku)!.price_cents,
      toCents: p.priceCents,
    }));

  // Upsert with update-on-conflict: new SKUs are inserted (taking the column
  // defaults for active/currency), existing catalog SKUs are updated to the
  // catalog's values. Race-safe: a row created between the read and here is
  // updated rather than duplicated.
  const rows = catalog.map((p) => ({
    sku: p.sku,
    name: p.name,
    description: p.description,
    type: p.type,
    price_cents: p.priceCents,
    metadata: p.metadata,
  }));
  const { error: upErr } = await db
    .from("products")
    .upsert(rows, { onConflict: "sku" });
  if (upErr) throw new Error(`products upsert failed: ${upErr.message}`);

  return {
    total: catalog.length,
    inserted: insertedSkus.length,
    updated: updatedSkus.length,
    unchanged: catalog.length - insertedSkus.length - updatedSkus.length,
    insertedSkus,
    updatedSkus,
  };
}
