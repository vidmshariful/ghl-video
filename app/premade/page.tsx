import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { Checklist } from "@/components/Checklist";
import { DrawnBorder } from "@/components/DrawnBorder";
import { FaqList } from "@/components/FaqList";
import { Panel } from "@/components/Panel";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionGlow } from "@/components/SectionGlow";
import { SectionHead } from "@/components/SectionHead";
import { StepFlow } from "@/components/StepFlow";
import { VideoCard } from "@/components/VideoCard";
import { CrossSell } from "@/components/pages/CrossSell";
import { PageHero } from "@/components/pages/PageHero";
import { ProofStrip } from "@/components/pages/ProofStrip";
import { cta, pages, premadeVideos } from "@/lib/site";

export const metadata: Metadata = {
  title: "Premade Videos",
  description:
    "Professional HighLevel videos branded to your SaaS: your logo, your dashboard theme, your voiceover. Delivered in 5 to 7 days with full commercial rights.",
};

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

      {/* the grid: the page's reason to exist */}
      <section
        id="videos"
        data-bp-idx="2"
        aria-label="The launch set"
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
          />
          <Reveal className="mt-12 grid gap-6 lg:grid-cols-2">
            {premadeVideos.map((video) => (
              <RevealItem key={video.slug}>
                <VideoCard video={video} />
              </RevealItem>
            ))}
          </Reveal>
        </div>
      </section>

      {/* what's included */}
      <section data-bp-idx="3" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <div className="grid items-start gap-12 lg:grid-cols-2">
            <SectionHead
              index={3}
              chip={p.included.chip}
              headline={p.included.headline}
              accent={p.included.accent}
              accentColor="gold"
            />
            <Reveal>
              <RevealItem>
                <Panel ticks={false} className="p-7 md:p-8">
                  <Checklist items={p.included.items} accent="gold" />
                </Panel>
              </RevealItem>
            </Reveal>
          </div>
        </div>
      </section>

      {/* how it works */}
      <section data-bp-idx="4" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <SectionHead
            index={4}
            chip={p.how.chip}
            headline={p.how.headline}
            accent={p.how.accent}
            accentColor="gold"
          />
          <div className="mt-12">
            <StepFlow steps={p.how.steps} accent="gold" />
          </div>
        </div>
      </section>

      {/* cross-sell */}
      <section data-bp-idx="5" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <SectionHead
            index={5}
            chip="Keep going"
            headline="Need something"
            accent="premade can't do?"
            accentColor="gold"
          />
          <div className="mt-10">
            <CrossSell
              items={[
                {
                  eyebrow: "Custom Production",
                  line: "Bespoke scripts, your positioning, built from scratch.",
                  linkLabel: "See custom production",
                  href: "/custom/",
                  accent: "green",
                },
                {
                  eyebrow: "Video Editing",
                  line: "Publishing weekly? Put an editor on a monthly plan.",
                  linkLabel: "See video editing",
                  href: "/editing/",
                  accent: "blue",
                },
              ]}
            />
          </div>
        </div>
      </section>

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
