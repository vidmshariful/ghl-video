import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findPriceDrift } from "@/lib/checkout/price-drift";
import { oneTimeSellableProducts } from "@/lib/site";
import { salesBundles } from "@/lib/bundles";

/*
 * Does the drift check actually notice drift?
 *
 * The live store is the only real products table there is, so proving this
 * by editing a price in production and putting it back would risk selling
 * something at the wrong price for as long as the test took. The function
 * takes its database as an argument precisely so it does not have to be:
 * here it is handed rows that disagree on purpose.
 *
 * What this cannot prove is that the real table is shaped the way the stub
 * is. That half is covered by npm run check:drift, which runs the same
 * function against the real database and is how the CLI has always worked.
 */

/** The smallest thing that answers db.from("products").select(...).in(...). */
function stubDb(rows: unknown[]): SupabaseClient {
  const result = Promise.resolve({ data: rows, error: null });
  const builder = {
    select: () => builder,
    in: () => result,
  };
  return { from: () => builder } as unknown as SupabaseClient;
}

/** Every product and bundle, priced exactly as the code says. */
function rowsInAgreement() {
  return [
    ...oneTimeSellableProducts.map((p) => ({
      sku: p.sku,
      price_cents: p.priceCents,
      active: true,
      metadata: {},
    })),
    ...salesBundles.map((b) => ({
      sku: b.sku,
      price_cents: b.price * 100,
      active: true,
      metadata: {
        video_count: b.videoCount,
        delivery_days: b.deliveryDays,
        anchor_cents: b.anchorPrice * 100,
      },
    })),
  ];
}

describe("noticing when the site and checkout disagree", () => {
  test("agreement is silent", async () => {
    const r = await findPriceDrift(stubDb(rowsInAgreement()));
    assert.deepEqual(r.problems, []);
    assert.ok(r.checkedProducts > 0, "should have checked some products");
  });

  test("a price changed in code but never synced is caught", async () => {
    const rows = rowsInAgreement();
    const victim = oneTimeSellableProducts[0];
    const row = rows.find((r) => r.sku === victim.sku)!;
    row.price_cents = victim.priceCents + 10000; // checkout charges $100 more

    const r = await findPriceDrift(stubDb(rows));
    assert.equal(r.problems.length, 1);
    assert.match(r.problems[0], /PRICE DRIFT/);
    assert.match(r.problems[0], new RegExp(victim.sku));
  });

  test("a product that was never synced at all is caught", async () => {
    const victim = oneTimeSellableProducts[0];
    const rows = rowsInAgreement().filter((r) => r.sku !== victim.sku);

    const r = await findPriceDrift(stubDb(rows));
    assert.equal(r.problems.length, 1);
    assert.match(r.problems[0], /MISSING product/);
  });

  test("a bundle whose buy button is switched off is caught", async () => {
    // the landing page keeps selling it while checkout refuses, which is
    // worse than the page being down: the buyer only finds out after clicking
    const rows = rowsInAgreement();
    const row = rows.find((r) => r.sku === salesBundles[0].sku)!;
    row.active = false;

    const r = await findPriceDrift(stubDb(rows));
    assert.equal(r.problems.length, 1);
    assert.match(r.problems[0], /INACTIVE bundle/);
  });

  test("a bundle promising more videos than checkout records is caught", async () => {
    const rows = rowsInAgreement();
    const b = salesBundles[0];
    const row = rows.find((r) => r.sku === b.sku)!;
    row.metadata = { ...row.metadata, video_count: b.videoCount - 1 };

    const r = await findPriceDrift(stubDb(rows));
    assert.equal(r.problems.length, 1);
    assert.match(r.problems[0], /COUNT DRIFT/);
  });

  test("an inactive one-time product is a note, not a fault", async () => {
    // switching a buy button off is the admin's decision. Treating it as drift
    // would mean 29 false alarms on the live catalogue today.
    const rows = rowsInAgreement();
    rows.find((r) => r.sku === oneTimeSellableProducts[0].sku)!.active = false;

    const r = await findPriceDrift(stubDb(rows));
    assert.deepEqual(r.problems, []);
    assert.equal(r.warnings.length, 1);
    assert.match(r.warnings[0], /inactive/);
  });

  test("several drifts are all reported, not just the first", async () => {
    const rows = rowsInAgreement();
    for (const p of oneTimeSellableProducts.slice(0, 3)) {
      rows.find((r) => r.sku === p.sku)!.price_cents = p.priceCents + 1;
    }
    const r = await findPriceDrift(stubDb(rows));
    assert.equal(r.problems.length, 3);
  });
});
