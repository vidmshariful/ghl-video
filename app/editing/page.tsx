import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { CellGrid } from "@/components/CellGrid";
import { FitCards } from "@/components/FitCards";
import { DrawnBorder } from "@/components/DrawnBorder";
import { FaqList } from "@/components/FaqList";
import { MediaFrame } from "@/components/MediaFrame";
import { PricingTier } from "@/components/PricingTier";
import { Reveal, RevealItem } from "@/components/Reveal";
import { ReviewCard } from "@/components/ReviewCard";
import { SectionGlow } from "@/components/SectionGlow";
import { RuledSection } from "@/components/RuledSection";
import { SectionHead } from "@/components/SectionHead";
import { PageHero } from "@/components/pages/PageHero";
import {
  clips,
  clipWindows,
  cta,
  editingPlans,
  home,
  pages,
  posters,
} from "@/lib/site";

const bottleneckIcons = ["clock", "message", "zap"] as const;
const howIcons = ["upload", "scissors", "send"] as const;
const allPlansIcons = ["building", "pen-line", "clock", "lock"] as const;

export const metadata: Metadata = {
  title: "Video Editing",
  description:
    "Your in-house HighLevel editor on a monthly plan. Send raw footage, get back publish-ready edits from a HighLevel-fluent team. No contracts, unlimited revisions.",
};

export default function EditingPage() {
  const p = pages.editing;
  /* the same real Google reviews the homepage quotes */
  const reviews = home.reviews.items.slice(0, 6);

  return (
    <>
      {/* 1. hero */}
      <PageHero
        chip={p.hero.chip}
        headline={p.hero.headline}
        accent={p.hero.accent}
        lede={p.hero.lede}
      >
        <Button href="#plans">See the plans</Button>
        <Button href={cta.bookACall.href} variant="ghost">
          {cta.bookACall.label}
        </Button>
      </PageHero>

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

      {/* 3. the bottleneck: name the pain before the price */}
      <RuledSection
        bpIdx={3}
        index={3}
        chip={p.bottleneck.chip}
        headline={p.bottleneck.headline}
        accent={p.bottleneck.accent}
        intro={p.bottleneck.intro}
      >
        <CellGrid
          items={p.bottleneck.items.map((x, i) => ({
            ...x,
            icon: bottleneckIcons[i],
          }))}
          framed={false}
        />
      </RuledSection>

      {/* 4. how it works */}
      <RuledSection
        bpIdx={4}
        index={4}
        chip={p.how.chip}
        headline={p.how.headline}
        accent={p.how.accent}
      >
        <CellGrid
          items={p.how.steps.map((s, i) => ({ ...s, icon: howIcons[i] }))}
          numbered
          framed={false}
        />
      </RuledSection>

      {/* 5. the plans */}
      <section
        id="plans"
        data-bp-idx="5"
        className="relative scroll-mt-24 overflow-x-clip section-pad"
      >
        <SectionGlow position="right" />
        <div className="shell relative">
          <SectionHead
            index={5}
            chip={p.plans.chip}
            headline={p.plans.headline}
            accent={p.plans.accent}
          />
          <Reveal className="mt-14 grid gap-6 lg:grid-cols-3">
            {editingPlans.map((plan) => (
              <RevealItem key={plan.name} className="h-full">
                <PricingTier plan={plan} featuredLabel={p.plans.featuredLabel} />
              </RevealItem>
            ))}
          </Reveal>
        </div>
      </section>

      {/* 6. what every plan includes: the objection-killers, with the
          three numbers that answer them up front */}
      <section data-bp-idx="6" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <SectionHead
            index={6}
            chip={p.allPlans.chip}
            headline={p.allPlans.headline}
            accent={p.allPlans.accent}
            intro={p.allPlans.intro}
          />
          <Reveal className="mt-12 grid gap-px overflow-hidden rounded-card border border-hair bg-hair sm:grid-cols-3">
            {p.allPlans.stats.map((s) => (
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
              items={p.allPlans.items.map((x, i) => ({
                ...x,
                icon: allPlansIcons[i],
              }))}
              columns={2}
            />
          </div>
        </div>
      </section>

      {/* 7. sample edits */}
      <section data-bp-idx="7" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <SectionHead
            index={7}
            chip={p.samples.chip}
            headline={p.samples.headline}
            accent={p.samples.accent}
            intro={p.samples.intro}
          />
          {/* PLACEHOLDER: these are two UNRELATED clips standing in as a
              before/after of the same footage, which is a claim the pair
              does not currently support. Flagged for Shariful: send one
              raw clip and its finished edit. Data-only swap. */}
          <Reveal className="mt-12 grid gap-6 md:grid-cols-2">
            <RevealItem>
              <MediaFrame
                src={clips.sampleA}
                poster={posters.sampleA}
                label="Before: raw footage sample"
                caption={{
                  title: p.samples.before.label,
                  sub: p.samples.before.sub,
                }}
                tint
                startAt={clipWindows.sampleA!.startAt}
                endAt={clipWindows.sampleA!.endAt}
              />
            </RevealItem>
            <RevealItem>
              <MediaFrame
                src={clips.sampleB}
                poster={posters.sampleB}
                label="After: published edit sample"
                caption={{
                  title: p.samples.after.label,
                  sub: p.samples.after.sub,
                }}
                tint
              />
            </RevealItem>
          </Reveal>
        </div>
      </section>

      {/* 8. proof */}
      <section data-bp-idx="8" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <SectionHead
            index={8}
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

      {/* 9. faq */}
      <RuledSection
        bpIdx={9}
        index={9}
        chip={p.faq.chip}
        headline={p.faq.headline}
        accent={p.faq.accent}
      >
        <div className="mx-auto max-w-4xl px-6 py-2 md:px-8">
          <FaqList items={p.faq.items} />
        </div>
      </RuledSection>

      {/* 10. closing */}
      <section data-bp-idx="10" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <Reveal className="text-center">
            <RevealItem>
              <h2 className="mx-auto max-w-[22ch] font-display text-h2 text-ink">
                {p.closing.headline}{" "}
                <span className="text-gradient">{p.closing.accent}</span>
              </h2>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Button href="#plans">See the plans</Button>
                <Button href={cta.bookACall.href} variant="ghost">
                  {cta.bookACall.label}
                </Button>
              </div>
              <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
                {p.closing.points.map((point) => (
                  <li
                    key={point}
                    className="inline-flex items-center gap-2 rounded-full border border-hair bg-surface px-4 py-2 font-mono text-label uppercase text-muted"
                  >
                    <span aria-hidden="true" className="text-gold">
                      &#43;
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </RevealItem>
          </Reveal>
        </div>
      </section>
    </>
  );
}
