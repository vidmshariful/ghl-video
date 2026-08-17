import type { SupabaseClient } from "@supabase/supabase-js";
import { oneTimeSellableProducts } from "@/lib/site";
import { salesBundles } from "@/lib/bundles";

/*
 * Does what the site says something costs still match what checkout charges?
 *
 * The prices a page shows come from lib/site.ts. The price actually charged
 * comes from the products table, and the two only agree after somebody presses
 * "Sync from catalog" in the admin. That gap is the hazard: change a price,
 * deploy, forget the sync, and the site quietly keeps selling at the old price
 * until a human happens to notice.
 *
 * This is the comparison, with no opinion about who is asking. The CLI
 * (npm run check:drift) prints it, and the scheduled check raises an alarm
 * from it, so a price cannot drift for longer than the gap between runs.
 *
 * Deliberately free of `server-only`: the CLI runs it under tsx, outside Next.
 */

type ProductRow = {
  sku: string;
  price_cents: number;
  active: boolean;
  metadata: Record<string, unknown> | null;
};

export type DriftReport = {
  /* real disagreements: the site and checkout would tell a buyer different things */
  problems: string[];
  /* worth saying, but somebody's deliberate choice rather than a fault */
  warnings: string[];
  checkedProducts: number;
  checkedBundles: number;
};

const dollars = (cents: number) => `$${(cents / 100).toLocaleString("en-US")}`;

export async function findPriceDrift(db: SupabaseClient): Promise<DriftReport> {
  const problems: string[] = [];
  const warnings: string[] = [];

  const allSkus = [
    ...new Set([
      ...oneTimeSellableProducts.map((p) => p.sku),
      ...salesBundles.map((b) => b.sku),
    ]),
  ];

  const { data, error } = await db
    .from("products")
    .select("sku, price_cents, active, metadata")
    .in("sku", allSkus);
  if (error) throw new Error(`products read failed: ${error.message}`);

  const bySku = new Map<string, ProductRow>(
    (data as ProductRow[]).map((r) => [r.sku, r]),
  );

  /* 1) One-time sellables: the row must exist and its price must match code. */
  const inactiveOneTime: string[] = [];
  for (const p of oneTimeSellableProducts) {
    const row = bySku.get(p.sku);
    if (!row) {
      problems.push(
        `MISSING product for "${p.sku}" (${p.name}). Run admin > Products > "Sync from catalog".`,
      );
      continue;
    }
    if (row.price_cents !== p.priceCents) {
      problems.push(
        `PRICE DRIFT "${p.sku}": code ${dollars(p.priceCents)} vs DB ${dollars(row.price_cents)}. Run "Sync from catalog".`,
      );
    }
    /* An inactive one-time product is the admin's kill switch, not drift. */
    if (!row.active) inactiveOneTime.push(p.sku);
  }
  if (inactiveOneTime.length) {
    warnings.push(
      `${inactiveOneTime.length} one-time product(s) inactive (buy button off): ${inactiveOneTime.join(", ")}`,
    );
  }

  /* 2) Sales-LP bundles: exist, be active, and match price + composition. */
  for (const b of salesBundles) {
    const row = bySku.get(b.sku);
    if (!row) {
      problems.push(
        `MISSING bundle product "${b.sku}": the LP "Order Now" will 404. Create the product row.`,
      );
      continue;
    }
    if (!row.active) {
      problems.push(`INACTIVE bundle "${b.sku}": the LP shows it but checkout is off.`);
    }
    if (row.price_cents !== b.price * 100) {
      problems.push(
        `PRICE DRIFT bundle "${b.sku}": code $${b.price} vs DB ${dollars(row.price_cents)}.`,
      );
    }
    const m = row.metadata ?? {};
    if (Number(m.video_count) !== b.videoCount) {
      problems.push(
        `COUNT DRIFT bundle "${b.sku}": code videoCount ${b.videoCount} vs DB ${m.video_count}.`,
      );
    }
    if (Number(m.delivery_days) !== b.deliveryDays) {
      problems.push(
        `DELIVERY DRIFT bundle "${b.sku}": code ${b.deliveryDays} vs DB ${m.delivery_days}.`,
      );
    }
    if (Number(m.anchor_cents) !== b.anchorPrice * 100) {
      problems.push(
        `ANCHOR DRIFT bundle "${b.sku}": code $${b.anchorPrice} vs DB ${dollars(Number(m.anchor_cents) || 0)}.`,
      );
    }
  }

  return {
    problems,
    warnings,
    checkedProducts: oneTimeSellableProducts.length,
    checkedBundles: salesBundles.length,
  };
}
