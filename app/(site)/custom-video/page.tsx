import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { CellGrid } from "@/components/CellGrid";
import { DrawnArt } from "@/components/DrawnArt";
import { RuleList } from "@/components/RuleList";
import { FitCards } from "@/components/FitCards";
import { DrawnBorder } from "@/components/DrawnBorder";
import { FaqList } from "@/components/FaqList";
import { MediaCard } from "@/components/MediaCard";
import { Reveal, RevealItem } from "@/components/Reveal";
import { ReviewCard } from "@/components/ReviewCard";
import { RuledSection } from "@/components/RuledSection";
import { SectionGlow } from "@/components/SectionGlow";
import { SectionHead } from "@/components/SectionHead";
import { CtaBand } from "@/components/CtaBand";
import { JsonLd } from "@/components/JsonLd";
import { PricingCards } from "@/components/PricingCards";
import { GetStarted } from "@/components/pages/GetStarted";
import { PageHero } from "@/components/pages/PageHero";
import { ProcessSection } from "@/components/pages/ProcessSection";
import { TrustStrip } from "@/components/home/TrustStrip";
import { faqSchema, serviceSchema } from "@/lib/schema";
import { cta, customFormats, home, newSamples, pages } from "@/lib/site";

const craftArt = ["hook", "story", "conversion"] as const;
const processIcons = ["crosshair", "pen-line", "mic", "clapperboard", "message", "package-check"] as const;
const differenceIcons = ["globe", "building", "zap"] as const;

export const metadata: Metadata = {
  /* the old site's title for this page ranks #1 for "gohighlevel
     custom video production"; keep it verbatim (template adds | GHL Video) */
  title: "GoHighLevel Custom Video Production | Built From Scratch",
  description:
    "Custom video built from scratch for your platform and your ICP: ads, explainers, demos, and onboarding series with published starting prices and a fixed quote before production.",
  alternates: { canonical: "/custom-video/" },
};

