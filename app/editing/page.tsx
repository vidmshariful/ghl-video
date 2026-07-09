import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { Checklist } from "@/components/Checklist";
import { DrawnBorder } from "@/components/DrawnBorder";
import { FaqList } from "@/components/FaqList";
import { MediaFrame } from "@/components/MediaFrame";
import { Panel } from "@/components/Panel";
import { PricingTier } from "@/components/PricingTier";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionGlow } from "@/components/SectionGlow";
import { SectionHead } from "@/components/SectionHead";
import { StepFlow } from "@/components/StepFlow";
import { PageHero } from "@/components/pages/PageHero";
import { ProofStrip } from "@/components/pages/ProofStrip";
import {
  clips,
  clipWindows,
  cta,
  editingAllPlans,
  editingPlans,
  pages,
  posters,
} from "@/lib/site";

export const metadata: Metadata = {
  title: "Video Editing",
  description:
    "Your in-house HighLevel editor on a monthly plan. Send raw footage, get back publish-ready edits from a HighLevel-fluent team. No contracts, unlimited revisions.",
};

export default function EditingPage() {
  const p = pages.editing;
  return (
    <>
      <PageHero
        chip={p.hero.chip}
        headline={p.hero.headline}
        accent={p.hero.accent}
        accentColor="blue"
        lede={p.hero.lede}
      >
        <Button href="#plans">See the plans</Button>
        <Button href={cta.bookACall.href} variant="ghost">
          {cta.bookACall.label}
        </Button>
      </PageHero>

      {/* plans */}
      <section
        id="plans"
        data-bp-idx="2"
        className="relative scroll-mt-24 overflow-x-clip section-pad"
      >
        <SectionGlow accent="blue" position="right" />
        <div className="shell relative">
          <SectionHead
            index={2}
            chip={p.plans.chip}
            headline={p.plans.headline}
            accent={p.plans.accent}
            accentColor="blue"
          />
          <Reveal className="mt-14 grid gap-6 lg:grid-cols-3">
            {editingPlans.map((plan) => (
              <RevealItem key={plan.name} className="h-full">
                <PricingTier
                  plan={plan}
                  featuredLabel={p.plans.featuredLabel}
                />
              </RevealItem>
            ))}
          </Reveal>
          <Reveal className="mt-8">
            <RevealItem>
              <p className="text-center font-mono text-label uppercase text-muted">
                All plans: {editingAllPlans}
              </p>
            </RevealItem>
          </Reveal>
        </div>
      </section>

      {/* before and after */}
      <section data-bp-idx="3" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <SectionHead
            index={3}
            chip={p.samples.chip}
            headline={p.samples.headline}
            accent={p.samples.accent}
            accentColor="blue"
            intro={p.samples.intro}
          />
          {/* PLACEHOLDER pair: real before/after samples swap in */}
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
                tint="blue"
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
                tint="blue"
              />
            </RevealItem>
          </Reveal>
        </div>
      </section>

      {/* fit */}
      <section data-bp-idx="4" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <SectionHead
            index={4}
            chip={p.fit.chip}
            headline={p.fit.headline}
            accent={p.fit.accent}
            accentColor="blue"
          />
          <Reveal className="mt-12 grid gap-6 md:grid-cols-2">
            <RevealItem>
              <Panel ticks={false} className="h-full p-7 md:p-8">
                <p className="font-mono text-label uppercase text-blue">
                  Built for
                </p>
                <Checklist
                  items={p.fit.forItems}
                  accent="blue"
                  className="mt-4"
                />
              </Panel>
            </RevealItem>
            <RevealItem>
              <Panel ticks={false} className="h-full p-7 md:p-8">
                <p className="font-mono text-label uppercase text-dim">
                  Not for
                </p>
                <ul className="mt-4">
                  {p.fit.notItems.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-3 border-t border-hair py-3 first:border-t-0"
                    >
                      <span aria-hidden="true" className="font-mono text-dim">
                        &times;
                      </span>
                      <span className="text-[0.9375rem] text-muted">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </RevealItem>
          </Reveal>
        </div>
      </section>

      {/* how it works */}
      <section data-bp-idx="5" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <SectionHead
            index={5}
            chip={p.how.chip}
            headline={p.how.headline}
            accent={p.how.accent}
            accentColor="blue"
          />
          <div className="mt-12">
            <StepFlow steps={p.how.steps} accent="blue" />
          </div>
        </div>
      </section>

      {/* proof + FAQ */}
      <section data-bp-idx="6" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <ProofStrip quote='"They are very accommodating and willing to work with you on your needs." Nick Demyanovich, Google review' />
          <div className="mt-16">
            <SectionHead
              index={6}
              chip={p.faq.chip}
              headline={p.faq.headline}
              accent={p.faq.accent}
              accentColor="blue"
              center
            />
          </div>
          <Reveal className="mx-auto mt-12 max-w-4xl">
            <RevealItem>
              <FaqList items={p.faq.items} />
            </RevealItem>
          </Reveal>
          <Reveal className="mt-14 text-center">
            <RevealItem>
              <p className="text-lede text-muted">The call answers the rest.</p>
              <div className="mt-6 flex justify-center">
                <Button href={cta.bookACall.href}>{cta.bookACall.label}</Button>
              </div>
            </RevealItem>
          </Reveal>
        </div>
      </section>
    </>
  );
}
