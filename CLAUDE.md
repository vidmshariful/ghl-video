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
- **Partner portal** at `/partners` (same Supabase auth): affiliates get
  their tracked links, promo assets, and profile; `/partners/apply` is the
  public application. Backed by the `partners` + `partner_assets` tables
  (admin -> Partners manages them). The checkout discount still reads
  `lib/affiliates.ts` (code registry) until the DB bridge ships; commissions
  and payouts live in **Affixo** (`lib/affixo.ts`), which replaced
  FirstPromoter in August 2026. FirstPromoter env vars survive in
  `.env.example` only to read the old numbers, and `lib/firstpromoter.ts`
  is gone. Do not wire new work to it.

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
There are **61 tables**, and the migrations are the only complete list. The
ones most work touches: products, customers, orders, order_events (audit log),
stripe_events (webhook idempotency), admins, order_bumps, order_updates,
order_deliverables, subscriptions, projects, subscription_cycles,
deliverable_comments, deliverable_versions, video_feedback, conversations,
notifications, notification_templates, seo_pages, redirects, blog_posts,
blog_categories, catalog, partners, journal, plus the private `intake`
storage bucket. Money is integer cents everywhere.

RLS is on for all 61 tables and default-deny. Verified September 2026: the
only anon-readable tables are the public marketing ones (catalog, blog,
seo_pages, redirects). Do not add anon policies to money tables.

