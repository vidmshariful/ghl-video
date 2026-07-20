import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { DrawnBorder } from "@/components/DrawnBorder";
import { FaqList } from "@/components/FaqList";
import { JsonLd } from "@/components/JsonLd";
import { Reveal, RevealItem } from "@/components/Reveal";
import { RuleList } from "@/components/RuleList";
import { RuledSection } from "@/components/RuledSection";
import { SectionGlow } from "@/components/SectionGlow";
import { SectionHead } from "@/components/SectionHead";
import { PageHero } from "@/components/pages/PageHero";
import { faqSchema, serviceSchema } from "@/lib/schema";
import { cta, oldVideos, pages } from "@/lib/site";

/*
 * Preserved ranking URL: this page holds #1 for "gohighlevel demo video"
 * on the old site, so the new site serves a real page at the exact URL
 * with the exact ranking title. Do not rename, do not redirect.
 */
export const metadata: Metadata = {
  title: "GoHighLevel White-Label Demo Video | Branded Walkthrough",
  description:
    "A white-label GoHighLevel demo video branded with your logo, dashboard theme, and voiceover, so prospects watch your platform win before the call.",
  alternates: { canonical: "/highlevel-demo-video/" },
};

export default function DemoVideoPage() {
  const p = pages.demo;
  const demos = oldVideos.filter((v) => v.type === "Demo");

  return (
    <>
      <JsonLd
        schema={[
          serviceSchema({
            name: "White-Label GoHighLevel Demo Video",
            description:
              "A branded walkthrough of the HighLevel platform: your logo, dashboard theme, and voiceover, with full commercial rights.",
            path: "/highlevel-demo-video/",
            offers: { lowPrice: 495, highPrice: 995, count: demos.length },
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
      >
        <Button href="#versions" variant="hero">
          See the versions
        </Button>
        <Button href={cta.bookACall.href} variant="ghost">
          {cta.bookACall.label}
        </Button>
      </PageHero>

      {/* 2. the three versions, with real prices and real order links */}
      <section
        id="versions"
        data-bp-idx="2"
        className="relative scroll-mt-24 overflow-x-clip section-pad"
      >
        <SectionGlow position="right" />
        <div className="shell relative">
          <SectionHead
            index={2}
            chip={p.versions.chip}
            headline={p.versions.headline}
            accent={p.versions.accent}
            intro={p.versions.intro}
          />
          <Reveal className="mt-12">
            <RevealItem>
              <ul className="overflow-hidden rounded-card border border-hair card-glass">
                {demos.map((v) => (
                  <li
                    key={v.slug}
                    className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-hair px-6 py-5 first:border-t-0 md:px-8"
                  >
                    <div className="min-w-0">
                      <p className="font-display text-h4 font-semibold text-ink">
                        {v.title}
                      </p>
                      {v.subtitle && (
                        <p className="mt-1 font-mono text-label uppercase text-dim">
                          {v.subtitle}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-5">
                      <span className="font-mono text-price text-gold [font-variant-numeric:tabular-nums]">
                        ${v.price.toLocaleString("en-US")}
                      </span>
                      <a
                        href={v.orderUrl}
                        target="_blank"
                        rel="noopener"
                        className="tap group/btn inline-flex items-center gap-1.5 whitespace-nowrap rounded-[3px] bg-brand-gradient px-4 py-2 text-body-sm font-semibold text-canvas shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
                      >
                        Order Now
                        <span
                          aria-hidden="true"
                          className="transition-transform duration-200 group-hover/btn:translate-x-0.5"
                        >
                          &rarr;
                        </span>
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-body text-muted">
                Preview every version in{" "}
                <a
                  href="/premade/"
                  className="font-semibold text-gold transition-colors hover:brightness-110"
                >
                  the library
                </a>
                , then order the one that fits your positioning.
              </p>
            </RevealItem>
          </Reveal>
        </div>
      </section>

      {/* 3. demo vs Loom: the argument this SERP actually asks about */}
      <RuledSection
        bpIdx={3}
        index={3}
        chip={p.vsLoom.chip}
        headline={p.vsLoom.headline}
        accent={p.vsLoom.accent}
      >
        <div className="px-6 py-8 md:px-8 md:py-10">
          <RuleList items={p.vsLoom.rows} framed={false} />
        </div>
      </RuledSection>

      {/* 4. faq */}
      <RuledSection
        bpIdx={4}
        index={4}
        chip={p.faq.chip}
        headline={p.faq.headline}
        accent={p.faq.accent}
      >
        <div className="mx-auto max-w-4xl px-6 py-2 md:px-8">
          <FaqList items={p.faq.items} />
        </div>
      </RuledSection>

      {/* 5. closing */}
      <section data-bp-idx="5" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <Reveal className="text-center">
            <RevealItem>
              <h2 className="mx-auto max-w-[22ch] font-display text-h2 text-ink">
                Stop demoing live.{" "}
                <span className="text-gradient">Let the video sell.</span>
              </h2>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Button href="#versions">See the versions</Button>
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
