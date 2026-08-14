/*
 * Seed the 3 editing subscription plans: create (idempotently) a Stripe Product
 * + recurring monthly Price for each, then upsert the matching `products` row
 * with metadata.stripe_price_id so /api/checkout/create-subscription can serve
 * them (they 404 at checkout until this runs).
 *
 * Idempotent: Stripe prices are keyed by lookup_key, so re-running reuses them;
 * an existing products row is never clobbered (only a missing stripe_price_id is
 * backfilled), so a curated price change in the admin survives a re-run.
 *
 * Run locally (test keys from .env.local):   node scripts/seed-editing-subscriptions.mjs
 * Run for production: set STRIPE_SECRET_KEY (live), NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY in the environment, then run the same command.
 *
 * Plan values MIRROR lib/site.ts `editingPlans` — keep them in sync.
 */
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
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
const SB_URL = env("NEXT_PUBLIC_SUPABASE_URL");
const SB_SERVICE = env("SUPABASE_SERVICE_ROLE_KEY");
if (!STRIPE_KEY || !SB_URL || !SB_SERVICE) {
  console.error("Missing STRIPE_SECRET_KEY / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
console.log(`Mode: ${STRIPE_KEY.startsWith("sk_live") ? "LIVE" : "TEST"}  (${STRIPE_KEY.slice(0, 8)}…)`);

const stripe = new Stripe(STRIPE_KEY);
const sb = createClient(SB_URL, SB_SERVICE);

const PLANS = [
  { sku: "editing-starter", name: "Editing: Starter", code: "EDIT-01", priceCents: 59500, longForm: 2, shortForm: 4, featured: false },
  { sku: "editing-growth", name: "Editing: Growth", code: "EDIT-02", priceCents: 99500, longForm: 4, shortForm: 8, featured: true },
  { sku: "editing-scale", name: "Editing: Scale", code: "EDIT-03", priceCents: 179500, longForm: 8, shortForm: 16, featured: false },
];

// Stripe recurring prices are mode-specific: a test price id cannot be used on
// the live account. So store the id under a mode-scoped metadata key
// (stripe_price_id_live / stripe_price_id_test) and let create-subscription pick
// the one matching the running key. Run this once with the TEST key and once
// with the LIVE key; each populates its own field without touching the other.
const MODE = STRIPE_KEY.startsWith("sk_live") ? "live" : "test";
const PRICE_KEY = `stripe_price_id_${MODE}`;
console.log(`Seeding into metadata.${PRICE_KEY}`);

for (const p of PLANS) {
  const { data: existing } = await sb
    .from("products")
    .select("id, metadata")
    .eq("sku", p.sku)
    .maybeSingle();

  // Skip only when THIS mode's price is already set, so seeding live is not
  // skipped just because a test id exists (and vice versa).
  if (existing?.metadata?.[PRICE_KEY]) {
    console.log(`  ${p.sku}: ${MODE} price already set (${existing.metadata[PRICE_KEY]}), skipping`);
    continue;
  }

  // Reuse a price by lookup_key (Stripe scopes this to the key's mode), else
  // create the product + price.
  const lookupKey = `ghlvideo_${p.sku.replace(/-/g, "_")}_monthly`;
  const found = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  let priceId;
  if (found.data.length) {
    priceId = found.data[0].id;
    console.log(`  ${p.sku}: reusing ${MODE} price ${priceId}`);
  } else {
    const product = await stripe.products.create({
      name: `GHL Video ${p.name}`,
      metadata: { sku: p.sku, code: p.code },
    });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: p.priceCents,
      currency: "usd",
      recurring: { interval: "month" },
      lookup_key: lookupKey,
      metadata: { sku: p.sku },
    });
    priceId = price.id;
    console.log(`  ${p.sku}: created ${MODE} product ${product.id} + price ${priceId}`);
  }

  const base = {
    kind: "subscription",
    code: p.code,
    long_form: p.longForm,
    short_form: p.shortForm,
    featured: p.featured,
    [PRICE_KEY]: priceId,
  };

  if (existing) {
    await sb
      .from("products")
      .update({
        metadata: {
          ...existing.metadata,
          ...base,
          // keep the legacy single field; only set it if it was empty, so we
          // never clobber the other mode's value stored there.
          stripe_price_id: existing.metadata?.stripe_price_id ?? priceId,
        },
      })
      .eq("id", existing.id);
    console.log(`  ${p.sku}: set metadata.${PRICE_KEY} on existing row`);
  } else {
    const { error } = await sb.from("products").insert({
      sku: p.sku,
      name: p.name,
      type: "subscription",
      price_cents: p.priceCents,
      currency: "usd",
      active: true,
      metadata: { ...base, stripe_price_id: priceId },
    });
    if (error) {
      console.error(`  ${p.sku}: insert failed:`, error.message);
      process.exit(1);
    }
    console.log(`  ${p.sku}: inserted products row`);
  }
}

console.log(`Done. Editing subscription plans seeded (${MODE}).`);
