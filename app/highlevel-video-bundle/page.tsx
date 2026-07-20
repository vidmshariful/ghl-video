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
import { VideoBundles } from "@/components/VideoBundles";
import { PageHero } from "@/components/pages/PageHero";
import { faqSchema, serviceSchema } from "@/lib/schema";
import { cta, pages } from "@/lib/site";

/*
 * Preserved ranking URL: this page holds #1 for "highlevel video bundle"
 * on the old site, so the new site serves a real page at the exact URL
 * with the exact ranking title. Do not rename, do not redirect.
 */
export const metadata: Metadata = {
  title: "GoHighLevel Video Bundle | White-Label Packages",
  description:
    "White-label GoHighLevel video bundles covering the full funnel: new releases, the Classic Library, or a mix, branded to your SaaS and delivered in days.",
  alternates: { canonical: "/highlevel-video-bundle/" },
};

export default function VideoBundlePage() {
  const p = pages.bundles;

  return (
    <>
      <JsonLd
        schema={[
          serviceSchema({
            name: "GoHighLevel Video Bundles",
            description:
              "White-label video bundles for HighLevel SaaS: explainers, demos, and feature videos in one order, branded to your platform.",
            path: "/highlevel-video-bundle/",
            offers: { lowPrice: 995 },
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
        <Button href="#bundles" variant="hero">
          See the bundles
        </Button>
        <Button href={cta.bookACall.href} variant="ghost">
          {cta.bookACall.label}
        </Button>
      </PageHero>

      {/* 2. the bundles themselves */}
      <section
        id="bundles"
        data-bp-idx="2"
        className="relative scroll-mt-24 overflow-x-clip section-pad"
      >
        <SectionGlow position="left" />
        <div className="shell relative">
          <SectionHead
            index={2}
            chip={p.picker.chip}
            headline={p.picker.headline}
            accent={p.picker.accent}
            intro={p.picker.intro}
            center
          />
          <div className="mt-12">
            <VideoBundles />
          </div>
        </div>
      </section>

      {/* 3. what every bundle includes: a list, not another card wall */}
      <RuledSection
        bpIdx={3}
        index={3}
        chip="What is included"
        headline="Every bundle ships"
        accent="white-label."
      >
        <div className="px-6 py-8 md:px-8 md:py-10">
          <RuleList items={p.included} columns={2} framed={false} />
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
                One order.{" "}
                <span className="text-gradient">A full video funnel.</span>
              </h2>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Button href="#bundles">See the bundles</Button>
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
