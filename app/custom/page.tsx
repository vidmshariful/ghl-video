import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { CellGrid, FitSplit } from "@/components/CellGrid";
import { DrawnBorder } from "@/components/DrawnBorder";
import { FaqList } from "@/components/FaqList";
import { MediaCard } from "@/components/MediaCard";
import { MediaFrame } from "@/components/MediaFrame";
import { Reveal, RevealItem } from "@/components/Reveal";
import { ReviewCard } from "@/components/ReviewCard";
import { RuledSection } from "@/components/RuledSection";
import { SectionGlow } from "@/components/SectionGlow";
import { SectionHead } from "@/components/SectionHead";
import { GetStarted } from "@/components/pages/GetStarted";
import { PageHero } from "@/components/pages/PageHero";
import {
  clips,
  clipWindows,
  cta,
  home,
  newSamples,
  pages,
  posters,
} from "@/lib/site";

const craftIcons = ["zap", "message", "crosshair"] as const;
const processIcons = ["crosshair", "pen-line", "mic", "clapperboard", "message", "package-check"] as const;
const pricingIcons = ["tags", "clock", "lock"] as const;
const differenceIcons = ["globe", "building", "zap"] as const;

export const metadata: Metadata = {
  title: "Custom Production",
  description:
    "Custom video built from scratch for your platform and your ICP: ads, explainers, demos, and onboarding series with published starting prices and a fixed quote before production.",
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
      {/* 1. hero */}
      <PageHero
        chip={p.hero.chip}
        headline={p.hero.headline}
        accent={p.hero.accent}
        lede={p.hero.lede}
      >
        <Button href="#get-started" variant="hero">
          {cta.requestQuote.label}
        </Button>
        <Button href={cta.bookACall.href} variant="ghost">
          {cta.bookACall.label}
        </Button>
      </PageHero>

      {/* 2. who it is for */}
      <RuledSection
        bpIdx={2}
        index={2}
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
          items={p.craft.items.map((c, i) => ({ ...c, icon: craftIcons[i] }))}
          framed={false}
        />
      </RuledSection>

      {/* 4. the process */}
      <RuledSection
        bpIdx={4}
        index={4}
        chip={p.process.chip}
        headline={p.process.headline}
        accent={p.process.accent}
      >
        <CellGrid
          items={p.process.steps.map((s, i) => ({ ...s, icon: processIcons[i] }))}
          numbered
          framed={false}
        />
      </RuledSection>

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
          <Reveal className="mt-12 grid gap-px overflow-hidden rounded-card border border-hair bg-hair md:grid-cols-2">
            {p.formats.items.map((f) => {
              const key = f.mediaKey as keyof typeof clips;
              const win = clipWindows[key];
              return (
                <RevealItem key={f.name} className="h-full">
                  <div
                    data-cell
                    className="group/cell flex h-full flex-col bg-canvas p-6 transition-colors duration-300 hover:bg-surface md:p-7"
                  >
                    {/* PLACEHOLDER sample: real format samples swap in.
                        No in-frame caption: the name and price read below. */}
                    <MediaFrame
                      src={clips[key]}
                      poster={posters[key]}
                      label={`${f.name} sample`}
                      tint
                      {...(win ? { startAt: win.startAt, endAt: win.endAt } : {})}
                    />
                    <div className="flex flex-wrap items-baseline justify-between gap-3 pt-6">
                      <h3 className="font-display text-h3 text-ink">{f.name}</h3>
                      <p className="font-mono text-price text-gold [font-variant-numeric:tabular-nums]">
                        from ${f.from.toLocaleString("en-US")}
                      </p>
                    </div>
                    <p className="max-w-[var(--measure-body)] pt-2 text-body text-muted">
                      {f.line}
                    </p>
                  </div>
                </RevealItem>
              );
            })}
          </Reveal>

          {/* how the number is arrived at: the floors are real, the
              quote is fixed. This is the argument the price list makes
              on its own, so it sits with the price list. */}
          <div className="mt-5">
            <CellGrid
              items={p.pricing.points.map((x, i) => ({
                ...x,
                icon: pricingIcons[i],
              }))}
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
      <section data-bp-idx="11" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <Reveal className="text-center">
            <RevealItem>
              <h2 className="mx-auto max-w-[22ch] font-display text-h2 text-ink">
                {p.closing.headline}{" "}
                <span className="text-gradient">{p.closing.accent}</span>
              </h2>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Button href="#get-started">{cta.requestQuote.label}</Button>
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
