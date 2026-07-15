import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { CellGrid, FitSplit } from "@/components/CellGrid";
import { Checklist } from "@/components/Checklist";
import { DrawnIcon, type IconName } from "@/components/DrawnIcon";
import { EmbedSlot } from "@/components/EmbedSlot";
import { FaqList } from "@/components/FaqList";
import { MediaCard } from "@/components/MediaCard";
import { PricingTier } from "@/components/PricingTier";
import { ReviewCard } from "@/components/ReviewCard";
import { SectionChip } from "@/components/SectionChip";
import { SectionHead } from "@/components/SectionHead";
import { EditorialPoints } from "@/components/sections/EditorialPoints";
import { Filmstrip } from "@/components/sections/Filmstrip";
import { ProcessSpine } from "@/components/sections/ProcessSpine";
import { DsSection, SpecRow, Specimen, Stage } from "./ds";
import { editingPlans, home, newSamples, pages } from "@/lib/site";

/* Internal reference. Crawlable but never indexed, absent from the
 * sitemap, and linked from nothing: the way to keep a URL out of search
 * is noindex, not a robots disallow, which only advertises it. */
export const metadata: Metadata = {
  title: "Design system",
  description: "Internal reference for the GHL Video design system.",
  robots: { index: false, follow: false },
};

const ICONS: IconName[] = [
  "badge-check", "building", "calendar-check", "clapperboard", "clock",
  "crosshair", "globe", "layout", "lock", "message", "mic", "monitor-play",
  "mouse-click", "package-check", "palette", "pen-line", "scissors", "send",
  "tags", "upload", "zap",
];

const TYPE_SCALE = [
  { t: "text-hero", v: "clamp(2.5rem, 5vw, 4.25rem)", px: "65px", use: "page hero, once per page" },
  { t: "text-h2", v: "clamp(2rem, 3.4vw, 3.25rem)", px: "50px", use: "section headline" },
  { t: "text-stat-lg", v: "2.25rem", px: "34px", use: "the one big figure" },
  { t: "text-h3", v: "clamp(1.5rem, 2vw, 1.625rem)", px: "25px", use: "card and step titles" },
  { t: "text-price", v: "1.375rem", px: "21px", use: "prices, stat figures" },
  { t: "text-lede", v: "1.125rem", px: "17px", use: "section intro, hero lede" },
  { t: "text-h4", v: "1.0625rem", px: "16px", use: "cell and card titles" },
  { t: "text-body", v: "0.9375rem", px: "14px", use: "all body copy" },
  { t: "text-body-sm", v: "0.8125rem", px: "13px", use: "dense meta" },
  { t: "text-label", v: "0.6875rem", px: "10px", use: "mono labels, chips, eyebrows" },
];

const COLORS = [
  { g: "Brand", items: [
    { n: "--gold", h: "#FCC000", c: "bg-gold", note: "the lead accent. Prices, figures, chip numerals." },
    { n: "--green", h: "#00CC00", c: "bg-green", note: "gradient end only. Never a solo accent." },
    { n: "--blue", h: "#0090FC", c: "bg-blue", note: "defined, currently unused. See note in 01." },
  ]},
  { g: "Surface", items: [
    { n: "--canvas", h: "#08090D", c: "bg-canvas", note: "the page ground. ~70% of every screen." },
    { n: "--surface", h: "#111219", c: "bg-surface", note: "raised: chips, cards, review cards." },
    { n: "--card", h: "#161821", c: "bg-card", note: "the lightest ground we put text on." },
    { n: "--hair", h: "#2B2F40", c: "bg-hair", note: "every 1px rule and border on the site." },
  ]},
  { g: "Text", items: [
    { n: "--text / text-ink", h: "#EEF0F6", c: "bg-ink", note: "headlines and primary copy." },
    { n: "--muted", h: "#9096A8", c: "bg-muted", note: "body copy. 6.0:1 on card." },
    { n: "--dim", h: "#7D8499", c: "bg-dim", note: "mono microlabels. 4.75:1 on card, the floor." },
    { n: "--error", h: "#FF6B6B", c: "bg-error", note: "form errors only." },
  ]},
];