`order_deliverables` is one row per VIDEO owed on an order, created at
settlement by `lib/deliverables.ts` (a video expands to one row, a pack to its
catalog members, a bundle to empty slots the customer names at intake). It is
what the studio board and the customer's video list read. `npm run
check:deliverables` proves every product still expands to the count its offer
advertises; `npm run backfill:deliverables` is the idempotent catch-up for
orders that predate it.

## 4. Env and scripts

`.env.example` documents every variable; `.env.local` (gitignored) holds dev
values, Vercel holds production. Highlights: Stripe keys + webhook secret,
Supabase URL/anon/service-role + `SUPABASE_DB_URL` (migrations only),
HighLevel token/location/pipeline/stage + `HIGHLEVEL_LEAD_PIPELINE_ID` /
`HIGHLEVEL_LEAD_STAGE_ID` (quote leads; falls back loudly to defaults).

```
npm run dev                 # dev server, always on :3200 (3000 belongs to another project)
npm run build               # includes the catalog integrity gate
npm run lint                # eslint
npm run check:live          # the four world-state checks, before asking to deploy
npm run check:drift         # cross-part drift (the 4 surfaces)
npm run check:owners        # every file touching a video handles all 3 owners
npm run check:deliverables  # each product expands to the count it advertises
npm run migrate             # apply pending SQL migrations (tracked)
npm run seed:subscriptions  # seed the 3 editing plans (idempotent)
npm run test:e2e            # Playwright smoke suite
```

`prebuild` also runs the unit tests plus check:tokens, check:leaks and
check:portal-ui, so a `next build` failure can come from any of them. Judge
it by the exit code, never by skimming the output. The full script list is
in `package.json`; the rest are seeds and backfills.

Rate limiting note: `lib/rate-limit.ts` is per-instance (in-memory). The
production backstop is a Vercel firewall rule + Stripe Radar; do not treat
the in-process limiter as real protection.

## 5. Design system (locked)

**Four surfaces, four skins, one brand core.** The platform has four visual
surfaces, each with its own skin so restyling one can never leak into
another: the **main site** (`app/(site)`, skin = the `:root` defaults in
`app/globals.css`), the **portals** (`/admin` + `/portal` + `/partners`,
skin = the `[data-surface="portal"]` block), **checkout**
(`[data-surface="checkout"]` block), and the **sales pages**
(`app/(sales)/sales.css`, the `.sp` system, fully separate). Each non-site
layout stamps `data-surface` on its wrapper. Shared across ALL surfaces on
purpose: the brand core (gold/blue/green, the gradient, glows, `--error`,
the two typefaces) plus the top-level shared components (`Logo`, `GhlMark`,
chat). ESLint part-boundary rules in `eslint.config.mjs` fail the build if
one surface imports another's UI. To restyle a surface, edit ONLY its skin
block (fork radius or type scale into a skin the same way when needed).
The rules below describe the brand core and the main-site skin.

Brand accents (gold, blue, green) are pixel-exact from the logo. The neutral
hairline and dim grays were tuned for contrast (dim now passes WCAG AA on
canvas); these are the live values in `app/globals.css`:

```css
--gold:#FCC000; --blue:#0090FC; --green:#00CC00;
--brand-gradient: linear-gradient(100deg,#FCC000,#00CC00); /* signature */
--canvas:#08090D; --surface:#111219; --card:#161821; --hair:#2b2f40;
--text:#EEF0F6; --muted:#9096A8; --dim:#7d8499; --error:#FF6B6B;
```

- **Type:** Archivo (display, 600, tight tracking) + Raveo Display (body and
  wide-tracked labels), self-hosted in `app/fonts/`. Two typefaces only.
- **Discipline:** roughly 70% canvas, 20% one lead accent per section, 10%
  support. One accent leads per section; never all three at equal weight.
  The gradient is the signature: hero accent word, primary buttons, ambient
  glows. Green never stands alone as a screen's only accent.
- Buttons on bright fills use near-black text (#08090D). Hairline borders at
  low opacity. Soft radial glows over drop shadows. Radius is deliberately
  tight: 4px containers (`rounded-card` / `rounded-media`), 3px controls
  (buttons, inputs), `rounded-full` only for dots and avatars. No other radii.
  The site is full-dark
  everywhere (client direction, July 2026): the gold-to-green gradient is
  nearly invisible on white, so the old hybrid light bands were retired and
  the `.theme-light` wrappers are gone from the markup. Do not add a light
  band back.
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
- Client count is **1000+** everywhere (never 800+ or 376+), and "teams"
  is never a client-count word: use "clients" or "HighLevel SaaS". The
  studio authority date is **2020**, phrased "creating HighLevel videos
  since 2020" (client decision, July 2026); no other years in customer
  copy. Never print the Google review count; say every review is five
  stars instead.
- Founder-to-founder voice: direct, outcome-led, no hype. The reader knows
  MRR, CAC, LTV, churn.
- Footer brand line is "A brand of Vidiosa LLC". The operating legal entity
  is Vidiosa LLC, named consistently in the legal docs (lib/legal.ts) and the
  invoice From block. Changed 2026 from Magic Motion Production LLC (owner
  decision); do not reintroduce that name. This entity must match the one
  registered for Stripe payments and A2P/10DLC SMS.
- The HighLevel non-affiliation disclaimer stays in every footer.

## 7. Routes

```
/  /premade  /custom-video  /quote  /editing  /about  /contact  /work
/library                                             (full catalogue, public)
/studio-insights  /ai-first-launch
/highlevel-demo-video  /highlevel-video-bundle       (preserved SEO URLs)
/blog  /blog/[slug]  /blog/category/[slug]           (live CMS, real posts)
/resources                                           (designed stub, noindex)
/lp/[slug]                                           (sales pages, (sales) group)
/legal/privacy  /legal/terms  /legal/refund  /legal/partner-terms
/v/[token]  /list/[token]                            (share links)
/checkout/[sku]  /checkout/intake/[orderId]  /checkout/thank-you  (noindex)
/portal          /admin                              (noindex)
/partners  /partners/apply                          (affiliate portal, noindex)
/api/checkout/*  /api/webhooks/stripe  /api/portal/*  /api/admin/*
/api/orders/[id]  /api/intake/[orderId]  /api/quote  /api/partners/*
/api/cron/chase  /api/cron/price-drift               (needs CRON_SECRET)
```

Note `/blog/` is a real CMS with published posts, not a stub. Its index page
still carries a hardcoded `robots: index:false` from when it was empty, while
the sitemap lists it. That contradiction is open and is Shariful's call, see
the journal. Also note `pageMetadata` in `lib/seo.ts` can only ever turn
noindex ON: a `seo_pages` override cannot switch indexing back on for a page
whose code says index:false, despite comments that claim it can.

`lib/pages-list.ts` is the canonical page list feeding the sitemap and the
admin Pages screen. Header nav and footer chrome are backend-managed via
Supabase (`lib/chrome.ts`) with site.ts values as build-time fallback.

## 8. The Journal ritual (shared brain, non-negotiable)

The `journal` table (admin -> Journal) is the owner-facing record of this
build: the build log, the decision register, and Shariful's idea inbox. It
exists because he iterates fast and chat context compacts; the journal is
what survives. Claude maintains it via `scripts/journal.mjs`:

- **Session start:** run `node scripts/journal.mjs ideas` and address any
  open ideas before or alongside the day's work (discuss, plan, or build;
  move them with `set-status <seq> planned|done|dropped`).
  The list comes back **best rated first**, and anything Shariful has
  answered carries a `>> SHARIFUL SAYS:` note. Both are his direct steer on
  what to build next: a 5/5 outranks your own sense of priority, and the
  note usually matters more than the stars ("yes but only for agencies"
  changes the build; four stars does not). Unrated is not rated-low, it
  means he has not looked yet, so those are still worth raising.
- **After finishing a meaningful piece of approved work** (and after any
  deploy): add a log entry. Founder language, no jargon, follow the copy
  rules. `node scripts/journal.mjs add --kind log --title "..." --body "..."`
- **When Shariful approves a direction:** record it.
  `add --kind decision --title "..." --body "What: ... Why: ..."` and when a
  decision replaces an older one, pass `--supersedes <seq>` so the old card
  flips to superseded instead of vanishing.

Entries are for the owner: plain language, what and why, never code dumps.

## 9. Working agreement (read before every task)

Written after a week where the platform grew faster than the discipline
around it: work was deployed without being asked for, a curated sales page
was silently rewired, a shared component shipped a bug that broke typing in
every form, and a plan was built on assumptions instead of on the owner's
process. None of that was a tooling failure. These are the rules that
prevent the repeat.

**1. State the scope before building.** One line on what is being done, the
files or areas it touches, and explicitly **what will not be touched**.
Anything outside that list needs a yes first.

**2. Flag root causes, do not fix them unasked.** Noticing that a page reads
the wrong data source is useful. Rewiring it inside a task about something
else is not. Say what is wrong, offer to fix it, wait.

**3. Never deploy without being asked.** Build, run the gates, verify in a
browser, report, stop. `git push origin design-update:main` happens when
Shariful says so, never as the end of a task. Committing locally is fine.

**4. Shared code is a blast radius.** `components/portal/ui.tsx`,
`components/portal/board/`, `lib/pipeline.ts`, `lib/projects.ts` and anything
in `lib/email/` are used by screens far from the one being worked on. Name
that out loud before changing them, and check at least two other callers
afterwards.

**5. Use the thing, do not photograph it.** A screenshot proves a screen
renders, never that it works. Type a whole sentence into the field, submit
the form, reopen the page, press the button twice. The modal that lost focus
after one character passed a screenshot review.

**6. Stop and check at the size limit.** If a fix is heading past roughly
five files or two hundred lines, it has become a different task. Say so and
confirm before continuing.

**7. Small and reversible beats clever and broad.** When two fixes are
available, prefer the one that changes less. The best outcome of most tasks
is a diff the owner can read in a minute.

**8. Before asking for a deploy, run `npm run check:live`.** It is the four
world-state checks (price drift, deliverables, composition, demo account)
that deliberately do NOT gate the build, because a bad state must never
block deploying its own fix.

## 10. Quality floor

Responsive from 320px. Visible keyboard focus everywhere. Reduced motion
respected. Pinch zoom never disabled. Per-page metadata + canonical; new
pages get added to `lib/pages-list.ts`. No console errors. `npx tsc
--noEmit`, `npm run lint`, and `npm run build` must pass clean; screenshot
changed screens at desktop and mobile before calling them done. If a screen
feels templated, push it once more.

**Judge a build by its exit code, never by reading its output.** `prebuild`
runs the tests plus check:tokens, check:leaks and check:portal-ui, and a
failure there prints text that matches no obvious keyword. Piping the build
through `grep` to skim it can therefore show a screen full of passing gates
while the command exited 1. That happened, and because `git push` still
succeeds when Vercel's build does not, production sat nine commits behind
while every push looked green. Run it as `npm run build > /tmp/build.log
2>&1; echo $?` and believe the number. Same rule for the check: scripts. A
push is not a deploy: confirm the deployment went green before saying it
shipped.
