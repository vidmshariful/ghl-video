---
name: ghlvideo-design
description: The locked design system for the GHL Video platform. Load before writing or changing ANY user-facing UI on this repo: marketing pages, the three portals, checkout, or the sales landing pages. Covers the four-surface skin rule, the exact design tokens that exist, radius and colour discipline, the anti-generic mandate, and the copy rules. Use for "restyle", "redesign", "new page", "new screen", "change the look", or any visual work here.
---

# GHL Video design system

The generic design skills (frontend-design, ui-ux-pro-max, web-design-guidelines)
are good at taste. They do not know THIS platform. This file wins where they
disagree, because this system is locked by client decision.

Read `CLAUDE.md` section 5 for the why. This is the how.

## 1. Four surfaces, four skins. Never leak between them.

The single most expensive mistake on this repo is restyling one surface and
changing another. Each surface has its own skin block:

| Surface | Lives in | Skin to edit |
|---|---|---|
| Main site | `app/(site)` | the `:root` defaults in `app/globals.css` |
| Portals (`/admin`, `/portal`, `/partners`) | `app/admin`, `app/portal`, `app/partners` | the `[data-surface="portal"]` block |
| Checkout | `app/checkout` | the `[data-surface="checkout"]` block |
| Sales landing pages | `app/(sales)` | `app/(sales)/sales.css`, the `.sp` system |

**To restyle a surface, edit ONLY its skin block.** If a change belongs to two
surfaces, fork the value into each skin rather than editing a shared token.

Shared across all surfaces on purpose, and only these: the brand core (the three
accents, the gradient, the glows, `--error`, the two typefaces) plus the
top-level shared components (`Logo`, `GhlMark`, chat).

`eslint.config.mjs` enforces this with `no-restricted-imports` per part. If a
build fails on a cross-part import, the import is the bug, not the rule.

## 2. Tokens that actually exist

Using a token that does not exist fails silently: the class is dropped and the
element renders at browser default size. Check here before typing a class.

**Type scale.** There is no `text-h1`. The scale is:

```
text-hero      the one big page-opening headline
text-h2        section headings AND article <h1>s
text-h3        sub-sections
text-h4        card titles
text-lede      the paragraph under a headline
text-body      default copy
text-body-sm   secondary copy, table cells
text-label     mono, uppercase, wide tracking. chips, meta, table headers
text-price     tabular money
text-stat-lg   big numbers on stat cards
```

**Measure:** `--measure-body`, `--measure-lede`. Use them, do not invent max-widths
for prose.

**Radius, deliberately tight:**
- `rounded-card` (4px) and `rounded-media` (4px) for containers
- 3px for controls: buttons, inputs
- `rounded-full` for dots and avatars ONLY
- no other radii. A `rounded-xl` in a diff is a mistake.

Note the portal skin forks radius to 8px/12px on purpose; inside `/admin`,
`/portal`, `/partners` the existing `rounded-[8px]` and `rounded-[12px]` values
are correct and should be matched.

**Colour, the live values:**
```
--gold:#FCC000  --blue:#0090FC  --green:#00CC00
--brand-gradient: linear-gradient(100deg,#FCC000,#00CC00)
--canvas:#08090D  --surface:#111219  --card:#161821  --hair:#2b2f40
--text:#EEF0F6  --muted:#9096A8  --dim:#7d8499  --error:#FF6B6B
```

## 3. Colour discipline

- Roughly 70% canvas, 20% one lead accent per section, 10% support.
- **One accent leads per section.** Never all three at equal weight.
- **Green never stands alone** as a screen's only accent.
- The gradient is the signature, reserved for: the hero accent word, primary
  buttons, ambient glows. Not decoration.
- Buttons on bright fills use near-black text (`#08090D`), never white.
- Borders are hairlines at low opacity. Soft radial glows over drop shadows.
- The homepage is a hybrid: dark heroes and footer (hard rule), `theme-light`
  bands for the proof and people sections.

## 4. The anti-generic mandate

These are banned. They are what makes AI-built sites look AI-built:

- the pill-badge, centered, three-line SaaS hero stack
- three identical feature cards in a row
- decorative icon dumps
- gradient on everything
- emoji as UI
- scattered fade-ups on every element

Instead: video is the hero. Motion serves the product (hover-play cards, one
orchestrated hero moment). If a screen feels templated, push it once more.

## 4b. Portal forms open in the Modal, never inline

Every add or edit form on every portal surface (admin, customer portal,
partner portal) opens in the shared `Modal` from `components/portal/ui`
(admin code may use its `AdminModal` alias). A form that expands inline and
pushes the page down is a defect (owner decision, 22 August 2026). The
Modal specimen lives on `/uikits/portal`. Side-panel exceptions: full-page
editors (blog posts, email templates) which are screens, not forms.

Two things that used to be exceptions and no longer are. Opening a request
in the CUSTOMER portal is a centred `Modal` (owner decision, 25 August 2026).
Opening one on the admin editing board is a FULL PAGE, like a production job
(owner decision, 28 August 2026): the request carries the brief, the footage,
the cut, the client's feedback thread and a player to watch it against, and
that never fitted in a panel a third of the width. Do not put either back in
a side panel.

## 5. Motion

GSAP + Framer Motion. Reveals go through the `Reveal` / `RevealItem` wrapper,
not ad-hoc animation. Respect `prefers-reduced-motion` every time.

## 6. Copy rules, enforced in every string

- **No em dashes, no en dashes, no middle dots, no ellipsis characters.**
  Periods, commas, colons. This is the most frequently broken rule; check your
  own output before saving.
- CTA vocabulary is fixed, and the labels live in `cta` in `lib/site.ts`. Use
  those exports: **Book a Call, Order Now, Start editing, Request a Quote**.
  Never "Get Started" or "Learn More".
- Client count is **1000+** everywhere. Never 800+ or 376+.
- "teams" is never a client-count word. Use "clients" or "HighLevel SaaS".
- Studio authority date is **2020**, phrased "creating HighLevel videos since
  2020". No other years in customer copy.
- Never print the Google review count. Say every review is five stars.
- Voice: founder to founder. Direct, outcome-led, no hype. The reader knows MRR,
  CAC, LTV, churn.
- Footer brand line is "A brand of Vidiosa LLC". Never Magic Motion Production.
- The HighLevel non-affiliation disclaimer stays in every footer.

## 7. Content and price truth

`lib/site.ts` is the single content source: every price, plan, video, pack,
bundle, nav item, CTA label. **Never hardcode copy or prices in a component.**
After changing a price: deploy, then run admin -> Products -> "Sync from catalog".

## 8. Before calling a screen done

1. `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run check:drift`
   must all pass.
2. Screenshot the changed screen at **desktop and 375px mobile**. Not one or the
   other.
3. Responsive from 320px. Visible keyboard focus. Reduced motion respected.
   Pinch zoom never disabled.
4. No console errors.
5. New page? Add it to `lib/pages-list.ts` (it feeds the sitemap and the admin
   Pages screen) and give it per-page metadata plus a canonical.
6. Run the `ghlvideo-ui-audit` skill on the screen for the mechanical checks.
