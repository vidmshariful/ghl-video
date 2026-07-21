# GHL Video / Native Checkout Build Prompt (Single-Product POC)

## What we are building

A native, on-domain checkout system inside the GHL Video website, replacing the current HighLevel-hosted order pages. The buyer completes the entire purchase on ghlvideo.com without leaving the domain. Payment is processed by Stripe directly on the site, the order is recorded in Supabase as the source of truth, and the sale is synced to HighLevel via its API so all existing CRM and fulfillment automations still fire.

This build is a proof of concept: implement the full end-to-end flow for ONE product first. Once it is proven, the same system scales to every SKU and bundle by adding config, with no new plumbing.

Do not build all products. Build the architecture, prove it on one SKU, and make adding the rest a config-only task.

## The core principle behind the architecture

Stripe is the money rail. The same Stripe account currently connected to HighLevel is connected directly to the website. Stripe does not mind being connected to both; it is one account, one dashboard, one payout stream. So payment runs natively through Stripe on the site for the best experience, and HighLevel is kept in the loop through its API purely for CRM, automation, and fulfillment. HighLevel stops being the checkout and becomes the brain behind it.

## The payment-to-fulfillment flow (build to this exactly)

1. Product page has a Buy button that routes to the on-site checkout page for that SKU.
2. Checkout page collects customer details (name, email, company, phone) and mounts the Stripe Payment Element (embedded, on-domain, card data goes straight to Stripe and never touches our server).
3. Client calls our backend to create a payment intent. The backend looks up the price by SKU server-side (authoritative, never trust a client-sent amount), creates a Stripe PaymentIntent with metadata (SKU, customer, order id), writes a pending order row in Supabase, and returns the client_secret.
4. The buyer confirms payment through the Payment Element.
5. Stripe fires a webhook to our backend on payment_intent.succeeded. The backend verifies the signature, updates the Supabase order to paid (idempotently), then calls the HighLevel API to upsert the contact, add the purchase tag, and create an opportunity, storing the returned HighLevel IDs back on the order.
6. The tag on the HighLevel contact triggers the existing HighLevel workflow (branding intake email, fulfillment task, receipt), so nothing about fulfillment changes.
7. The buyer lands on a branded on-site thank-you page that reads the order status from Supabase and shows next steps (the branding intake form or link).

## Tech stack and what is already in place

- Next.js (App Router, TypeScript, Tailwind CSS, Framer Motion), deployed on Vercel. This is the existing GHL Video site.
- Supabase backend, already provisioned, Claude Code has access.
- Stripe account, already connected to HighLevel, to be connected directly to the site via API keys.
- HighLevel (LeadConnector) with the existing subaccount, pipelines, and workflows.

## Build order (follow this sequence)

Per the standing engineering principles: database first, then backend, then frontend. Never superficial. Reusable components. A single config source. Unique ID selectors. Performance and a uniform look.

### Step 1 / Database first (Supabase)

Design the schema so it already supports all product types (one-time and subscription), even though the POC uses one SKU. Create these tables with RLS enabled and orders NOT publicly readable.

**products**
- id (uuid, pk)
- sku (text, unique) : stable slug, matches the current order slugs where sensible
- name (text)
- description (text)
- type (text) : one_time or subscription
- price_cents (integer) : authoritative price, server reads this, never the client
- currency (text, default usd)
- active (boolean, default true)
- metadata (jsonb) : delivery_days, video_count, tier, bump_eligible, upsell_sku, etc.
- created_at, updated_at (timestamptz)

**customers**
- id (uuid, pk)
- email (text, unique)
- name (text)
- company (text)
- phone (text)
- stripe_customer_id (text)
- highlevel_contact_id (text)
- created_at, updated_at

