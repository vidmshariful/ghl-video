/*
 * Pure order-bump scope matching, shared by the server checkout path
 * (lib/checkout/bumps.ts) and the admin Videos screen, which shows which
 * bumps a product will surface at checkout. No server-only imports here:
 * the admin client evaluates the same rules against rows it reads under
 * RLS, so the preview can never drift from what checkout actually offers.
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

/* The slice of a product the rules need (products row or catalog-derived). */
export type BumpTarget = {
  sku: string;
  metadata: Record<string, unknown> | null;
};

export function bumpPrefixOf(p: BumpTarget): string {
  const code = (p.metadata?.code as string | undefined) ?? p.sku;
  return code.split("-")[0].toUpperCase();
}

export function bumpAppliesTo(bump: OrderBump, p: BumpTarget): boolean {
  if (!bump.active) return false;
  const kind = p.metadata?.kind as string | undefined;
  switch (bump.scope) {
    case "all":
      return true;
    case "kinds":
      return !!kind && bump.scope_values.includes(kind);
    case "prefixes":
      return bump.scope_values.includes(bumpPrefixOf(p));
    case "skus":
      return bump.scope_values.includes(p.sku);
    default:
      return false;
  }
}

/** Effective price of a bump for a product: flat, or per-video times the
 *  product's video_count (a single video counts as one). */
export function bumpEffectivePrice(bump: OrderBump, p: BumpTarget): number {
  if (bump.unit !== "per_video") return bump.price_cents;
  const count = Number(p.metadata?.video_count) || 1;
  return bump.price_cents * count;
}