export default function DesignSystemPage() {
  const p = pages.custom;
  const e = pages.editing;
  const reviews = home.reviews.items;

  return (
    <div className="section-pad-sm hero-pad">
      <div className="shell">
        {/* masthead */}
        <header>
          <p className="font-mono text-label uppercase text-gold">
            [ Internal ] Not indexed, not in the nav, not in the sitemap
          </p>
          <h1 className="mt-6 max-w-[16ch] font-display text-hero text-ink">
            The design <span className="text-gradient">system.</span>
          </h1>
          <p className="mt-6 max-w-[var(--measure-lede)] text-lede text-muted">
            Every token and every section form in one place, so a form can
            be judged next to the others before it goes near a page.
            Specimens marked{" "}
            <span className="font-mono text-label uppercase text-gold">
              proposed
            </span>{" "}
            are not used anywhere yet.
          </p>
          <nav className="mt-10 flex flex-wrap gap-x-3 gap-y-2" aria-label="Contents">
            {[
              ["01 Color", "color"],
              ["02 Type", "type"],
              ["03 Space", "space"],
              ["04 Surface", "surface"],
              ["05 Elements", "elements"],
              ["06 Cards", "cards"],
              ["07 Section forms: current", "forms-current"],
              ["08 Section forms: proposed", "forms-proposed"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={`#${href}`}
                className="tap inline-flex items-center rounded-full border border-hair bg-surface px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
              >
                {label}
              </a>
            ))}
          </nav>
        </header>

        <div className="mt-20 grid gap-20">
          {/* ---------------------------------------------- 01 color */}
          <DsSection
            id="color"
            n="01"
            title="Color"
            intro="Three brand colors, four surfaces, four text tiers. The discipline is roughly 70% canvas, 20% one lead accent, 10% support. Gold leads; green exists to end the gradient; blue is defined but currently paints nothing."
          >
            <div className="grid gap-10 lg:grid-cols-3">
              {COLORS.map((group) => (
                <div key={group.g}>
                  <p className="font-mono text-label uppercase text-dim">
                    {group.g}
                  </p>
                  <div className="mt-5 grid gap-5">
                    {group.items.map((c) => (
                      <div key={c.n} className="flex gap-4">
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 h-12 w-12 shrink-0 rounded-[4px] border border-hair ${c.c}`}
                        />
                        <div className="min-w-0">
                          <p className="font-mono text-body-sm text-ink">
                            {c.n}
                          </p>
                          <p className="font-mono text-label uppercase text-dim">
                            {c.h}
                          </p>
                          <p className="mt-1.5 text-body-sm leading-relaxed text-muted">
                            {c.note}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-2">
              <Specimen
                name="The gradient"
                note="The signature. Four uses only: the hero accent word, the primary button, the ambient glow, and the filmstrip track where left-to-right means progression. Everywhere else it stays off."
              >
                <div className="h-24 rounded-card bg-brand-gradient" />
                <p className="mt-3 font-mono text-label uppercase text-dim">
                  linear-gradient(100deg, #FCC000, #00CC00)
                </p>
              </Specimen>
              <Specimen
                name="Text on the gradient"
                note="Near-black, never white. 9.13:1 at the green stop, which is the worst case and still double AA."
              >
                <div className="flex h-24 items-center justify-center rounded-card bg-brand-gradient">
                  <span className="font-display text-h3 text-canvas">
                    #08090D on the gradient
                  </span>
                </div>
              </Specimen>
            </div>
          </DsSection>

          {/* ---------------------------------------------- 02 type */}
          <DsSection
            id="type"
            n="02"
            title="Type"
            intro="Archivo for display, Raveo Display for body and labels. Ten sizes, and nothing outside them. Above 1024px the root font-size is fluid, so every rem below scales with the viewport: the px column is measured at 1440."
          >
            <div className="grid gap-px overflow-hidden rounded-card border border-hair bg-hair">
              {TYPE_SCALE.map((t) => (
                <div
                  key={t.t}
                  className="grid gap-4 bg-canvas px-6 py-6 md:grid-cols-[14rem_1fr] md:items-baseline md:px-8"
                >
                  <div>
                    <p className="font-mono text-body-sm text-gold">{t.t}</p>
                    <p className="font-mono text-label uppercase text-dim">
                      {t.v} / {t.px}
                    </p>
                    <p className="mt-1 text-body-sm text-muted">{t.use}</p>
                  </div>
                  <p
                    className={`${t.t} ${t.t.startsWith("text-h") || t.t === "text-hero" ? "font-display" : ""} ${t.t === "text-label" ? "font-mono uppercase" : ""} truncate text-ink`}
                  >
                    Video built for HighLevel SaaS
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-2">
              <Specimen name="Display: Archivo 600" note="Tight negative tracking. Headlines balance automatically (text-wrap: balance), so headline width caps set line count, not measure.">
                <Stage>
                  <p className="font-display text-h2 text-ink">
                    Built from scratch for{" "}
                    <span className="text-gradient">your platform.</span>
                  </p>
                </Stage>
              </Specimen>
              <Specimen name="Body and label: Raveo Display" note="The utility voice is Raveo with wide letter-spacing, not a mono face. font-mono is an alias to it.">
                <Stage>
                  <p className="font-mono text-label uppercase text-dim">
                    [ 01 ] The label voice
                  </p>
                  <p className="mt-4 max-w-[var(--measure-body)] text-body leading-relaxed text-muted">
                    Body copy sits at 60 to 75 characters a line. Nothing on
                    the site runs past 75.
                  </p>
                </Stage>
              </Specimen>
            </div>
          </DsSection>

          {/* ---------------------------------------------- 03 space */}
          <DsSection
            id="space"
            n="03"
            title="Space and measure"
            intro="Three section rhythms and two reading measures. Ad hoc padding is what made the page breathe at six different rates, so anything not on this list is a bug."
          >
            <div className="grid gap-10 lg:grid-cols-2">
              <div>
                <p className="font-mono text-label uppercase text-dim">
                  Section rhythm
                </p>
                <div className="mt-5">
                  <SpecRow k="hero-pad" v="144 / 153" extra="mobile / 1440" />
                  <SpecRow k="section-pad" v="80 / 114" extra="the standard, 31 of 46" />
                  <SpecRow k="section-pad-sm" v="64 / 76" extra="short utility sections" />
                </div>
                <p className="mt-4 text-body-sm leading-relaxed text-dim">
                  Two sections keep their own rhythm on purpose: the home hero
                  (a bounded panel, whose border is its start line) and
                  contact&apos;s second half (no top padding, it continues the
                  block above).
                </p>
              </div>
              <div>
                <p className="font-mono text-label uppercase text-dim">
                  Reading measure
                </p>
                <div className="mt-5">
                  <SpecRow k="--measure-lede" v="52ch" extra="section intros, hero lede" />
                  <SpecRow k="--measure-body" v="68ch" extra="all body copy" />
                </div>
                <p className="mt-4 text-body-sm leading-relaxed text-dim">
                  In a narrow grid cell the column is already tighter than the
                  cap, so the cap goes inert and the column does the work. It
                  only binds where there is width to give away. Headline caps
                  (14ch to 26ch) are a different axis: they set line count on
                  balanced display type, not measure.
                </p>
              </div>
            </div>
          </DsSection>

          {/* ---------------------------------------------- 04 surface */}
          <DsSection
            id="surface"
            n="04"
            title="Surface, radius, texture"
            intro="Depth comes from hairlines and low radial glow, never heavy drop shadows. A grain overlay keeps the near-black from going flat."
          >
            <div className="grid gap-5 md:grid-cols-3">
              <Specimen name="Radius" note="Cards 12px, controls 3 to 4px, chips fully round. Three radii, not five.">
                <div className="flex items-end gap-4">
                  <div className="h-20 w-20 rounded-card border border-hair bg-surface" />
                  <div className="h-14 w-14 rounded-[3px] border border-hair bg-surface" />
                  <div className="h-10 w-24 rounded-full border border-hair bg-surface" />
                </div>
              </Specimen>
              <Specimen name="Hatch" note="The drafting seam. Fills the rail gutters beside a ruled section and the hero panel's centre gutter.">
                <div className="hatch h-20 rounded-card border border-hair" />
              </Specimen>
              <Specimen name="Glow" note="One ambient gold field per section, behind the header. Intrinsic radial falloff, so no seams where the section clips it.">
                <div className="relative h-20 overflow-hidden rounded-card border border-hair">
                  <div
                    aria-hidden="true"
                    className="absolute -left-10 -top-16 h-40 w-64"
                    style={{
                      background:
                        "radial-gradient(closest-side, var(--glow-gold), transparent 72%)",
                    }}
                  />
                </div>
              </Specimen>
            </div>
          </DsSection>

          {/* ---------------------------------------------- 05 elements */}
          <DsSection
            id="elements"
            n="05"
            title="Elements"
            intro="The parts a section is assembled from."
          >
            <Specimen name="Buttons" note="One primary style: the gradient. Ghost is the quiet secondary. 'hero' is an alias of primary kept for old call sites. On touch every control is 44px; on a mouse it stays as designed.">
              <Stage>
                <div className="flex flex-wrap items-center gap-4">
                  <Button href="#elements">Primary</Button>
                  <Button href="#elements" variant="ghost">Ghost</Button>
                  <Button href="#elements" size="lg">Primary, large</Button>
                </div>
              </Stage>
            </Specimen>

            <Specimen name="Section chip" usage="45 of 47 sections" note="Every section on the site opens with this. That is the sameness problem: there is currently no other way into a section.">
              <Stage>
                <div className="flex flex-wrap gap-4">
                  <SectionChip index={1} label="The formats" />
                  <SectionChip index={7} label="Made for HighLevel brands" />
                </div>
              </Stage>
            </Specimen>

            <Specimen name="Drawn icons" note="Stroke-drawn, one accent, drawn on reveal. Used only where a cell earns one.">
              <Stage>
                <div className="flex flex-wrap gap-6">
                  {ICONS.map((n) => (
                    <span key={n} title={n}>
                      <DrawnIcon name={n} />
                    </span>
                  ))}
                </div>
              </Stage>
            </Specimen>

            <div className="grid gap-5 md:grid-cols-2">
              <Specimen name="Checklist" note="The tick is functional: a claim ticked off, not decoration.">
                <Stage>
                  <Checklist
                    items={[
                      "4 long-form videos",
                      "8 short-form videos",
                      "Unlimited revisions",
                      "No contract, cancel anytime",
                    ]}
                  />
                </Stage>
              </Specimen>
              <Specimen name="Embed slot" note="A designed placeholder for a LeadConnector form or calendar. The layout is final; the embed drops in with no layout change.">
                <EmbedSlot
                  label="Quote form"
                  note="The real embed replaces this."
                  minH="min-h-[14rem]"
                />
              </Specimen>
            </div>
          </DsSection>

          {/* ---------------------------------------------- 06 cards */}
          <DsSection
            id="cards"
            n="06"
            title="Cards"
            intro="One card anatomy site-wide: meta rides over the footage, the title reads below left, the price and action pin right and never wrap."
          >
            <Specimen name="Media card" usage="home, work, custom, premade">
              <div className="grid gap-5 md:grid-cols-3">
                {newSamples.slice(0, 3).map((s) => (
                  <MediaCard
                    key={s.src}
                    src={s.src}
                    poster={s.poster}
                    title={s.title}
                    meta={s.format}
                  />
                ))}
              </div>
            </Specimen>

            <Specimen name="Review card" usage="home, custom, editing" note="Real Google reviews only. Shared component, so a review looks the same wherever it is quoted.">
              <div className="grid gap-5 md:grid-cols-3">
                {reviews.slice(0, 3).map((r) => (
                  <ReviewCard
                    key={r.name}
                    quote={r.quote}
                    name={r.name}
                    className="h-full"
                  />
                ))}
              </div>
            </Specimen>

            <Specimen name="Pricing tier" usage="editing" note="Price on one line, list price and saving on the next: run as one row and the widest plan wraps where the others do not, which misaligns all three checklists.">
              <div className="grid gap-6 md:grid-cols-3">
                {editingPlans.map((plan) => (
                  <PricingTier key={plan.name} plan={plan} featuredLabel="Most chosen" />
                ))}
              </div>
            </Specimen>
          </DsSection>

          {/* ------------------------------- 07 section forms: current */}
          <DsSection
            id="forms-current"
            n="07"
            title="Section forms: current"
            intro="What every page is built from today. The problem is visible when they are stacked: CellGrid renders six different kinds of content identically, and it appears four times on /custom and three times on /editing."
          >
            <Specimen
              name="Section head"
              status="current"
              usage="every section"
              note="Chip, headline with a gradient accent phrase, optional intro. Left or centered. This is the only way into a section anywhere on the site."
            >
              <Stage>
                <SectionHead
                  index={4}
                  chip={e.how.chip}
                  headline={e.how.headline}
                  accent={e.how.accent}
                  intro="Optional intro line, capped at the lede measure."
                />
              </Stage>
            </Specimen>

            <Specimen
              name="CellGrid, 3 columns"
              status="current"
              usage="custom x4, editing x3"
              note="A hairline mesh of solid cells. Correct for a spec sheet. It is currently also doing concepts, sequences, pricing rules and pain points, which is why the pages read as one shape on a loop."
            >
              <CellGrid
                items={p.craft.items.map((c, i) => ({
                  ...c,
                  icon: (["zap", "message", "crosshair"] as const)[i],
                }))}
              />
            </Specimen>

            <Specimen
              name="CellGrid, numbered"
              status="current"
              usage="custom #4, editing #4, contact #2"
              note="The same grid with an index. The number is an annotation on a grid, so a six-step sequence looks exactly like a three-item capability list. See 08 for the alternative."
            >
              <CellGrid
                items={e.how.steps.map((s, i) => ({
                  ...s,
                  icon: (["upload", "scissors", "send"] as const)[i],
                }))}
                numbered
              />
            </Specimen>

            <Specimen
              name="FitSplit"
              status="current"
              usage="custom #2, editing #2"
              note="Two columns sharing a centre hairline: what this is for, what it is not. The 'not for' column is the most persuasive thing on either page."
            >
              <FitSplit forItems={e.fit.forItems} notItems={e.fit.notItems} />
            </Specimen>

            <Specimen
              name="FAQ list"
              status="current"
              usage="premade, custom, editing"
              note="Native details/summary, so it is keyboard accessible and open by default to a crawler."
            >
              <Stage>
                <FaqList items={p.faq.items.slice(0, 3)} />
              </Stage>
            </Specimen>
          </DsSection>

          {/* ------------------------------ 08 section forms: proposed */}
          <DsSection
            id="forms-proposed"
            n="08"
            title="Section forms: proposed"
            intro="Not used on any page. Each one exists to give a kind of content its own shape, so a sequence stops looking like a spec sheet. Judge them against the current forms above."
          >
            <Specimen
              name="Process spine"
              status="proposed"
              usage="would replace CellGrid numbered on custom #4, editing #4"
              note="A process is a path, so it is drawn as one. The order becomes a shape instead of an annotation, and it stops colliding with the capability grids. Asymmetric: narrow numbered rail, wide content."
            >
              <Stage>
                <ProcessSpine steps={p.process.steps} />
              </Stage>
            </Specimen>

            <Specimen
              name="Editorial points"
              status="proposed"
              usage="would replace CellGrid on editing #3 (the bottleneck)"
              note="For the beats that are an argument, not a spec sheet. This is the page's one deliberate break from the grid, so it should appear once per page at most. Two of these and it is a pattern again."
            >
              <Stage>
                <EditorialPoints items={e.bottleneck.items} />
              </Stage>
            </Specimen>

            <Specimen
              name="Filmstrip"
              status="proposed"
              usage="would replace CellGrid on custom #3 (the craft)"
              note="Hook, story and conversion are three positions on one timeline, not three features, so the section is a scrubber. The gradient earns a use here because left-to-right is the thing being described. The track is desktop only: stacked, there is no left-to-right to describe."
            >
              <Stage>
                <Filmstrip items={p.craft.items} />
              </Stage>
            </Specimen>

            <Specimen
              name="Chipless band"
              status="proposed"
              usage="would apply to editing #6 stats, and any pull quote"
              note="Some sections should not announce themselves. A stat band, a marquee or a quote can just be the thing. Three per page that skip the chip is enough to break the drone."
            >
              <div className="grid gap-px overflow-hidden rounded-card border border-hair bg-hair sm:grid-cols-3">
                {e.allPlans.stats.map((s) => (
                  <div key={s.l} className="bg-canvas px-6 py-8 text-center">
                    <p className="font-mono text-stat-lg font-bold leading-none text-gold [font-variant-numeric:tabular-nums]">
                      {s.v}
                    </p>
                    <p className="mt-2 font-mono text-label uppercase text-dim">
                      {s.l}
                    </p>
                  </div>
                ))}
              </div>
            </Specimen>
          </DsSection>
        </div>
      </div>
    </div>
  );
}