export default function CustomPage() {
  const p = pages.custom;
  /* the proof section quotes the real Google reviews, six of the eight */
  const reviews = home.reviews.items.slice(0, 6);
  /* PLACEHOLDER: these are the AI-pack premade videos, not custom
     builds, so the section currently calls work "custom" that was not.
     Flagged for Shariful: swap in three real custom projects. Layout is
     final, the swap is data only. */
  const samples = newSamples.slice(0, 3);

  return (
    <>
      <JsonLd
        schema={[
          serviceSchema({
            name: "Custom Video Production",
            description:
              "Custom video built from scratch for your platform and your ICP: ads, explainers, demos, and onboarding series, with published starting prices and a fixed quote before production.",
            path: "/custom-video/",
            offers: {
              lowPrice: Math.min(...customFormats.map((f) => f.from)),
              count: customFormats.length,
            },
          }),
          faqSchema(p.faq.items),
        ]}
      />

      {/* 1. hero */}
      <PageHero
        chip={p.hero.chip}
        headline={p.hero.headline}
        accent={p.hero.accent}
        lede={p.hero.lede}
      >
        <Button href={cta.requestQuote.href} variant="hero">
          {cta.requestQuote.label}
        </Button>
        <Button href={cta.bookACall.href} variant="ghost">
          {cta.bookACall.label}
        </Button>
      </PageHero>

      {/* trusted-by logo strip, directly under the hero */}
      <TrustStrip />

      {/* 2. who it is for: audience cards, not a for/not-for list */}
      <section data-bp-idx="2" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <SectionHead
            index={2}
            chip={p.fit.chip}
            headline={p.fit.headline}
            accent={p.fit.accent}
            intro={p.fit.intro}
          />
          <div className="mt-12">
            <FitCards cards={p.fit.cards} cta={p.fit.cta} />
          </div>
        </div>
      </section>

      {/* 3. the craft */}
      <RuledSection
        bpIdx={3}
        index={3}
        chip={p.craft.chip}
        headline={p.craft.headline}
        accent={p.craft.accent}
        intro={p.craft.intro}
      >
        <CellGrid
          items={p.craft.items.map((c, i) => ({
            ...c,
            art: <DrawnArt name={craftArt[i]} />,
          }))}
          framed={false}
        />
      </RuledSection>

      {/* 4. the process: a connected scroll timeline */}
      <ProcessSection
        bpIdx={4}
        glow="right"
        chip={p.process.chip}
        headline={p.process.headline}
        accent={p.process.accent}
        intro={p.process.intro}
        cta={p.process.cta}
        video={p.process.video}
        arts={["scope", "script", "voice", "production", "review", "delivery"] as const}
        steps={p.process.steps}
        icons={processIcons}
      />

      {/* 5. pricing: the four formats, then how the number is arrived at */}
      <section data-bp-idx="5" className="relative overflow-x-clip section-pad">
        <SectionGlow position="left" />
        <div className="shell relative">
          <SectionHead
            index={5}
            chip={p.formats.chip}
            headline={p.formats.headline}
            accent={p.formats.accent}
            intro={p.formats.intro}
          />
          <div className="mt-12">
            <PricingCards
              columns={4}
              cards={p.formats.items.map((f) => ({
                name: f.name,
                blurb: f.line,
                priceLabel: `$${f.from.toLocaleString("en-US")}`,
                priceNote: "starting price",
                features: f.includes,
                featured: f.name === "Explainer",
                featuredLabel: f.name === "Explainer" ? "Most requested" : undefined,
                cta: { label: cta.requestQuote.label, href: cta.requestQuote.href },
              }))}
            />
          </div>

          {/* how the number is arrived at: the floors are real, the
              quote is fixed. This is the argument the price list makes
              on its own, so it sits with the price list. */}
          {/* the pricing rules read as rules: a list under the format
              cards, not a second card wall */}
          <div className="mt-5">
            <RuleList
              items={p.pricing.points.map((x) => ({ title: x.title, line: x.line }))}
            />
          </div>
        </div>
      </section>

      {/* 6. sample work */}
      <section data-bp-idx="6" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <SectionHead
            index={6}
            chip={p.samples.chip}
            headline={p.samples.headline}
            accent={p.samples.accent}
            intro={p.samples.intro}
          />
          <Reveal className="mt-12 grid items-start gap-5 md:grid-cols-3">
            {samples.map((s) => (
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

      {/* 7. the difference */}
      <RuledSection
        bpIdx={7}
        index={7}
        chip={p.difference.chip}
        headline={p.difference.headline}
        accent={p.difference.accent}
        intro={p.difference.intro}
      >
        <CellGrid
          items={p.capabilities.map((c, i) => ({
            ...c,
            icon: differenceIcons[i],
          }))}
          framed={false}
        />
      </RuledSection>

      {/* 8. get started: quote form or discovery call */}
      <section
        id="get-started"
        data-bp-idx="8"
        className="relative scroll-mt-28 overflow-x-clip section-pad"
      >
        <SectionGlow position="right" />
        <div className="shell relative">
          <SectionHead
            index={8}
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

      {/* 9. proof */}
      <section data-bp-idx="9" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <SectionHead
            index={9}
            chip={p.proof.chip}
            headline={p.proof.headline}
            accent={p.proof.accent}
            intro={p.proof.intro}
            center
          />
          <Reveal className="mt-12 grid items-start gap-5 md:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r) => (
              <RevealItem key={r.name} className="h-full">
                <ReviewCard quote={r.quote} name={r.name} className="h-full" />
              </RevealItem>
            ))}
          </Reveal>
        </div>
      </section>

      {/* 10. faq */}
      <RuledSection
        bpIdx={10}
        index={10}
        chip={p.faq.chip}
        headline={p.faq.headline}
        accent={p.faq.accent}
      >
        <div className="mx-auto max-w-4xl px-6 py-2 md:px-8">
          <FaqList items={p.faq.items} />
        </div>
      </RuledSection>

      {/* 11. closing */}
      <CtaBand
        bpIdx={11}
        headline={p.closing.headline}
        accent={p.closing.accent}
        sub={p.closing.sub}
        cta={p.closing.cta}
      />
    </>
  );
}
