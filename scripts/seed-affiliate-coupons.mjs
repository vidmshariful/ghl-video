/*
 * Seed the Stripe coupons behind our affiliate discounts. Each affiliate in
 * lib/affiliates.ts points at a stripeCouponId; this creates that coupon in
 * Stripe (idempotently, by fixed id) so /api/checkout/create-subscription can
 * apply it. A subscription started with an affiliate ref fails on the coupon
 * until this has run.
 *
 * Stripe coupons are immutable, so this only ever CREATES. If a coupon with the
 * id already exists it is left as-is and its terms are checked against the
 * config: a mismatch is a loud warning (to change terms, point the affiliate at
 * a NEW id in lib/affiliates.ts and re-run this).
 *
 * Run locally (test key from .env.local):   node scripts/seed-affiliate-coupons.mjs
 * Run for production: set a live STRIPE_SECRET_KEY in the environment, same command.
 *
 * COUPONS MIRRORS lib/affiliates.ts (ref -> {stripeCouponId, discountPercent,
 * discountMonths}). Keep the two in sync: add a partner in both places.
 */
import Stripe from "stripe";
import { existsSync, readFileSync } from "node:fs";

// dev convenience: load .env.local if present; production sets real env vars.
const dotenv = {};
const envPath = new URL("../.env.local", import.meta.url);
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    dotenv[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}
const env = (k) => dotenv[k] ?? process.env[k];

const STRIPE_KEY = env("STRIPE_SECRET_KEY");
if (!STRIPE_KEY) {
  console.error("Missing STRIPE_SECRET_KEY");
  process.exit(1);
}
console.log(`Mode: ${STRIPE_KEY.startsWith("sk_live") ? "LIVE" : "TEST"}  (${STRIPE_KEY.slice(0, 8)}…)`);

const stripe = new Stripe(STRIPE_KEY);

// MIRROR of lib/affiliates.ts. The app reads that file; this seeds Stripe.
const COUPONS = [
  { id: "aff_jonah_10pct_3mo", name: "Friend of Jonah (10% off first 3 months)", percentOff: 10, months: 3 },
];

for (const c of COUPONS) {
  let existing = null;
  try {
    existing = await stripe.coupons.retrieve(c.id);
  } catch {
    // not found -> create below
  }

  if (existing) {
    const matches =
      existing.percent_off === c.percentOff &&
      existing.duration === "repeating" &&
      existing.duration_in_months === c.months;
    if (matches) {
      console.log(`  ${c.id}: already exists and matches, skipping`);
    } else {
      console.warn(
        `  ${c.id}: EXISTS but terms differ (Stripe: ${existing.percent_off}% ` +
          `${existing.duration}/${existing.duration_in_months ?? "-"}mo vs config ` +
          `${c.percentOff}% repeating/${c.months}mo). Stripe coupons are immutable: ` +
          `point the affiliate at a NEW id in lib/affiliates.ts to change terms.`,
      );
    }
    continue;
  }

  const created = await stripe.coupons.create({
    id: c.id,
    percent_off: c.percentOff,
    duration: "repeating",
    duration_in_months: c.months,
    name: c.name,
  });
  console.log(`  ${c.id}: created (${created.percent_off}% off, ${created.duration_in_months} mo)`);
}

console.log("Done. Affiliate coupons are seeded.");
