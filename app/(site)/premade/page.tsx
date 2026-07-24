import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/Button";
import { DrawnBorder } from "@/components/DrawnBorder";
import { DrawnIcon, type IconName } from "@/components/DrawnIcon";
import { FaqList } from "@/components/FaqList";
import { JsonLd } from "@/components/JsonLd";
import { PremadeLibrary } from "@/components/PremadeLibrary";
import { Reveal, RevealItem } from "@/components/Reveal";
import { RuleList } from "@/components/RuleList";
import { RuledSection } from "@/components/RuledSection";
import { SectionGlow } from "@/components/SectionGlow";
import { SectionHead } from "@/components/SectionHead";
import { VideoBundles } from "@/components/VideoBundles";
import { PageHero } from "@/components/pages/PageHero";
import { ProcessTimeline } from "@/components/pages/ProcessTimeline";
import { ProofStrip } from "@/components/pages/ProofStrip";
import { TrustStrip } from "@/components/home/TrustStrip";
import { faqSchema, productCatalogSchema, serviceSchema } from "@/lib/schema";
import { cta, pages, sellableProducts, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "GoHighLevel White-Label Videos and Video Packs",
  description:
    "The premade GoHighLevel video library: explainers, demos, ads, and animated GIFs, plus complete packs. White-labeled to your SaaS and delivered in 5 to 7 days.",
  alternates: { canonical: "/premade/" },
};

const howIcons: IconName[] = ["mouse-click", "palette", "package-check"];

export default function PremadePage() {
  const p = pages.premade;
  /* every purchasable one-time SKU, machine-readable: singles, packs, the
     stack, and all bundle tiers, each pointing at its on-domain checkout.
     Derived from the one sellable-catalog source so it never drifts. */
  const catalog = sellableProducts
    .filter((prod) => prod.type === "one_time" && prod.priceCents > 0)
    .map((prod) => ({
      name: prod.name,
      price: prod.priceCents / 100,
      url: `${site.url}/checkout/${prod.sku}`,
    }));
  const prices = catalog.map((c) => c.price);
  return (
    <>
      <JsonLd
        schema={[
          serviceSchema({
            name: "Premade HighLevel Videos",
            description:
              "The premade HighLevel video library: explainers, demos, ads, and animated GIFs, plus complete packs. Branded to your SaaS and delivered in days.",
            path: "/premade/",
            offers: {
              lowPrice: Math.min(...prices),
              highPrice: Math.max(...prices),
              count: catalog.length,
            },
          }),
          faqSchema(p.faq.items),
          productCatalogSchema(catalog),
        ]}
      />

      <PageHero
        chip={p.hero.chip}
        headline={p.hero.headline}
        accent={p.hero.accent}
        lede={p.hero.lede}
        signal={p.hero.priceSignal}
      >
        <Button href="#videos">See the videos</Button>
        <Button href={cta.bookACall.href} variant="ghost">
          {cta.bookACall.label}
        </Button>
      </PageHero>

      {/* trusted-by logo strip, directly under the hero */}
      <TrustStrip />

      {/* light zone: the catalog and the spec sections read on paper */}
      <div className="theme-light">
      {/* the library: packs and the filterable catalog */}
      <section
        id="videos"
        data-bp-idx="2"
        aria-label="The video library"
        className="relative scroll-mt-24 overflow-x-clip section-pad"
      >
        <SectionGlow position="right" />
        <div className="shell relative">
          <SectionHead
            index={2}
            chip={p.grid.chip}
            headline={p.grid.headline}
            accent={p.grid.accent}
            intro={p.grid.intro}
            center
          />
          <div className="mt-12">
            <PremadeLibrary />
          </div>
        </div>
      </section>

      {/* build-your-own bundles: pick any videos from the library */}
      <section
        data-bp-idx="3"
        aria-label="Video bundles"
        className="relative overflow-x-clip section-pad"
      >
        <SectionGlow position="left" />
        <div className="shell relative">
          <SectionHead
            index={3}
            chip="Bundle and save"
            headline="Bundle up and"
            accent="save more."
            intro="Three ways to bundle: our newest releases, the classic library at reduced prices, or a mix of both. Every video white-labeled to your SaaS."
            center
          />
          <div className="mt-12">
            <VideoBundles />
          </div>
        </div>
      </section>

      {/* what is included: a flat list of facts reads as a list, not a
          wall of cards. Rule rows inside the ruled box. */}
      <RuledSection
        bpIdx={4}
        index={4}
        chip={p.included.chip}
        headline={p.included.headline}
        accent={p.included.accent}
      >
        <div className="px-6 py-8 md:px-8 md:py-10">
          <RuleList
            items={p.included.items.map((line) => ({ line }))}
            columns={2}
            framed={false}
          />
        </div>
      </RuledSection>

      {/* how it works: a connected scroll timeline */}
      <section data-bp-idx="5" className="relative overflow-x-clip section-pad">
        <SectionGlow position="right" />
        <div className="shell relative">
          <SectionHead
            index={5}
            chip={p.how.chip}
            headline={p.how.headline}
            accent={p.how.accent}
            center
          />
          <div className="mt-14 md:mt-16">
            <ProcessTimeline steps={p.how.steps} icons={howIcons} />
          </div>
        </div>
      </section>

      </div>

      {/* keep going: ruled box, two route-out cells */}
      <RuledSection
        bpIdx={6}
        index={6}
        chip="Keep going"
        headline="Need something"
        accent="premade cannot do?"
      >
        <Reveal className="grid gap-px bg-hair md:grid-cols-2">
          {(
            [
              {
                eyebrow: "Custom Production",
                line: "Bespoke scripts, your positioning, built from scratch.",
                linkLabel: "See custom production",
                href: "/custom-video/",
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
                  <DrawnIcon name={item.icon} />
                </div>
                <p className="mt-4 max-w-[40ch] flex-1 font-display text-h3 text-ink">
                  {item.line}
                </p>
                <p
                  className={`mt-6 inline-flex items-center gap-2 text-body font-semibold ${item.accentCls}`}
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
      <section data-bp-idx="7" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <ProofStrip quote='"Great quality and quick turnaround! Will definitely work with again!" Ryan Maule, Google review' />
          <div className="mt-16">
            <SectionHead
              index={7}
              chip={p.faq.chip}
              headline={p.faq.headline}
              accent={p.faq.accent}
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
