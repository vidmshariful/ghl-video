import "server-only";
import { supabaseAdmin } from "./supabase-admin";
import type { Product } from "./products";
import {
  bumpAppliesTo,
  bumpEffectivePrice,
  type OrderBump,
} from "./bump-match";

/*
 * Order bumps: admin-configurable checkout add-ons. The server is the price
 * authority here just like for products: the checkout shows the applicable
 * bumps, but create-intent re-derives every effective price and the total
 * from this table, so a tampered client can never change what is charged.
 * The scope rules themselves live in bump-match.ts (client-safe) so the
 * admin screens can preview them.
 */
export type { OrderBump };

/** A bump resolved for a specific product: its effective price for that item. */
export type ApplicableBump = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
};

/** Active bumps whose scope matches this product, priced for it. */
export async function getApplicableBumps(
  product: Product,
): Promise<ApplicableBump[]> {
  const { data, error } = await supabaseAdmin()
    .from("order_bumps")
    .select("*")
    .eq("active", true)
    .order("sort", { ascending: true });
  if (error) throw new Error(`order_bumps lookup failed: ${error.message}`);
  return (data as OrderBump[])
    .filter((b) => bumpAppliesTo(b, product))
    .map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      priceCents: bumpEffectivePrice(b, product),
    }));
}

/** Validate client-selected bump ids against what is actually applicable to
 *  the product, returning the valid subset and their total (server truth). */
export async function resolveSelectedBumps(
  product: Product,
  ids: string[],
): Promise<{ bumps: ApplicableBump[]; totalCents: number }> {
  const applicable = await getApplicableBumps(product);
  const wanted = new Set(ids);
  const bumps = applicable.filter((b) => wanted.has(b.id));
  const totalCents = bumps.reduce((sum, b) => sum + b.priceCents, 0);
  return { bumps, totalCents };
}
