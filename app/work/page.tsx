import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { DrawnBorder } from "@/components/DrawnBorder";
import { MediaFrame } from "@/components/MediaFrame";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionGlow } from "@/components/SectionGlow";
import { CrossSell } from "@/components/pages/CrossSell";
import { PageHero } from "@/components/pages/PageHero";
import { clipWindows, clips, cta, home, pages, posters } from "@/lib/site";

export const metadata: Metadata = {
  title: "Our Work",
  description:
    "Recent video work for HighLevel SaaS teams across premade, custom production, and editing. Every piece plays.",
};

/* PLACEHOLDER portfolio: the homepage sample set, expanded here until
 * Shariful sends the final portfolio list. Attributions match the
 * homepage so no clip carries two client names. */
const pieces = [
  {
    key: "featured" as const,
    client: "NeoLuxLabs",
    format: "Onboarding Series",
  },
  { key: "sampleA" as const, client: "Emma.io", format: "Platform Demo" },
  { key: "sampleB" as const, client: "AI Clinic Assist", format: "Explainer" },
  { key: "sampleC" as const, client: "Premade launch set", format: "Premade" },
  { key: "reel" as const, client: "Studio reel", format: "Mixed formats" },
];

export default function WorkPage() {
  const p = pages.work;
  return (
    <>
      <PageHero
        chip={p.hero.chip}
        headline={p.hero.headline}
        accent={p.hero.accent}
        accentColor="green"
        lede={p.hero.lede}
      >
        <Button href={cta.bookACall.href}>{cta.bookACall.label}</Button>
        <Button href={cta.seePremade.href} variant="ghost">
          {cta.seePremade.label}
        </Button>
      </PageHero>

      <section data-bp-idx="2" className="relative overflow-x-clip section-pad">
        <SectionGlow accent="green" position="right" />
        <div className="shell relative">
          <Reveal className="grid gap-6">
            {/* featured piece full width, then two-up rows */}
            <RevealItem>
              <MediaFrame
                src={clips[pieces[0].key]}
                poster={posters[pieces[0].key]}
                label={`${pieces[0].client}, ${pieces[0].format}`}
                caption={{ title: pieces[0].client, sub: pieces[0].format }}
                rounded="rounded-card"
                {...(clipWindows[pieces[0].key]
                  ? {
                      startAt: clipWindows[pieces[0].key]!.startAt,
                      endAt: clipWindows[pieces[0].key]!.endAt,
                    }
                  : {})}
              />
            </RevealItem>
            <RevealItem className="grid gap-6 md:grid-cols-2">
              {pieces.slice(1).map((piece) => (
                <MediaFrame
                  key={piece.key}
                  src={clips[piece.key]}
                  poster={posters[piece.key]}
                  label={`${piece.client}, ${piece.format}`}
                  caption={{ title: piece.client, sub: piece.format }}
                  {...(clipWindows[piece.key]
                    ? {
                        startAt: clipWindows[piece.key]!.startAt,
                        endAt: clipWindows[piece.key]!.endAt,
                      }
                    : {})}
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
                <MediaFrame
                  src={item.src}
                  poster={item.poster}
                  label={`Testimonial from ${item.name}, ${item.company}`}
                  caption={{ title: item.name, sub: item.company }}
                  {...("startAt" in item
                    ? { startAt: item.startAt, endAt: item.endAt }
                    : {})}
                />
              </RevealItem>
            ))}
          </Reveal>
        </div>
      </section>

      <section data-bp-idx="4" className="relative pb-24">
        <DrawnBorder />
        <div className="shell pt-16">
          <CrossSell
            items={[
              {
                eyebrow: "Premade Videos",
                line: "The fastest path from this page to your own video.",
                linkLabel: "See premade videos",
                href: "/premade/",
                accent: "gold",
              },
              {
                eyebrow: "Custom Production",
                line: "Something bespoke, scripted for your positioning.",
                linkLabel: "See custom production",
                href: "/custom/",
                accent: "green",
              },
            ]}
          />
        </div>
      </section>
    </>
  );
}
