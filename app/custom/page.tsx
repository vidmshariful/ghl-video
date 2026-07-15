import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { CellGrid, FitSplit } from "@/components/CellGrid";
import { DrawnBorder } from "@/components/DrawnBorder";
import { MediaFrame } from "@/components/MediaFrame";
import { Reveal, RevealItem } from "@/components/Reveal";
import { RuledSection } from "@/components/RuledSection";
import { SectionGlow } from "@/components/SectionGlow";
import { SectionHead } from "@/components/SectionHead";
import { PageHero } from "@/components/pages/PageHero";
import { ProofStrip } from "@/components/pages/ProofStrip";
import { clips, clipWindows, cta, pages, posters } from "@/lib/site";

const pricingIcons = ["tags", "clock", "lock"] as const;
const processIcons = ["crosshair", "pen-line", "mic", "clapperboard", "message", "package-check"] as const;
const capabilityIcons = ["globe", "building", "zap"] as const;

export const metadata: Metadata = {
  title: "Custom Production",
  description:
    "Custom video built from scratch for your platform and your ICP: ads, explainers, demos, and onboarding series with published starting prices and a fixed quote before production.",
};

export default function CustomPage() {
  const p = pages.custom;
  return (
    <>
      <PageHero
        chip={p.hero.chip}
        headline={p.hero.headline}
        accent={p.hero.accent}
        accentColor="green"
        lede={p.hero.lede}
      >
        <Button href={cta.requestQuote.href} variant="hero">
          {cta.requestQuote.label}
        </Button>
        <Button href={cta.bookACall.href} variant="ghost">
          {cta.bookACall.label}
        </Button>
      </PageHero>

      {/* light zone: formats through fit */}
      <div className="theme-light">
      {/* the four formats */}
      <section data-bp-idx="2" className="relative overflow-x-clip section-pad">
        <SectionGlow accent="green" position="left" />
        <div className="shell relative">
          <SectionHead
            index={2}
            chip={p.formats.chip}
            headline={p.formats.headline}
            accent={p.formats.accent}
            accentColor="green"
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
                      tint="green"
                      {...(win ? { startAt: win.startAt, endAt: win.endAt } : {})}
                    />
                    <div className="flex flex-wrap items-baseline justify-between gap-3 pt-6">
                      <h3 className="font-display text-h3 text-ink">{f.name}</h3>
                      <p className="font-mono text-price text-gold [font-variant-numeric:tabular-nums]">
                        from ${f.from.toLocaleString("en-US")}
                      </p>
                    </div>
                    <p className="max-w-[46ch] pt-2 text-body text-muted">
                      {f.line}
                    </p>
                  </div>
                </RevealItem>
              );
            })}
          </Reveal>
        </div>
      </section>

      {/* how pricing works */}
      <RuledSection
        bpIdx={3}
        index={3}
        chip={p.pricing.chip}
        headline={p.pricing.headline}
        accent={p.pricing.accent}
        accentColor="green"
      >
        <CellGrid
          items={p.pricing.points.map((x, i) => ({
            ...x,
            icon: pricingIcons[i],
          }))}
          accent="green"
          framed={false}
        />
      </RuledSection>

      {/* six-step process */}
      <RuledSection
        bpIdx={4}
        index={4}
        chip={p.process.chip}
        headline={p.process.headline}
        accent={p.process.accent}
        accentColor="green"
      >
        <CellGrid
          items={p.process.steps.map((s, i) => ({
            ...s,
            icon: processIcons[i],
          }))}
          accent="green"
          numbered
          framed={false}
        />
      </RuledSection>

      {/* capabilities */}
      <section data-bp-idx="5" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <CellGrid
            items={p.capabilities.map((c, i) => ({
              ...c,
              icon: capabilityIcons[i],
            }))}
            accent="green"
          />
        </div>
      </section>

      {/* who it's for */}
      <RuledSection
        bpIdx={6}
        index={6}
        chip={p.fit.chip}
        headline={p.fit.headline}
        accent={p.fit.accent}
        accentColor="green"
      >
        <FitSplit
          forItems={p.fit.forItems}
          notItems={p.fit.notItems}
          accent="green"
          framed={false}
        />
      </RuledSection>

      </div>

      {/* proof + closing */}
      <section data-bp-idx="7" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <ProofStrip quote='"The videos they have created have been huge in helping us close more clients." David Allen Neron, Google review' />
          <Reveal className="mt-16 text-center">
            <RevealItem>
              <h2 className="mx-auto max-w-[22ch] font-display text-h2 text-ink">
                One short form. A fixed quote{" "}
                <span className="text-gradient">within 24 hours.</span>
              </h2>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Button href={cta.requestQuote.href}>
                  {cta.requestQuote.label}
                </Button>
                <Button href={cta.bookACall.href} variant="ghost">
                  {cta.bookACall.label}
                </Button>
              </div>
            </RevealItem>
          </Reveal>
        </div>
      </section>
    </>
  );
}
