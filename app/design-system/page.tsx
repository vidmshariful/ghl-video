import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { CellGrid, FitSplit } from "@/components/CellGrid";
import { DrawnBorder } from "@/components/DrawnBorder";
import { EmbedSlot } from "@/components/EmbedSlot";
import { FaqList } from "@/components/FaqList";
import { MediaCard } from "@/components/MediaCard";
import { PricingTier } from "@/components/PricingTier";
import { Reveal, RevealItem } from "@/components/Reveal";
import { ReviewCard } from "@/components/ReviewCard";
import { RuledSection } from "@/components/RuledSection";
import { SectionGlow } from "@/components/SectionGlow";
import { SectionHead } from "@/components/SectionHead";
import { VideoBundles } from "@/components/VideoBundles";
import { ClientWall } from "@/components/home/ClientWall";
import { ClosingCta } from "@/components/home/ClosingCta";
import { Comparison } from "@/components/home/Comparison";
import { FounderNote } from "@/components/home/FounderNote";
import { Manifesto } from "@/components/home/Manifesto";
import { ServicePanels } from "@/components/home/ServicePanels";
import { ShowreelMoment } from "@/components/home/ShowreelMoment";
import { Testimonials } from "@/components/home/Testimonials";
import { TrustStrip } from "@/components/home/TrustStrip";
import { VideoTestimonials } from "@/components/home/VideoTestimonials";
import { CrossSell } from "@/components/pages/CrossSell";
import { GetStarted } from "@/components/pages/GetStarted";
import { PageHero } from "@/components/pages/PageHero";
import { ProofStrip } from "@/components/pages/ProofStrip";
import { cta, editingPlans, home, newSamples, pages } from "@/lib/site";

/* Internal. Crawlable but never indexed, absent from the sitemap, linked
 * from nothing: noindex is what keeps a URL out of search, a robots
 * disallow only advertises one. */
export const metadata: Metadata = {
  title: "Design system",
  description: "Internal reference page for the GHL Video design system.",
  robots: { index: false, follow: false },
};

/*
 * Every section type on the site, on one real page, hero to CTA.
 *
 * These are the REAL components with the real data, not copies: a copy
 * would drift from the pages it is supposed to represent, and then this
 * page would be lying. The consequence is that the self-contained home
 * sections carry their own chip numbers (Comparison is always [ 07 ]),
 * so the numbering does not run 01..n here. That is the cost of not
 * forking them, and it is the right trade.
 */
