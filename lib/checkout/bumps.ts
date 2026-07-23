import "server-only";
import { supabaseAdmin } from "./supabase-admin";
import type { Product } from "./products";

/*
 * Order bumps: admin-configurable checkout add-ons. The server is the price
 * authority here just like for products: the checkout shows the applicable
 * bumps, but create-intent re-derives every effective price and the total
 * from this table, so a tampered client can never change what is charged.
 */
export type OrderBump = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  unit: "flat" | "per_video";
  scope: "all" | "kinds" | "prefixes" | "skus";
  scope_values: string[];
  active: boolean;
  sort: number;
};

/** A bump resolved for a specific product: its effective price for that item. */
export type ApplicableBump = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
};

function prefixOf(p: Product): string {
  const code = (p.metadata?.code as string | undefined) ?? p.sku;
  return code.split("-")[0].toUpperCase();
}

function appliesTo(bump: OrderBump, p: Product): boolean {
  if (!bump.active) return false;
  const kind = p.metadata?.kind as string | undefined;
  switch (bump.scope) {
    case "all":
      return true;
    case "kinds":
      return !!kind && bump.scope_values.includes(kind);
    case "prefixes":
      return bump.scope_values.includes(prefixOf(p));
    case "skus":
      return bump.scope_values.includes(p.sku);
    default:
      return false;
  }
}

/** Effective price of a bump for a product: flat, or per-video times the
 *  product's video_count (a single video counts as one). */
function effectivePrice(bump: OrderBump, p: Product): number {
  if (bump.unit !== "per_video") return bump.price_cents;
  const count = Number(p.metadata?.video_count) || 1;
  return bump.price_cents * count;
}

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
    .filter((b) => appliesTo(b, product))
    .map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      priceCents: effectivePrice(b, product),
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
