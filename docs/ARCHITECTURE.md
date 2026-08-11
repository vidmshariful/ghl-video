# Architecture: the 4 parts and the shared core

The site is **four parts** plus a **shared core** they all read from. The parts
are separated at the routing layer (own layouts, own indexing) and kept from
importing each other by ESLint rules. The shared core is the single source of
truth for content, prices, and config, so a change in one place shows up on
every part instead of drifting.

Read this before a non-trivial change so you know **where it lives** and **what
else it touches**.

## The 4 parts

| # | Part | Route | Layout | Components | Indexed |
|---|------|-------|--------|-----------|---------|
| 1 | Public marketing | `app/(site)/**` | `app/(site)/layout.tsx` (full chrome) | `components/{home,pages,premade}` | yes |
| 2 | Checkout (money path) | `app/checkout/**`, `app/api/checkout/**`, `app/api/webhooks/stripe` | `app/checkout/layout.tsx` (minimal) | `components/checkout` | no |
| 3 | Backend | `app/admin/**`, `app/portal/**`, `app/api/{admin,portal}/**` | `app/admin/layout.tsx`, `app/portal/layout.tsx` | colocated in the route folders | no |
| 4 | Sales pages | `app/(sales)/**` | `app/(sales)/layout.tsx` (scoped `.sp` system) | `components/sales` | per-page `indexable` flag |

Each part has its own layout, its own chrome, and its own indexing policy. No
part imports another part's UI or the money-path internals (enforced, see
Guardrails).

## The shared core (single source of truth)

| Concern | File | Notes |
|---|---|---|
| Content, copy, prices, catalog | `lib/content/*` via the `lib/site.ts` barrel | The price/copy authority. Import from `@/lib/site`. |
| The load-bearing facts | `lib/content/core.ts` | `clients` (1000+), `rating` (5.0), `deliveryWindow` (5 to 7 days), `studioSince` (2020). Never hardcode these. |
| Niche upsell copy + price | `lib/content/niche.ts` | Site card + sales card + FAQ all read this. |
| Sales-LP bundle offer + intake picker | `lib/bundles.ts` | Order domain. Imported by parts 2, 3, 4. Client-safe. NOT sales-page content. |
| Sales-page content (copy, videos) | `lib/sales/pages.ts` | Landing-page content ONLY. Editing it never touches bundle logic. |
| Nav / footer / tracking scripts | `lib/chrome.ts` | Hard-coded (GTM, Google Ads, Hotjar, chat). Injected on parts 1, 2, 4; never portal/admin. The admin "Header & Footer Code" screen is a read-only mirror. |
| Public Supabase handles (URL + anon) | `lib/supabase-config.ts` | Runtime reads (catalog, studio slots, auth). Public/RLS-limited. |
| Money backend (server-only) | `lib/checkout/*` | Stripe, service-role client, price derivation, sync, bundles' DB validation. `import "server-only"`. |
| DB catalog read (ISR + code fallback) | `lib/catalog-db.ts` | The library reads this; falls back to the code catalog. |
| JSON-LD structured data | `lib/schema.ts` | SEO schema (not the DB schema; that's `supabase/migrations/`). |

## Where does X live?

- **A price** → `lib/content/*` (the code catalog is the authority) → then run
  admin "Sync from catalog" to push to the DB `products` table. Verify with
  `npm run check:drift`.
- **A bundle (lp-\*) price/composition** → `lib/bundles.ts` (`salesBundles`) AND
  the DB `products` row. `check:drift` fails if they disagree.
- **Client count / rating / delivery window / founding year** → `lib/content/core.ts`.
- **Niche add-on copy or the $50/$100 split** → `lib/content/niche.ts`.
- **A sales landing page's copy/videos** → `lib/sales/pages.ts`.
- **The intake video-picker rules** → `lib/bundles.ts`.
- **Tracking / pixels** → `lib/chrome.ts` (`HEAD_SCRIPTS` / `BODY_END_SCRIPTS`).
- **Nav / footer links** → `lib/content` (nav/services/legal) surfaced via `lib/chrome.ts`.
- **A URL redirect** → `vercel.json`.

## Code <-> database dual-writes (the drift-prone edges)

Some facts live in code AND the database. These are guarded:

- **Product prices**: code catalog -> DB `products` via admin "Sync from
  catalog". Guard: `npm run check:drift`.
- **lp-\* bundles**: `lib/bundles.ts` -> hand-managed DB `products` rows. Guard:
  `check:drift` (price/count/anchor/delivery) + the build-time bundle gate.
- **Order bumps** (niche customization): DB `order_bumps` rows. The card/FAQ
  copy reads `lib/content/niche.ts`; keep the bump prices in step with it.
- **Editing subscriptions**: `lib/content/premade.ts` display price vs the Stripe
  price id (seeded by hand). Not auto-synced; change both together.

## Guardrails (what catches drift)

1. **Build-time gates** (`next build` fails):
   - `lib/content/sellable.ts` — every sellable product must resolve to a code.
   - `lib/bundles.ts` — bundle pick counts must equal `videoCount`, anchor >
     price, and the catalog must have enough videos.
2. **ESLint part boundaries** (`eslint.config.mjs`) — no part may import another
   part's UI (`@/components/{home,pages,premade,checkout,sales,admin}`) or the
   money-path internals (`@/lib/checkout/*` from marketing). Shared `lib` stays
   importable everywhere.
3. **`npm run check:drift`** — compares every code price + bundle composition
   against the DB `products` rows and exits non-zero on mismatch. Run it after
   any price/bundle edit and before a deploy (CI-ready).

## Golden rules

- Change a shared fact in the core, never in a page or component.
- After a price or bundle change: deploy, run admin "Sync from catalog" (for
  one-time products), and run `npm run check:drift`.
- Put shared code in `lib/content` (or a shared component); the ESLint
  boundaries will stop a cross-part import.
