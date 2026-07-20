import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { DrawnBorder } from "@/components/DrawnBorder";
import { MediaCard } from "@/components/MediaCard";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionGlow } from "@/components/SectionGlow";
import { CrossSell } from "@/components/pages/CrossSell";
import { PageHero } from "@/components/pages/PageHero";
import { cta, home, newSamples, pages } from "@/lib/site";

export const metadata: Metadata = {
  title: "HighLevel Video Examples and Portfolio",
  description:
    "Recent video work for HighLevel SaaS teams across premade, custom production, and editing. Every piece plays.",
  alternates: { canonical: "/work/" },
};

/* Our newest real videos as the portfolio. Expands as more ship. */
const pieces = newSamples;

export default function WorkPage() {
  const p = pages.work;
  return (
    <>
      <PageHero
        chip={p.hero.chip}
        headline={p.hero.headline}
        accent={p.hero.accent}
        lede={p.hero.lede}
      >
        <Button href={cta.bookACall.href} variant="hero">
          {cta.bookACall.label}
        </Button>
        <Button href={cta.seePremade.href} variant="ghost">
          {cta.seePremade.label}
        </Button>
      </PageHero>

      <section data-bp-idx="2" className="relative overflow-x-clip section-pad">
        <SectionGlow position="right" />
        <div className="shell relative">
          <Reveal className="grid gap-6">
            {/* featured piece full width, then two-up rows */}
            <RevealItem>
              <MediaCard
                src={pieces[0].src}
                poster={pieces[0].poster}
                title={pieces[0].title}
                meta={pieces[0].format}
              />
            </RevealItem>
            <RevealItem className="grid gap-6 md:grid-cols-2">
              {pieces.slice(1).map((piece) => (
                <MediaCard
                  key={piece.src}
                  src={piece.src}
                  poster={piece.poster}
                  title={piece.title}
                  meta={piece.format}
                />
              ))}
            </RevealItem>
          </Reveal>
          <Reveal className="mt-8">
            <RevealItem>
              <p className="font-mono text-label uppercase text-dim">
                {p.note}
              </p>
            </RevealItem>
          </Reveal>
        </div>
      </section>

      {/* client stories from the homepage feed proof here too */}
      <section data-bp-idx="3" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <Reveal className="grid gap-6 md:grid-cols-3">
            {home.videoTestimonials.items.map((item) => (
              <RevealItem key={item.name}>
                <MediaCard
                  src={item.src}
                  poster={item.poster}
                  title={item.name}
                  meta={item.company}
                  label={`Testimonial from ${item.name}, ${item.company}`}
                />
              </RevealItem>
            ))}
          </Reveal>
        </div>
      </section>

      <div className="theme-light">
      <section data-bp-idx="4" className="relative section-pad-sm">
        <div className="shell">
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
                href: "/custom-video/",
                icon: "clapperboard",
              },
            ]}
          />
        </div>
      </section>
      </div>
    </>
  );
}
