# GHL Video Website — Build Brief for Claude Code

This is the single source of truth for building the new GHL Video website. Read it fully before writing any code. Drop it in the repo root as `CLAUDE.md` (or `docs/BUILD_BRIEF.md`) so it stays loaded during the build.

The goal in one line: a **bold, modern, clean** marketing site for a HighLevel video studio that looks like a **human design studio made it**, not a generated template. If the output could be mistaken for a default AI website, it has failed the brief.

---

## 0. How to work

Do this in two passes, like a design lead who has already had one proposal rejected for looking templated.

1. **Plan pass.** Before coding, write a short design plan: the token system (color, type, layout, the one signature element), plus ASCII wireframes for the homepage and one service page. Critique it against Section 5 below. If any part reads like the generic default you would produce for any SaaS site, change it and note why. Do this in your own working notes.
2. **Build pass.** Only after the plan survives critique, write the code, deriving every color and type decision from the plan. Take screenshots as you go and critique against the reference feel. Remove one "accessory" from every screen before calling it done.

Do not show half-formed screens. Get a page to a high bar, screenshot, critique, then move on.

---

## 1. Skills to load

These are Anthropic Agent Skills. Load the design one before styling anything.

- **frontend-design** — the key skill for this build. Distinctive, non-templated visual design: palette, type pairing, layout, restraint, and the two-pass plan-then-critique process. If it is available in this environment, read it first. Its core principles are also distilled into Section 5 so this brief stands alone.
- **webapp-testing** — use for QA: drive the built site in a headless browser, take screenshots, check responsive breakpoints and interactions.
- **canvas-design** — only if you need to generate any static brand art or an OG image.

How to get the official skills in Claude Code:

```
/plugin marketplace add anthropics/skills
```

Then install the relevant plugin (for example `example-skills`) and mention the skill by name while working. References:

- Skills repo: https://github.com/anthropics/skills
- What are skills: https://support.claude.com/en/articles/12512176-what-are-skills
- Using skills in Claude: https://support.claude.com/en/articles/12512180-using-skills-in-claude
- Agent Skills engineering post: https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills

If a skill is not installed here, proceed anyway. This brief carries the distilled design guidance.

---

## 2. Project overview

GHL Video is the specialized video studio built only for the HighLevel ecosystem. The site sells three services and routes buyers to an external checkout.

- **Premade Videos** — $495 flat each. Ten videos at launch. Self-serve.
- **Custom Production** — four formats with published starting prices, converts to a quote form or a call.
- **Video Editing** — three monthly subscription plans, aimed at HighLevel content creators.

Two audiences: HighLevel SaaS resellers (premade and custom) and HighLevel creators (editing). Checkout, booking, and forms run on the existing HighLevel LeadConnector stack at `order.ghlvideo.com`. Do not build a payment system.

Full page specs live in the companion file `ghlvideo-final-website-plan`. Brand and rules live in `ghlvideo-company-profile-detailed`. This brief governs how it gets built.

---

## 3. Tech stack and setup

- **Next.js** (App Router, TypeScript, React Server Components where sensible).
- **Tailwind CSS** for styling, with the brand tokens wired into the config. Do not ship default Tailwind grays or the default blue. Every color comes from Section 4.
- **Framer Motion** for animation.
- **next/font** to self-host the three typefaces (no layout shift).
- **Content as typed config or MDX.** Prices, plans, and the video list live in one typed data file (`/content` or `/lib/site.ts`), never hardcoded per component, so nothing drifts.
- **Deploy target: Cloudflare Pages** (free, commercial use allowed). Keep the build adapter-compatible.
- **No browser storage** unless a feature needs it. No analytics beyond what the client already uses.

Suggested structure:

```
/app
  /(marketing)/page.tsx            # home
  /premade/page.tsx
  /custom/page.tsx
  /quote/page.tsx
  /editing/page.tsx
  /about/page.tsx
  /contact/page.tsx
  /legal/[doc]/page.tsx
/components   (Header, Footer, Button, VideoCard, PricingTier, Marquee, Reveal, ...)
/lib/site.ts (the locked spec: prices, plans, videos, clients, links)
/content     (MDX if used)
/styles/globals.css (tokens)
```

Set up redirects from the old WordPress URLs (the plan lists them). Preserve URL structure or 301 everything one to one. Rankings depend on it.

---

## 4. Design system (locked tokens)

Pulled pixel-exact from the logo. These do not change.