**orders**
- id (uuid, pk)
- product_id (uuid, fk products)
- customer_id (uuid, fk customers)
- customer_email (text) : denormalized for fast lookup
- amount_cents (integer) : snapshot of price at purchase
- currency (text)
- status (text) : pending, paid, failed, refunded
- stripe_payment_intent_id (text, unique)
- highlevel_contact_id (text)
- highlevel_opportunity_id (text)
- metadata (jsonb) : sku, intake_status, source, campaign, etc.
- created_at, paid_at (timestamptz)

**order_events**
- id (uuid, pk)
- order_id (uuid, fk orders)
- event_type (text) : intent_created, payment_succeeded, hl_synced, webhook_received, etc.
- payload (jsonb)
- created_at
- This is the audit log. Every state change writes a row here, so we can debug any order end to end.

Add indexes on orders.stripe_payment_intent_id, orders.customer_email, orders.status, and products.sku. Provide the migration as SQL. Seed the single POC product (see the POC product section).

### Step 2 / Backend (Next.js route handlers + server logic)

Build these as App Router route handlers. Keep all Stripe and HighLevel calls server-side only. Never expose secret keys to the client.

**POST /api/checkout/create-intent**
- Input: sku, customer details.
- Look up the product by sku in Supabase. Read price_cents from the row. This is the authoritative price. Reject if the product is missing or inactive.
- Upsert the customer in Supabase and, if needed, create a Stripe customer.
- Create a Stripe PaymentIntent for amount = product.price_cents, currency, with metadata { order_id, sku, customer_email }.
- Insert a pending order row in Supabase (status pending, stripe_payment_intent_id set).
- Write an intent_created row to order_events.
- Return only the client_secret and the order id. Never return secret keys.

**POST /api/webhooks/stripe**
- Verify the Stripe signature using the webhook secret. Reject anything unsigned or invalid.
- Handle payment_intent.succeeded: load the order by stripe_payment_intent_id, and if it is not already paid (idempotency, Stripe can send duplicates), set status paid and paid_at, then run the HighLevel sync (below), then store the returned HighLevel IDs on the order. Write payment_succeeded and hl_synced rows to order_events.
- Handle payment_intent.payment_failed: set order status failed, log the event.
- Make the whole handler idempotent and safe to receive twice.

