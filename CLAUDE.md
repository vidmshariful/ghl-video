# GHL Video — Working Guide for Claude Code

The live codebase for ghlvideo.com: a marketing site plus native on-domain
commerce for a HighLevel-only video studio. This file describes the system as
it is. The original pre-build brief (now `docs/original-build-brief.md`)
described an external-checkout static site and is obsolete; trust this file,
README.md, and `docs/CHECKOUT-BUILD-PROMPT.md`.

One line: bold, modern, human-designed marketing site in front of a real
Stripe + Supabase commerce backend, all on one domain.

---

## 1. Architecture

- **Next.js 16 (App Router, TypeScript strict) in server mode on Vercel.**
  Not a static export. `vercel.json` carries the 301s from the old WordPress
  URLs.
- **Native checkout on-domain.** Every buy button routes to
  `/checkout/[sku]`. There is no external order site: `order.ghlvideo.com`
  is retired. One-time products use PaymentIntents; editing plans are native
  Stripe subscriptions. No cart.
- **Supabase** is the database (Postgres + RLS on every table), auth
  (admin + customer portal logins), and private file storage (intake
  uploads). Runtime data ops use the service-role key from server code only;
  the browser gets the RLS-limited anon key.
- **HighLevel (LeadConnector) API v2** is the CRM: paid orders, activated
  subscriptions, and quote leads sync to contacts, tags, and opportunities.
  Booking calendars on /contact are LeadConnector embeds.
- **Admin** is a client SPA at `/admin` (Supabase auth + `admins` allowlist
  table): dashboard, orders, products, customers, bumps, subscriptions, and
  site tools. **Portal** at `/portal` gives customers their orders, invoices,
  and subscription management. Both are noindex, outside the marketing chrome.

### The money path (details in docs/CHECKOUT-BUILD-PROMPT.md)

`/checkout/[sku]` loads the product from the DB and creates a PaymentIntent.
`finalize` re-derives the price server-side (base + bumps), stamps the intent
BEFORE writing the pending order, then the client confirms. The Stripe
webhook settles: verifies the charged amount against the order, flips it paid
once (idempotent conditional update), then fulfills to HighLevel behind an
atomic claim. Dashboard refunds and disputes flow back via `charge.refunded` /
`charge.dispute.created`. Orphan paid intents (no order row) are reconstructed
from intent metadata. The client never controls a price; the webhook secret
and signature check are non-negotiable.

The Stripe webhook endpoint must subscribe to: `payment_intent.succeeded`,
`payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created`,
`customer.subscription.created/updated/deleted`.

## 2. Content and price truth

- **`lib/site.ts` is the single content source**: every price (in dollars),
  plan, video, pack, bundle, nav item, CTA label, and line of recurring copy.
  Pages and components read from it; never hardcode copy or prices in
  components.
- **`sellableProducts`** (end of site.ts) derives everything sellable from
  the catalog, and `productCodes` assigns each slug its display code
  (EXP-004, PACK-001, ...). The checkout sku is the lowercased code
  (`skuFor`). A build-time gate fails `next build` if a sellable slug has no
  code.
- **The DB `products` table is what checkout charges** (`price_cents`).
  It is synced FROM the catalog: admin → Products → **"Sync from catalog"**
  inserts new SKUs and updates price/name/metadata for existing ones, so
  site.ts is the price authority end to end. The sync never touches the
  admin's `active` kill switch or hand-created rows. After adding or
  repricing anything in site.ts: deploy, then run Sync from catalog.
- **Subscriptions are the exception**: the three editing plans keep their own
  skus (`editing-starter/growth/scale`, tied to Stripe price ids, seeded by
  `npm run seed:subscriptions`) and never go through `skuFor`. Their buy
  links are `/checkout/<plan.sku>` directly.

## 3. Database

Schema lives in `supabase/migrations/*.sql` (ordered, idempotent).
`npm run migrate` applies pending files and records them in
`schema_migrations` (`--dry-run` to preview; needs `SUPABASE_DB_URL`).
Tables: products, customers, orders, order_events (audit log), stripe_events
(webhook idempotency), admins, order_bumps, order_updates, subscriptions,
plus the private `intake` storage bucket. Money is integer cents everywhere.
RLS is default-deny; do not add anon policies to money tables.

## 4. Env and scripts

