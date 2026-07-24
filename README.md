# GHL Video

Marketing site + native commerce for GHL Video (a brand of Vidiosa LLC), the video studio built only for the HighLevel ecosystem. The legal operating entity is Magic Motion Production LLC (GHL Video is its DBA).

- **Stack:** Next.js 16 App Router (**server mode**, not static export), TypeScript, Tailwind CSS v4, Framer Motion.
- **Backend:** Supabase (Postgres + RLS) and Stripe. The site **processes payments natively** on-domain via server route handlers (`app/api/**`): Stripe PaymentIntents, subscriptions, the Stripe webhook, and HighLevel fulfillment sync all run server-side. It is **not** a static export — a static build would drop every API route (checkout, webhook, portal).
- **Type:** Archivo (display, Google Fonts) and Raveo Display (body and labels, SIL OFL 1.1, self-hosted in `app/fonts/`), loaded via `next/font`.
- **Content:** every price, count, name, URL, and recurring line lives in `lib/site.ts`. Pages read from it; nothing is hardcoded per component.
- **Build brief:** `CLAUDE.md` in the repo root is the source of truth for design tokens, copy rules, and guardrails.

## Develop

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill it in for the checkout/portal/webhook paths to work locally.

Database schema lives in `supabase/migrations/` (ordered, idempotent). `npm run migrate` applies pending files and records them in `schema_migrations` (`--dry-run` to preview). `npm run seed:subscriptions` seeds the three editing plans in Stripe + the products table.

## Build & deploy

```bash
npm run build   # standard Next.js server build (.next)
```

Deploys to **Vercel** using the auto-detected Next.js preset — **do not set a custom output directory** (no `out/`). `vercel.json` holds the 301s from the old WordPress URLs (Vercel honors it).

### Required production env vars (set in Vercel → Production)

Server-only: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `HIGHLEVEL_API_TOKEN`, `HIGHLEVEL_LOCATION_ID`, `HIGHLEVEL_PIPELINE_ID`, `HIGHLEVEL_STAGE_ID`, and recommended `HIGHLEVEL_LEAD_PIPELINE_ID` + `HIGHLEVEL_LEAD_STAGE_ID` (quote leads; unset falls back to hardcoded defaults with a log warning). Optional: `HIGHLEVEL_API_VERSION`.
Client (`NEXT_PUBLIC_`): `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` (also read server-side — omitting it lets the marketing build pass but breaks checkout at runtime), and recommended `NEXT_PUBLIC_SITE_URL`.

Use **live** Stripe keys from the site's own Stripe account, and register the production webhook at `https://ghlvideo.com/api/webhooks/stripe` subscribed to: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.

Rate limiting in `lib/rate-limit.ts` is per-instance (in-memory); the production backstop is a Vercel firewall rule plus Stripe Radar. Confirm both are configured before scaling spend.