```css
:root{
  /* brand */
  --gold:#FCC000;   /* prices, stats, attention */
  --blue:#0090FC;   /* links, cool accent */
  --green:#00CC00;  /* primary action, active states */
  --brand-gradient: linear-gradient(100deg, #FCC000, #00CC00); /* signature */

  /* surfaces (near-black, never flat gray) */
  --canvas:#08090D;
  --surface:#111219;
  --card:#161821;
  --hair:#242736;

  /* text */
  --text:#EEF0F6;
  --muted:#9096A8;
  --dim:#5A6076;

  --error:#FF6B6B; /* form errors only */
}
```

Typography (self-host with next/font; updated July 2026 by client direction, superseding the original Space Grotesk / Inter / JetBrains Mono spec):

- **Display: Archivo** (600). Big, tight tracking, headlines that fill the viewport. Google Fonts.
- **Body and labels: Raveo Display** (400 to 700), by Jakub Foglar, SIL OFL 1.1, self-hosted in `app/fonts/`. Two typefaces only; the utility/label voice is Raveo Display with wide letter-spacing, not a mono face.

Type scale: set a real scale with intentional jumps, not a flat ramp. The hero headline should be dramatically larger than everything else. Use tight negative letter-spacing on display sizes.

Other tokens:

- Radius: generous and consistent (12 to 18px on cards, pills fully round). Do not mix five radii.
- Borders: 1px hairlines at low opacity for structure.
- Depth: use soft radial gradient glows behind the hero and section headers (gold and green, low opacity) instead of heavy drop shadows. Add a very subtle grain overlay to keep the dark from going flat.
- Buttons on bright fills use near-black text (`#08090D`), not white.

Color discipline (this is what keeps three bright colors from looking like a toy): roughly **70 percent canvas, 20 percent one lead accent per section, 10 percent support**. One accent leads per section. Never all three at equal weight in one component.

---

## 5. The anti-generic mandate (most important section)

The client explicitly rejects the "AI website look." Read this twice.

### 5.1 Know the three AI-default looks and avoid them

Current generated design clusters around three tells. Do not land on any of them:

1. Warm cream background with a high-contrast serif and a terracotta or clay accent.
2. **Near-black background with a single bright acid-green accent.**
3. Broadsheet layout with hairline rules, zero border-radius, and dense newspaper columns.

**Critical:** this brand is near-black plus a bright green. That is dangerously close to cluster 2. The colors are locked because they come from the logo, so we keep them, but we must **out-execute the default** so it never reads as generic. The differentiators are non-negotiable:

- **Gold is a co-lead, not a footnote.** The default look uses one accent. We use a two-color system led by the **gold to green gradient**, with blue as a cool third. That alone breaks the single-acid-green cluster.
- **The gradient is the signature,** used on the hero accent word, the primary button, and the ambient glow. Green never appears alone as the only accent on a screen.
- **Video is the hero, not a big number.** See 5.3.

### 5.2 Template tells to avoid

Do not ship any of these without a specific reason:

- A hero that is a big number with a small label plus a gradient. That is the template answer.
- The pill-badge, headline, subheadline, two-buttons stack, perfectly centered, that every SaaS hero uses.
- Three evenly spaced feature cards with identical icons and identical lengths.
- Generic icon sets dropped in for decoration. If you use icons, use few, and make them earn their place.
- Gradient on everything. The gradient is a signature, so it stays rare.
- Everything centered and evenly weighted. Symmetry with no tension reads as generated.
- Emoji as UI. None.
- Over-animation. Scattered fade-ups on every element is a tell. See Section 6.
- Placeholder lorem. Use the real copy from the plan and profile.

### 5.3 What makes it read human-designed

- **Spend boldness in one place.** The signature moment for GHL Video is the **video-first hero**: a silent, muted, autoplay showreel loop behind an oversized gradient headline, plus **video cards that play on hover** in the premade grid. That is the memorable thing. Keep everything around it quiet and disciplined. A studio that sells video should feel like video the instant the page loads.
- **Editorial, asymmetric layout.** Break the grid on purpose in one or two places. Let a headline sit left and heavy, let one section be off-center, let whitespace be generous but uneven. Intentional imbalance reads as human.
- **Make the type the personality.** Real scale contrast, a display face used with confidence, mono labels that feel like a spec sheet. The type treatment itself should be memorable, not a neutral delivery of text.
- **Structural devices must mean something.** Only number things that are an actual sequence (a process, a real timeline). Do not decorate with 01 / 02 / 03 unless the order carries information.
- **Microdetail.** Considered hover states, focus states, an intentional footer, a real empty state on the quote form. The small stuff is where human care shows.
- **Match complexity to vision.** This is a bold minimal direction, so win it with precision in spacing, type, and motion, not with more elements.

### 5.4 The signature, stated once

