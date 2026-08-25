import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { Button } from "@/components/Button";
import { CapacityChip } from "@/components/CapacityChip";
import { CellGrid } from "@/components/CellGrid";
import { RuleList } from "@/components/RuleList";
import { FitCards } from "@/components/FitCards";
import { DrawnBorder } from "@/components/DrawnBorder";
import { FaqList } from "@/components/FaqList";
import { MediaFrame } from "@/components/MediaFrame";
import { Reveal, RevealItem } from "@/components/Reveal";
import { ReviewCard } from "@/components/ReviewCard";
import { FeaturedQuote } from "@/components/pages/FeaturedQuote";
import { SectionGlow } from "@/components/SectionGlow";
import { RuledSection } from "@/components/RuledSection";
import { SectionHead } from "@/components/SectionHead";
import { CtaBand } from "@/components/CtaBand";
import { JsonLd } from "@/components/JsonLd";
import { PricingCards } from "@/components/PricingCards";
import { PageHero } from "@/components/pages/PageHero";
import { ChaseHeroReviewer } from "@/components/home/ChaseHeroReviewer";
import { ProcessSection } from "@/components/pages/ProcessSection";
import { TrustStrip } from "@/components/home/TrustStrip";
import { faqSchema, serviceSchema } from "@/lib/schema";
import { PODCAST_TIERS, VIDEO_TIERS, creditWord } from "@/lib/editing-credits";
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

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/editing/", {
    title: "HighLevel Video Editing Subscription",
    description:
      "Your in-house HighLevel editor on a monthly plan. Send raw footage, get back publish-ready edits from a HighLevel-fluent team. No contracts, unlimited revisions.",
    alternates: { canonical: "/editing/" },
  });
}

export default function EditingPage() {
  const p = pages.editing;
  /* the same real Google reviews the homepage quotes */
  const reviews = home.reviews.items.slice(0, 6);

  return (
    <>
      <JsonLd
        schema={[
          serviceSchema({
            name: "Video Editing",
            description:
              "Your in-house HighLevel editor on a monthly plan. Send raw footage, get back publish-ready edits from a HighLevel-fluent team. No contracts, unlimited revisions.",
            path: "/editing/",
            offers: {
              lowPrice: Math.min(...editingPlans.map((pl) => pl.price)),
              highPrice: Math.max(...editingPlans.map((pl) => pl.price)),
              count: editingPlans.length,
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
        note={<CapacityChip service="editing" />}
        reviewer={<ChaseHeroReviewer />}
      >
        <Button href="#plans">See the plans</Button>
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

      {/* 4. how it works: a connected scroll timeline */}
      <ProcessSection
        bpIdx={4}
        glow="right"
        chip={p.how.chip}
        headline={p.how.headline}
        accent={p.how.accent}
        intro={p.how.intro}
        cta={p.how.cta}
        video={p.how.video}
        arts={["footage", "edit", "publish"] as const}
        steps={p.how.steps}
        icons={howIcons}
      />

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
          <div className="mt-14">
            <PricingCards
              columns={3}
              cards={editingPlans.map((plan) => ({
                name: plan.name,
                blurb: plan.blurb,
                priceLabel: `$${plan.price.toLocaleString("en-US")}`,
                priceNote: "/ month",
                anchor: `$${plan.anchorPrice.toLocaleString("en-US")}`,
                saveNote: `save ${Math.round((1 - plan.price / plan.anchorPrice) * 100)}%`,
                features: plan.features,
                featured: plan.featured,
                featuredLabel: plan.featured ? p.plans.featuredLabel : undefined,
                cta: { label: cta.startEditing, href: `/checkout/${plan.sku}` },
              }))}
            />
          </div>
        </div>
      </section>

      {/* 5b. what a credit buys. The numbers come from lib/editing-credits,
          the same table the portal charges against, so the published price
          and the charged price cannot drift apart. */}
      <section data-bp-idx="5" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <SectionHead
            index={5}
            chip={p.credits.chip}
            headline={p.credits.headline}
            accent={p.credits.accent}
            intro={p.credits.intro}
          />

          <p className="mt-12 font-mono text-label uppercase tracking-[0.1em] text-dim">
            {p.credits.videoLead}
          </p>
          <Reveal className="mt-4 grid gap-px overflow-hidden rounded-card border border-hair bg-hair sm:grid-cols-3">
            {VIDEO_TIERS.map((t) => (
              <RevealItem key={t.key} className="h-full">
                <div className="flex h-full flex-col bg-canvas px-6 py-7">
                  <p className="font-mono text-price font-bold leading-none text-gold [font-variant-numeric:tabular-nums]">
                    {t.credits}
                  </p>
                  <p className="mt-1 font-mono text-label uppercase text-dim">
                    {t.credits === 1 ? "credit" : "credits"}
                  </p>
                  <p className="mt-4 font-display text-h4 text-ink">{t.label}</p>
                  <p className="mt-1 text-body-sm text-muted">{t.lengthNote}</p>
                  <p className="mt-3 text-body-sm text-muted">{t.blurb}</p>
                  <ul className="mt-4 flex flex-wrap gap-1.5">
                    {t.idealFor.map((x) => (
                      <li
                        key={x}
                        className="rounded-full border border-hair px-2.5 py-0.5 font-mono text-label uppercase text-dim"
                      >
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
              </RevealItem>
            ))}
          </Reveal>

          <p className="mt-10 font-mono text-label uppercase tracking-[0.1em] text-dim">
            {p.credits.podcastLead}
          </p>
          <Reveal className="mt-4 grid gap-px overflow-hidden rounded-card border border-hair bg-hair sm:grid-cols-2">
            {PODCAST_TIERS.map((t) => (
              <RevealItem key={t.key} className="h-full">
                <div className="flex h-full flex-col bg-canvas px-6 py-7">
                  <p className="font-display text-h4 text-ink">{t.label}</p>
                  <p className="mt-2 font-mono text-body-sm text-gold">
                    {creditWord(t.perHour)} an hour, {t.perHalfHour} a half hour
                  </p>
                  <p className="mt-3 text-body-sm text-muted">{t.blurb}</p>
                  <ul className="mt-4 grid gap-1.5">
                    {t.idealFor.map((x) => (
                      <li key={x} className="text-body-sm text-muted">
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
              </RevealItem>
            ))}
          </Reveal>

          <p className="mt-6 max-w-[var(--measure-body)] text-body-sm text-dim">
            {p.credits.note}
          </p>
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
          {/* the stat band carries the numbers; the guarantees read as a
              list, not four more cards */}
          <div className="mt-5">
            <RuleList
              items={p.allPlans.items.map((x) => ({ title: x.title, line: x.line }))}
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
          <Reveal>
            <RevealItem>
              <FeaturedQuote className="mx-auto mt-12 max-w-3xl" />
            </RevealItem>
          </Reveal>
          <Reveal className="mt-8 grid items-start gap-5 md:grid-cols-2 lg:grid-cols-3">
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

      <CtaBand
        bpIdx={10}
        headline={p.closing.headline}
        accent={p.closing.accent}
        sub={p.closing.sub}
        cta={p.closing.cta}
      />
    </>
  );
}