`.env.example` documents every variable; `.env.local` (gitignored) holds dev
values, Vercel holds production. Highlights: Stripe keys + webhook secret,
Supabase URL/anon/service-role + `SUPABASE_DB_URL` (migrations only),
HighLevel token/location/pipeline/stage + `HIGHLEVEL_LEAD_PIPELINE_ID` /
`HIGHLEVEL_LEAD_STAGE_ID` (quote leads; falls back loudly to defaults).

```
npm run dev                 # dev server (usually already running on :3000)
npm run build               # includes the catalog integrity gate
npm run lint                # eslint
npm run migrate             # apply pending SQL migrations (tracked)
npm run seed:subscriptions  # seed the 3 editing plans (idempotent)
npm run test:e2e            # Playwright smoke suite
```

Rate limiting note: `lib/rate-limit.ts` is per-instance (in-memory). The
production backstop is a Vercel firewall rule + Stripe Radar; do not treat
the in-process limiter as real protection.

## 5. Design system (locked)

Colors come pixel-exact from the logo and do not change:

```css
--gold:#FCC000; --blue:#0090FC; --green:#00CC00;
--brand-gradient: linear-gradient(100deg,#FCC000,#00CC00); /* signature */
--canvas:#08090D; --surface:#111219; --card:#161821; --hair:#242736;
--text:#EEF0F6; --muted:#9096A8; --dim:#5A6076; --error:#FF6B6B;
```

- **Type:** Archivo (display, 600, tight tracking) + Raveo Display (body and
  wide-tracked labels), self-hosted in `app/fonts/`. Two typefaces only.
- **Discipline:** roughly 70% canvas, 20% one lead accent per section, 10%
  support. One accent leads per section; never all three at equal weight.
  The gradient is the signature: hero accent word, primary buttons, ambient
  glows. Green never stands alone as a screen's only accent.
- Buttons on bright fills use near-black text (#08090D). Hairline borders at
  low opacity. Soft radial glows over drop shadows. The homepage uses a
  hybrid theme: dark heroes and footer (hard rule), `theme-light` bands for
  the proof/people sections.
- **Anti-generic mandate still applies:** no pill-badge centered SaaS hero
  stack, no three identical feature cards, no decorative icon dumps, no
  gradient-on-everything, no emoji as UI, no scattered fade-ups on every
  element. Video is the hero; motion serves the product (hover-play cards,
  one orchestrated hero moment). Respect `prefers-reduced-motion`. Motion
  stack is GSAP + Framer Motion; reveals go through the `Reveal` wrapper.

## 6. Copy rules (enforce in every string)

- No em dashes, no en dashes, no middle dots, no ellipsis characters.
  Periods, commas, colons.
- CTA vocabulary is fixed: **Book a Call, Order Now, Start editing,
  Request a Quote** (labels live in `cta` in site.ts; use those exports).
  Never "Get Started" or "Learn More". "Order for $495" is retired; prices
  span $97 to $3,495 and flat-$495 framing is dead.
- Client count is **800+** everywhere. No year in customer copy.
- Founder-to-founder voice: direct, outcome-led, no hype. The reader knows
  MRR, CAC, LTV, churn.
- Footer brand line is "A brand of Vidiosa LLC" (brand-family narrative);
  the operating legal entity in legal docs is Magic Motion Production LLC
  (see lib/legal.ts). Do not "fix" one to match the other.
- The HighLevel non-affiliation disclaimer stays in every footer.

## 7. Routes

```
/  /premade  /custom-video  /quote  /editing  /about  /contact  /work
/highlevel-demo-video  /highlevel-video-bundle      (preserved SEO URLs)
/blog  /resources                                    (designed stubs, noindex)
/legal/privacy  /legal/terms  /legal/refund
/checkout/[sku]  /checkout/intake/[orderId]  /checkout/thank-you  (noindex)
/portal          /admin                              (noindex)
/api/checkout/*  /api/webhooks/stripe  /api/portal/*  /api/admin/*
/api/orders/[id]  /api/intake/[orderId]  /api/quote
```

`lib/pages-list.ts` is the canonical page list feeding the sitemap and the
admin Pages screen. Header nav and footer chrome are backend-managed via
Supabase (`lib/chrome.ts`) with site.ts values as build-time fallback.

## 8. Quality floor

Responsive from 320px. Visible keyboard focus everywhere. Reduced motion
respected. Pinch zoom never disabled. Per-page metadata + canonical; new
pages get added to `lib/pages-list.ts`. No console errors. `npx tsc
--noEmit`, `npm run lint`, and `npm run build` must pass clean; screenshot
changed screens at desktop and mobile before calling them done. If a screen
feels templated, push it once more.
