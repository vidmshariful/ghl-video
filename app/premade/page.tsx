import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/Button";
import { DrawnBorder } from "@/components/DrawnBorder";
import { DrawnIcon, type IconName } from "@/components/DrawnIcon";
import { FaqList } from "@/components/FaqList";
import { PremadeLibrary } from "@/components/PremadeLibrary";
import { Reveal, RevealItem } from "@/components/Reveal";
import { RuledSection } from "@/components/RuledSection";
import { SectionGlow } from "@/components/SectionGlow";
import { SectionHead } from "@/components/SectionHead";
import { PageHero } from "@/components/pages/PageHero";
import { ProofStrip } from "@/components/pages/ProofStrip";
import { cta, pages } from "@/lib/site";

export const metadata: Metadata = {
  title: "Premade Videos",
  description:
    "The premade HighLevel video library: explainers, demos, ads, and animated GIFs, plus complete packs. Branded to your SaaS and delivered in 5 to 7 days.",
};

const includedIcons: IconName[] = [
  "palette",
  "layout",
  "mic",
  "badge-check",
  "package-check",
];
const howIcons: IconName[] = ["mouse-click", "palette", "package-check"];

export default function PremadePage() {
  const p = pages.premade;
  return (
    <>
      <PageHero
        chip={p.hero.chip}
        headline={p.hero.headline}
        accent={p.hero.accent}
        accentColor="gold"
        lede={p.hero.lede}
        signal={p.hero.priceSignal}
      >
        <Button href="#videos">See the videos</Button>
        <Button href={cta.bookACall.href} variant="ghost">
          {cta.bookACall.label}
        </Button>
      </PageHero>

      {/* light zone: the catalog and the spec sections read on paper */}
      <div className="theme-light">
      {/* the library: packs and the filterable catalog */}
      <section
        id="videos"
        data-bp-idx="2"
        aria-label="The video library"
        className="relative scroll-mt-24 overflow-x-clip section-pad"
      >
        <SectionGlow accent="gold" position="right" />
        <div className="shell relative">
          <SectionHead
            index={2}
            chip={p.grid.chip}
            headline={p.grid.headline}
            accent={p.grid.accent}
            accentColor="gold"
            intro={p.grid.intro}
            center
          />
          <div className="mt-12">
            <PremadeLibrary />
          </div>
        </div>
      </section>

      {/* what's included: ruled box, iconed cells */}
      <RuledSection
        bpIdx={3}
        index={3}
        chip={p.included.chip}
        headline={p.included.headline}
        accent={p.included.accent}
        accentColor="gold"
      >
        <Reveal className="grid gap-px bg-hair sm:grid-cols-2 lg:grid-cols-3">
          {p.included.items.map((item, i) => (
            <RevealItem key={item} className="h-full">
              <div
                data-cell
                className="group/cell flex h-full flex-col gap-5 bg-canvas p-8 transition-colors duration-300 hover:bg-surface"
              >
                <DrawnIcon name={includedIcons[i]} accent="gold" />
                <p className="max-w-[34ch] text-[0.9375rem] leading-relaxed text-muted">
                  {item}
                </p>
              </div>
            </RevealItem>
          ))}
          {/* the empty cell wears the blueprint hatch */}
          <RevealItem className="hidden h-full lg:block">
            <div className="relative h-full min-h-24 bg-canvas">
              <div className="absolute inset-0 hatch" aria-hidden="true" />
            </div>
          </RevealItem>
        </Reveal>
      </RuledSection>

      {/* how it works: ruled box, numbered sequence */}
      <RuledSection
        bpIdx={4}
        index={4}
        chip={p.how.chip}
        headline={p.how.headline}
        accent={p.how.accent}
        accentColor="gold"
      >
        <Reveal className="grid gap-px bg-hair sm:grid-cols-3">
          {p.how.steps.map((s, i) => (
            <RevealItem key={s.title} className="h-full">
              <div
                data-cell
                className="group/cell flex h-full flex-col bg-canvas p-8 transition-colors duration-300 hover:bg-surface"
              >
                <div className="flex items-start justify-between">
                  <DrawnIcon name={howIcons[i]} accent="gold" />
                  <span className="font-mono text-label uppercase text-gold">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-[1.1875rem] font-semibold tracking-[-0.01em] text-ink">
                  {s.title}
                </h3>
                <p className="mt-2 max-w-[38ch] text-[0.9375rem] leading-relaxed text-muted">
                  {s.line}
                </p>
              </div>
            </RevealItem>
          ))}
        </Reveal>
      </RuledSection>

      </div>

      {/* keep going: ruled box, two route-out cells */}
      <RuledSection
        bpIdx={5}
        index={5}
        chip="Keep going"
        headline="Need something"
        accent="premade can't do?"
        accentColor="gold"
      >
        <Reveal className="grid gap-px bg-hair md:grid-cols-2">
          {(
            [
              {
                eyebrow: "Custom Production",
                line: "Bespoke scripts, your positioning, built from scratch.",
                linkLabel: "See custom production",
                href: "/custom/",
                accentCls: "text-gold",
                icon: "clapperboard" as IconName,
                iconAccent: "gold" as const,
              },
              {
                eyebrow: "Video Editing",
                line: "Publishing weekly? Put an editor on a monthly plan.",
                linkLabel: "See video editing",
                href: "/editing/",
                accentCls: "text-gold",
                icon: "scissors" as IconName,
                iconAccent: "gold" as const,
              },
            ] as const
          ).map((item) => (
            <RevealItem key={item.href} className="h-full">
              <Link
                href={item.href}
                data-cell
                className="group flex h-full flex-col bg-canvas p-8 transition-colors duration-300 hover:bg-surface"
              >
                <div className="flex items-start justify-between">
                  <p
                    className={`font-mono text-label uppercase ${item.accentCls}`}
                  >
                    {item.eyebrow}
                  </p>
                  <DrawnIcon name={item.icon} accent={item.iconAccent} />
                </div>
                <p className="mt-4 max-w-[40ch] flex-1 font-display text-h3 text-ink">
                  {item.line}
                </p>
                <p
                  className={`mt-6 inline-flex items-center gap-2 text-sm font-semibold ${item.accentCls}`}
                >
                  {item.linkLabel}
                  <span
                    aria-hidden="true"
                    className="transition-transform duration-200 group-hover:translate-x-1"
                  >
                    &rarr;
                  </span>
                </p>
              </Link>
            </RevealItem>
          ))}
        </Reveal>
      </RuledSection>

      {/* proof + FAQ */}
      <section data-bp-idx="6" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <ProofStrip quote='"Great quality and quick turnaround! Will definitely work with again!" Ryan Maule, Google review' />
          <div className="mt-16">
            <SectionHead
              index={6}
              chip={p.faq.chip}
              headline={p.faq.headline}
              accent={p.faq.accent}
              accentColor="gold"
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