The one element this site is remembered by: **motion-as-product**. The homepage opens on moving work, and the premade grid comes alive on hover. Everything else stays calm so this lands. If you add a second showy idea, cut it.

---

## 6. Motion and interaction (Framer Motion)

Motion serves the subject or it does not ship. Restraint is the difference between polished and AI-generated.

- **Hero:** the showreel loop plays immediately (muted, `playsInline`, `loop`, low-weight poster for first paint). A short, orchestrated headline reveal on load is fine. One orchestrated moment, not ten.
- **Scroll reveals:** subtle, staggered, once. Small translate and opacity, short duration. Do not fade up every single element on every section. Reveal groups, not atoms.
- **Video cards:** play on hover, pause on leave. This is the core interaction, make it smooth.
- **Buttons:** a small, tasteful hover and press state. Optional light magnetic effect on the primary CTA only.
- **Marquee:** client logos scroll slowly. Pause on hover.
- **Counts:** the 800+ stat may count up once on first view.
- **Respect `prefers-reduced-motion`:** disable non-essential motion and never autoplay aggressive movement for those users. The showreel can still show a static poster.

If a motion does not help the user understand or feel the brand, remove it.

---

## 7. Routes and information architecture

```
/                Homepage
/premade         Premade Videos (10 cards, $495 each)
/custom          Custom Production (4 formats, from-pricing)
/quote           Quote Request (simple form)
/editing         Video Editing (3 plans)
/about           About and founder
/contact         Contact and Book a Call
/legal/privacy   /legal/terms   /legal/refund
```

Header nav on every page, identical: **Premade, Custom, Editing, About**, plus a persistent glowing **Book a Call** button. Sticky, condenses on scroll.

CTA vocabulary is fixed. Use exactly: **Book a Call, Order for $495, Start editing, Request a Quote**. Never "Get Started" or "Learn More".

---

## 8. Page build specs (summary)

Full section-by-section detail is in `ghlvideo-final-website-plan`. Build to that. Summary of intent:

- **Home:** showreel hero, trust strip (logos, 800+, 5.0), three-service bento that routes out, a showreel moment, why-GHL-Video points, a two-audience split (resellers and creators), named testimonials, closing CTA.
- **Premade:** flat-$495 hero, a grid of 10 hover-play video cards each with a per-SKU Order button, what-is-included, how-it-works, cross-sell to custom and editing, FAQ.
- **Custom:** hero, the four formats with starting prices and samples, how pricing works, six-step process, who-it-is-for, proof. Primary CTA Request a Quote, secondary Book a Call.
- **Quote:** simple form, five fields max, 24-hour-reply confirmation, LeadConnector.
- **Editing:** creator-focused hero, three priced plans (Growth marked most chosen), all-plans line, before-and-after samples, who-it-is-for, how-it-works, FAQ. Per-plan Start button to external checkout.
- **About:** category story, founder POV, in-house proof, named clients and 800+, the Vidiosa line and disclaimer.
- **Contact:** headline, LeadConnector booking widget, fallback form and email, light proof.

---

## 9. Content data model (the locked spec)

Put all of this in one typed file so pages read from it and nothing drifts.

```ts
// lib/site.ts (shape, fill exact copy from the plan)

export const clients = 800;               // render as "800+"
export const rating = 5.0;
export const namedClients = [
  { name: "Dominic Bavaro", role: "CEO", company: "Emma.io" },
  { name: "Ryan Maule", role: "CEO", company: "AI Clinic Assist" },
  { name: "David Allen Neron", role: "CEO", company: "NeoLuxLabs" },
];

export const premadePrice = 495;          // flat, every premade

// 10 placeholder videos for the template. Swap for the real list later.
export const premadeVideos = Array.from({length:10}).map((_,i)=>({
  slug: `video-${i+1}`,
  title: `Premade Video ${i+1}`,           // placeholder
  purpose: "One line on what this video is for",
  price: 495,
  preview: "/previews/placeholder.mp4",
  orderUrl: `https://order.ghlvideo.com/video-${i+1}`, // per SKU
}));

export const customFormats = [
  { name: "Ads / Promo",        from: 1500 },
  { name: "Explainer",          from: 2500 },
  { name: "Demo",               from: 3500 },
  { name: "Onboarding Series",  from: 5000 },
];

export const editingPlans = [
  { name: "Starter", price: 595,  longForm: 2, longFormNote: "up to 15 min each", shortForm: 4,  featured:false, orderUrl:"https://order.ghlvideo.com/editing-starter" },
  { name: "Growth",  price: 995,  longForm: 4, shortForm: 8,  featured:true,  orderUrl:"https://order.ghlvideo.com/editing-growth" },
  { name: "Scale",   price: 1795, longForm: 8, shortForm: 16, featured:false, note:"priority queue", orderUrl:"https://order.ghlvideo.com/editing-scale" },
];