export default function DesignSystemPage() {
  const p = pages.custom;
  const e = pages.editing;

  return (
    <>
      {/* hero */}
      <PageHero
        chip="Design system"
        headline="Every section we ship,"
        accent="on one page."
        lede="The real components with the real data, hero to CTA, in the order a page would use them. Nothing here is a mockup: change a component and this page changes with it."
      >
        <Button href="#forms" variant="hero">
          See the sections
        </Button>
        <Button href={cta.bookACall.href} variant="ghost">
          {cta.bookACall.label}
        </Button>
      </PageHero>

      {/* logo marquee band */}
      <TrustStrip />

      {/* three-service bento */}
      <ServicePanels />

      {/* editorial panel */}
      <Manifesto />

      {/* featured media, 8 / 4 */}
      <ShowreelMoment />

      {/* the 800+ moment */}
      <ClientWall />

      {/* comparison table */}
      <Comparison />

      {/* founders on camera */}
      <VideoTestimonials />

      {/* sticky head + review masonry */}
      <Testimonials />

      {/* founder note */}
      <FounderNote />

      {/* ---- the service-page section forms ---- */}

      {/* section head, left + cell grid */}
      <section
        id="forms"
        data-bp-idx="11"
        className="relative scroll-mt-24 overflow-x-clip section-pad"
      >
        <SectionGlow position="left" />
        <div className="shell relative">
          <SectionHead
            index={11}
            chip={p.craft.chip}
            headline={p.craft.headline}
            accent={p.craft.accent}
            intro={p.craft.intro}
          />
          <div className="mt-12">
            <CellGrid
              items={p.craft.items.map((c, i) => ({
                ...c,
                icon: (["zap", "message", "crosshair"] as const)[i],
              }))}
            />
          </div>
        </div>
      </section>

      {/* ruled section + numbered cell grid */}
      <RuledSection
        bpIdx={12}
        index={12}
        chip={p.process.chip}
        headline={p.process.headline}
        accent={p.process.accent}
      >
        <CellGrid
          items={p.process.steps.map((s, i) => ({
            ...s,
            icon: (
              ["crosshair", "pen-line", "mic", "clapperboard", "message", "package-check"] as const
            )[i],
          }))}
          numbered
          framed={false}
        />
      </RuledSection>

      {/* ruled section + fit split */}
      <RuledSection
        bpIdx={13}
        index={13}
        chip={p.fit.chip}
        headline={p.fit.headline}
        accent={p.fit.accent}
      >
        <FitSplit
          forItems={p.fit.forItems}
          notItems={p.fit.notItems}
          framed={false}
        />
      </RuledSection>

      {/* media card grid */}
      <section data-bp-idx="14" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <SectionHead
            index={14}
            chip={p.samples.chip}
            headline={p.samples.headline}
            accent={p.samples.accent}
            intro={p.samples.intro}
          />
          <Reveal className="mt-12 grid items-start gap-5 md:grid-cols-3">
            {newSamples.slice(0, 3).map((s) => (
              <RevealItem key={s.src} className="h-full">
                <MediaCard
                  src={s.src}
                  poster={s.poster}
                  title={s.title}
                  meta={s.format}
                />
              </RevealItem>
            ))}
          </Reveal>
        </div>
      </section>

      {/* pricing tiers */}
      <section data-bp-idx="15" className="relative overflow-x-clip section-pad">
        <SectionGlow position="right" />
        <div className="shell relative">
          <SectionHead
            index={15}
            chip={e.plans.chip}
            headline={e.plans.headline}
            accent={e.plans.accent}
          />
          <Reveal className="mt-14 grid gap-6 lg:grid-cols-3">
            {editingPlans.map((plan) => (
              <RevealItem key={plan.name} className="h-full">
                <PricingTier plan={plan} featuredLabel={e.plans.featuredLabel} />
              </RevealItem>
            ))}
          </Reveal>
        </div>
      </section>

      {/* bundle cards + segmented control */}
      <section data-bp-idx="16" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          {/* /premade hardcodes this head rather than reading site.ts,
              so the same literals are used here */}
          <SectionHead
            index={16}
            chip="Bundle and save"
            headline="Bundle up and"
            accent="save more."
            intro="Three ways to bundle: our newest releases, the classic library at reduced pricing, or a mix of both."
            center
          />
          <div className="mt-12">
            <VideoBundles />
          </div>
        </div>
      </section>

      {/* stat band, no chip */}
      <section data-bp-idx="17" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <SectionHead
            index={17}
            chip={e.allPlans.chip}
            headline={e.allPlans.headline}
            accent={e.allPlans.accent}
            intro={e.allPlans.intro}
          />
          <Reveal className="mt-12 grid gap-px overflow-hidden rounded-card border border-hair bg-hair sm:grid-cols-3">
            {e.allPlans.stats.map((s) => (
              <RevealItem key={s.l} className="h-full">
                <div className="h-full bg-canvas px-6 py-7 text-center">
                  <p className="font-mono text-price font-bold leading-none text-gold [font-variant-numeric:tabular-nums]">
                    {s.v}
                  </p>
                  <p className="mt-2 font-mono text-label uppercase text-dim">
                    {s.l}
                  </p>
                </div>
              </RevealItem>
            ))}
          </Reveal>
          <div className="mt-5">
            <CellGrid
              items={e.allPlans.items.map((x, i) => ({
                ...x,
                icon: (["building", "pen-line", "clock", "lock"] as const)[i],
              }))}
              columns={2}
            />
          </div>
        </div>
      </section>

      {/* review card grid */}
      <section data-bp-idx="18" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <SectionHead
            index={18}
            chip={p.proof.chip}
            headline={p.proof.headline}
            accent={p.proof.accent}
            intro={p.proof.intro}
            center
          />
          <Reveal className="mt-12 grid items-start gap-5 md:grid-cols-2 lg:grid-cols-3">
            {home.reviews.items.slice(0, 6).map((r) => (
              <RevealItem key={r.name} className="h-full">
                <ReviewCard quote={r.quote} name={r.name} className="h-full" />
              </RevealItem>
            ))}
          </Reveal>
        </div>
      </section>

      {/* single pull quote */}
      <section data-bp-idx="19" className="relative section-pad-sm">
        <DrawnBorder />
        <div className="shell">
          <ProofStrip quote='"The videos they have created have been huge in helping us close more clients." David Allen Neron, Google review' />
        </div>
      </section>

      {/* toggle + embed slot */}
      <section data-bp-idx="20" className="relative overflow-x-clip section-pad">
        <SectionGlow position="right" />
        <div className="shell relative">
          <SectionHead
            index={20}
            chip={p.getStarted.chip}
            headline={p.getStarted.headline}
            accent={p.getStarted.accent}
            intro={p.getStarted.intro}
            center
          />
          <Reveal className="mt-12">
            <RevealItem>
              <GetStarted tabs={p.getStarted.tabs} />
            </RevealItem>
          </Reveal>
        </div>
      </section>

      {/* bare embed slot */}
      <section data-bp-idx="21" className="relative section-pad-sm">
        <DrawnBorder />
        <div className="shell">
          <Reveal>
            <RevealItem>
              <EmbedSlot
                label="Booking calendar"
                note={pages.contact.booking.note}
              />
            </RevealItem>
          </Reveal>
        </div>
      </section>

      {/* faq rows */}
      <RuledSection
        bpIdx={22}
        index={22}
        chip={p.faq.chip}
        headline={p.faq.headline}
        accent={p.faq.accent}
      >
        <div className="mx-auto max-w-4xl px-6 py-2 md:px-8">
          <FaqList items={p.faq.items} />
        </div>
      </RuledSection>

      {/* route-out pair */}
      <section data-bp-idx="23" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <SectionHead
            index={23}
            chip="Cross sell"
            headline="Need something"
            accent="premade can't do?"
          />
          <div className="mt-12">
            <CrossSell
              items={[
                {
                  eyebrow: "Premade Videos",
                  line: "The fastest path from this page to your own video.",
                  linkLabel: "See premade videos",
                  href: "/premade/",
                  icon: "monitor-play",
                },
                {
                  eyebrow: "Custom Production",
                  line: "Something bespoke, scripted for your positioning.",
                  linkLabel: "See custom production",
                  href: "/custom/",
                  icon: "clapperboard",
                },
              ]}
            />
          </div>
        </div>
      </section>

      {/* closing cta */}
      <ClosingCta />
    </>
  );
}
