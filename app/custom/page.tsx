import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { Checklist } from "@/components/Checklist";
import { DrawnBorder } from "@/components/DrawnBorder";
import { MediaFrame } from "@/components/MediaFrame";
import { Panel } from "@/components/Panel";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionGlow } from "@/components/SectionGlow";
import { SectionHead } from "@/components/SectionHead";
import { StepFlow } from "@/components/StepFlow";
import { PageHero } from "@/components/pages/PageHero";
import { ProofStrip } from "@/components/pages/ProofStrip";
import { clips, clipWindows, cta, pages, posters } from "@/lib/site";

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
        <Button href={cta.requestQuote.href}>{cta.requestQuote.label}</Button>
        <Button href={cta.bookACall.href} variant="ghost">
          {cta.bookACall.label}
        </Button>
      </PageHero>

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
          <Reveal className="mt-12 grid gap-6 md:grid-cols-2">
            {p.formats.items.map((f) => {
              const key = f.mediaKey as keyof typeof clips;
              const win = clipWindows[key];
              return (
                <RevealItem key={f.name}>
                  <Panel ticks={false} className="h-full overflow-hidden p-3">
                    {/* PLACEHOLDER sample: real format samples swap in */}
                    <MediaFrame
                      src={clips[key]}
                      poster={posters[key]}
                      label={`${f.name} sample`}
                      caption={{ title: f.name, sub: "Sample" }}
                      tint="green"
                      {...(win ? { startAt: win.startAt, endAt: win.endAt } : {})}
                    />
                    <div className="flex flex-wrap items-baseline justify-between gap-3 px-4 pt-5">
                      <h3 className="font-display text-h3 text-ink">{f.name}</h3>
                      <p className="font-mono text-price text-gold [font-variant-numeric:tabular-nums]">
                        from ${f.from.toLocaleString("en-US")}
                      </p>
                    </div>
                    <p className="max-w-[46ch] px-4 pb-4 pt-2 text-[0.9375rem] text-muted">
                      {f.line}
                    </p>
                  </Panel>
                </RevealItem>
              );
            })}
          </Reveal>
        </div>
      </section>

      {/* how pricing works */}
      <section data-bp-idx="3" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <SectionHead
            index={3}
            chip={p.pricing.chip}
            headline={p.pricing.headline}
            accent={p.pricing.accent}
            accentColor="green"
          />
          <div className="mt-12">
            <StepFlow
              steps={p.pricing.points.map((x) => ({
                title: x.title,
                line: x.line,
              }))}
              accent="green"
            />
          </div>
        </div>
      </section>

      {/* six-step process */}
      <section data-bp-idx="4" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <SectionHead
            index={4}
            chip={p.process.chip}
            headline={p.process.headline}
            accent={p.process.accent}
            accentColor="green"
          />
          <div className="mt-12">
            <StepFlow steps={p.process.steps} accent="green" />
          </div>
        </div>
      </section>

      {/* capabilities */}
      <section data-bp-idx="5" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <Reveal className="grid gap-5 md:grid-cols-3">
            {p.capabilities.map((c) => (
              <RevealItem key={c.title}>
                <Panel ticks={false} className="h-full p-7">
                  <h3 className="font-display text-[1.125rem] font-semibold tracking-[-0.01em] text-ink">
                    {c.title}
                  </h3>
                  <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-muted">
                    {c.line}
                  </p>
                </Panel>
              </RevealItem>
            ))}
          </Reveal>
        </div>
      </section>

      {/* who it's for */}
      <section data-bp-idx="6" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <SectionHead
            index={6}
            chip={p.fit.chip}
            headline={p.fit.headline}
            accent={p.fit.accent}
            accentColor="green"
          />
          <Reveal className="mt-12 grid gap-6 md:grid-cols-2">
            <RevealItem>
              <Panel ticks={false} className="h-full p-7 md:p-8">
                <p className="font-mono text-label uppercase text-green">
                  Built for
                </p>
                <Checklist
                  items={p.fit.forItems}
                  accent="green"
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

      {/* proof + closing */}
      <section data-bp-idx="7" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <ProofStrip quote='"The videos they have created have been huge in helping us close more clients." David Allen Neron, Google review' />
          <Reveal className="mt-16 text-center">
            <RevealItem>
              <h2 className="mx-auto max-w-[22ch] font-display text-h2 text-ink">
                One short form. A fixed quote{" "}
                <span className="text-green">within 24 hours.</span>
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