export const editingAllPlans = "No contracts, unlimited revisions, edited by a HighLevel-fluent team.";

export const entityLine = "A brand of Vidiosa LLC";
export const disclaimer = "GHL Video is not affiliated with or endorsed by GoHighLevel Inc.";
export const otherBrands = [
  { name: "growX",   url: "https://growx.studio" },
  { name: "socialX", url: "https://socialx.studio" },
];
```

The 10 premade videos are placeholders. Build the grid and layout final around them. The real titles, previews, and SKUs drop in later with no layout change.

---

## 10. Components to build

- `Header` (sticky, condensing, glowing Book a Call button).
- `Footer` (see Section 11).
- `Button` (variants: gradient primary, green solid, blue ghost).
- `VideoCard` (hover-play preview, title, purpose, price, per-SKU order button).
- `PricingTier` (editing plans, featured state on Growth).
- `CustomFormatCard` (name, from-price, sample).
- `Marquee` (client logos).
- `Reveal` (scroll-reveal wrapper, respects reduced motion).
- `Stat` (count-up).
- `QuoteForm` (5 fields, LeadConnector embed or POST).
- `BookingEmbed` (LeadConnector calendar).
- `SectionHeading`, `Eyebrow`, `GradientText`.

Keep components brand-tokened. If you use shadcn/ui, restyle every primitive to the tokens. Do not ship default shadcn look.

---

## 11. Footer (build exactly)

Four columns, identical on every page:

1. **Brand column:** logo, one-line ("Video built for HighLevel SaaS. Fast, custom, done."), and the line **"A brand of Vidiosa LLC"**.
2. **Services:** Premade Videos, Custom Production, Video Editing.
3. **Company:** About, Contact, Book a Call.
4. **Our Other Brands:** growX (growx.studio) and socialX (socialx.studio), as linked items under that heading.

Optional email capture band above the columns: "New AI-first videos as HighLevel ships them." Bottom row: `hi@ghlvideo.com`, the legal links (Privacy, Terms, Refund), and the disclaimer.

---

## 12. External integrations

- **Checkout:** every premade card and every editing plan links to its own pre-loaded URL on `order.ghlvideo.com`. No cart, no on-site payment.
- **Booking:** embed the LeadConnector calendar on `/contact`.
- **Quote and contact forms:** LeadConnector forms. Keep the quote form to five fields.

Treat these as embeds or outbound links. Do not rebuild them.

---

## 13. Copy rules (enforce in every string)

- No em dashes, no en dashes, no middle dots, no ellipsis characters. Use periods, commas, colons.
- No year printed in customer copy. Frame authority as the original, most established HighLevel-only video team.
- Client count is **800+** everywhere, one figure, never a different number.
- Founder-to-founder voice. Direct, outcome-led, no hype, no filler. Assume the reader knows MRR, CAC, LTV, churn. Do not explain SaaS basics.
- Buttons name the action and keep the name through the flow.
- Do not imply HighLevel affiliation. Disclaimer on every footer.
- Do not reference retired offers (old bundles, old library, legacy pricing).

---

## 14. Quality floor (definition of done)

- Responsive from 320px up. Test real breakpoints with the webapp-testing skill.
- Visible keyboard focus on every interactive element. `prefers-reduced-motion` respected.
- Re-enable pinch zoom (do not set `user-scalable=0` or `maximum-scale=1`).
- Lighthouse: strong performance, accessibility, and SEO. Optimize video posters and lazy-load offscreen media. LCP element should not be a heavy autoplay video weight, use a light poster.
- Per-page metadata (title, description, OG image). Sitemap and robots. 301s from old URLs verified.
- No console errors. No layout shift on font load.
- Screenshot every page at desktop and mobile, critique against Section 5, fix the weakest screen, repeat once.

---

## 15. Reference files

- `ghlvideo-final-website-plan` — page-by-page sections, nav, footer, flows, build order.
- `ghlvideo-company-profile-detailed` — positioning, dual ICP, pricing, guardrails, voice.
- `ghlvideo-brand-color-system` — the palette and usage discipline in depth.

Build order: foundation and tokens, then homepage (proves the whole look), then the three service pages, then quote and contact, then about and legal, then QA and cutover. Swap the real 10 premade videos in last.

Ship something that a design studio would be proud to put in a portfolio. If a screen feels safe, push it once more.