**HighLevel sync (server module, called from the webhook)**
- Use the HighLevel API v2 (LeadConnector, base https://services.leadconnectorhq.com) with a Private Integration token and the Location ID, sending the required Version header. Confirm the current exact endpoints and headers against the HighLevel API reference before implementing; do not assume.
- Upsert the contact (email, name, phone, company). Store highlevel_contact_id on the customer and order.
- Add the purchase tag or tags to the contact (for example ghlvideo-order and a per-product tag like ai-pack). The tag is what triggers the existing HighLevel fulfillment workflow, so this step is what keeps automations firing. Confirm the exact tag names with the team so they match the workflow triggers already built.
- Optionally create an opportunity in the orders or fulfillment pipeline, storing highlevel_opportunity_id.
- Wrap every HighLevel call in try or catch. A HighLevel failure must NOT fail the payment (the money is already taken). On failure, mark the order metadata hl_sync_failed and log to order_events so it can be retried, and surface it for a manual or scheduled retry. Payment success and HighLevel sync are decoupled.

**GET /api/orders/[id]/status** (or a server action)
- Returns the order status for the thank-you page to read. Do not leak sensitive fields; return only what the confirmation page needs.

### Step 3 / Frontend (reusable, on-brand, on-domain)

Build the checkout UI from reusable components, matching the existing GHL Video design system exactly (same tokens, typography, buttons, and forms already in the site element library). Reuse the site's existing button, input, and form components; do not create one-off styles. Every interactive element gets a unique ID selector.

**Checkout page** (route like /checkout/[sku])
- Loads the product from Supabase by sku (server component for the product data, so it is fast and SEO-safe).
- Left or top: order summary (product name, what is included, price).
- Right or below: customer detail form, then the Stripe Payment Element mounted with the client_secret from create-intent.
- On successful confirmation, route to the thank-you page with the order id.
- Handle loading, error, and declined-card states cleanly and on-brand.

**Thank-you page** (route like /checkout/thank-you)
- Reads order status. On paid, shows a branded confirmation and the next step (the branding intake form or link). On pending, polls briefly. On failure, shows a retry path.

**Buy button integration**
- Wire the single POC product's Buy button on its product page to the new /checkout/[sku] route. Leave all other products pointing at their current HighLevel order pages until the POC is approved.

### Step 4 / Config and variables (single source)

- A single products config or the Supabase products table is the one place SKUs, prices, and metadata live. Adding a product later is a config or row addition, nothing more.
- All keys in environment variables, never in code: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, HIGHLEVEL_API_TOKEN, HIGHLEVEL_LOCATION_ID, and the HighLevel pipeline and stage IDs plus tag names.
- Document every env var in a .env.example with a one-line comment each.

## Security requirements (non-negotiable)

- Server-side price authority: the PaymentIntent amount is always read from Supabase by SKU. Never accept an amount from the client.
- Stripe webhook signature verification on every webhook. Reject unsigned requests.
- Idempotent webhook handling: safe to receive the same event twice, never double-fulfill.
- Supabase RLS on all tables. Orders and customers are not publicly readable. The service role key is used only server-side.
- Card data never touches our server. The Stripe Payment Element sends it directly to Stripe (keeps us SAQ A eligible).
- HighLevel sync failures never fail or reverse a successful payment; they are logged and retryable.

## The POC product

Start with ONE clean one-time product. Recommended: the flagship single video (All-in-one + AI-First Positioning, currently 495 USD) OR the full AI First SaaS Pack, whichever the team confirms. Set its real SKU, name, and price in the products table. Keep it one-time (not subscription) so the POC proves the simplest path first. The subscription path (editing tiers) is a later iteration on the same schema, which already supports type = subscription.

CONFIRM BEFORE BUILDING: the exact POC SKU, its display name, and its price in cents.

## Out of scope for the POC (do not build yet)

- Order bumps and one-click upsells (design the schema to allow them via product.metadata, but do not implement the UI yet).
- The subscription and recurring checkout for editing tiers.
- The catalog-selection pages for the large libraries.
- Migrating the other products off HighLevel order pages. Only the one POC product moves.
- Any refactor of the existing HighLevel automations. We are syncing into them, not changing them.

## Acceptance criteria (the POC is done when)

1. A buyer completes a real test purchase of the POC product entirely on ghlvideo.com, card entered on-domain, no redirect off the site.
2. The order appears in Supabase with status paid and a full order_events trail.
3. The contact appears or updates in HighLevel with the correct purchase tag, and the existing fulfillment workflow fires (intake email received).
4. The Stripe payment shows in the same Stripe dashboard already used with HighLevel.
5. A duplicate Stripe webhook does not create a duplicate order or double-fire fulfillment.
6. A forced HighLevel API failure leaves the payment intact and the order flagged for retry, not lost.
7. The checkout and thank-you pages match the existing GHL Video design system and pass a mobile and desktop check.

## Deliverables from this build

- The Supabase migration SQL and seed for the POC product.
- The route handlers and the HighLevel sync module.
- The reusable checkout and thank-you components wired to the design system.
- A .env.example documenting every variable.
- A short README describing the flow, how to add the next product (config-only), and how to run the test purchase.

## First questions to resolve before writing code

1. Confirm the POC SKU, name, and price in cents.
2. Confirm the HighLevel access method (Private Integration token) and the Location ID, plus the exact tag names and pipeline or stage IDs the existing fulfillment workflow listens for.
3. Confirm whether to use Stripe Payment Element (embedded, recommended for the on-domain goal) or Stripe Checkout (hosted redirect) for the POC. The embedded element is what proves the seamless on-domain experience that motivated this build.
