import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { Button } from "@/components/Button";
import { CapacityChip } from "@/components/CapacityChip";
import { DrawnBorder } from "@/components/DrawnBorder";
import { DrawnIcon, type IconName } from "@/components/DrawnIcon";
import { FaqList } from "@/components/FaqList";
import { CtaBand } from "@/components/CtaBand";
import { JsonLd } from "@/components/JsonLd";
import { VideoBrowser } from "@/components/premade/browser";
import { PremadeExplainer } from "@/components/premade/PremadeExplainer";
import { featuredBrowse, libraryBrowse } from "@/components/premade/catalog";
import { getCatalog } from "@/lib/catalog-db";
import { Reveal, RevealItem } from "@/components/Reveal";
import { RuleList } from "@/components/RuleList";
import { RuledSection } from "@/components/RuledSection";
import { SectionGlow } from "@/components/SectionGlow";
import { SectionHead } from "@/components/SectionHead";
import { PageHero } from "@/components/pages/PageHero";
import { ChaseHeroReviewer } from "@/components/home/ChaseHeroReviewer";
import { ProcessSection } from "@/components/pages/ProcessSection";
import { ProofStrip } from "@/components/pages/ProofStrip";
import { WhiteLabelDemo } from "@/components/pages/WhiteLabelDemo";
import { TrustStrip } from "@/components/home/TrustStrip";
import { FeaturedTestimonial } from "@/components/home/FeaturedTestimonial";
import { VideoTestimonials } from "@/components/home/VideoTestimonials";
import { MediaFrame } from "@/components/MediaFrame";
import { faqSchema, productCatalogSchema, serviceSchema } from "@/lib/schema";
import { cta, deliveryWindow, pages, recentDeliveries, sellableProducts, site } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/premade/", {
    title: "GoHighLevel White-Label Videos and Video Packs",
    description: `The premade GoHighLevel video library: explainers, demos, ads, and animated GIFs, plus complete packs. White-labeled to your SaaS and delivered in ${deliveryWindow}.`,
    alternates: { canonical: "/premade/" },
  });
}

const howIcons: IconName[] = ["mouse-click", "palette", "package-check"];

export default async function PremadePage() {
  const p = pages.premade;

  /* the admin-managed catalog, with a complete code fallback if the backend
     is unreachable. Feeds the three grid tabs; the two packs stay in code. */
  const rows = await getCatalog();
  const featured = featuredBrowse(rows);
  /* full is still counted, to say honestly how much more there is */
  const full = libraryBrowse(rows);

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
        note={<CapacityChip service="premade" />}
        reviewer={<ChaseHeroReviewer />}
      >
        {/* gradient is the reserved hero treatment (see components/Button.tsx);
            this slot had been on the deep primary fill, so neither hero button
            carried the signature and the two read as equal weight */}
        <Button href={cta.browseLibrary.href} variant="gradient">
          {cta.browseLibrary.label}
        </Button>
        <Button href={cta.bookACall.href} variant="ghost">
          {cta.bookACall.label}
        </Button>
      </PageHero>

      {/* trusted-by logo strip, directly under the hero */}
      <TrustStrip />

      {/* what premade video is + what every order includes: an intro for buyers
          and real indexable copy for SEO, before the library */}
      <section
        aria-label="What premade video is"
        className="relative overflow-x-clip section-pad"
      >
        <SectionGlow position="left" />
        <PremadeExplainer />
      </section>

      <div>
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
          {/*
            * A taster, not the catalogue.
            *
            * The whole library used to sit here, which meant a page whose job
            * is arguing why premade video is worth buying was also asking
            * somebody to browse eighty things. Browsing fought selling and
            * both lost. The library has a page of its own now; this is the
            * handful that makes the case, each one buyable on the spot.
            */}
          <div className="mt-12">
            {/* no inner scrollbox: this is a curated handful, and a second
                scrollbar inside the page hid most of them */}
            <VideoBrowser videos={featured} groups={[]} scroll={false} />
          </div>

          <Reveal>
            <div className="mt-10 flex flex-col items-center gap-4 border-t border-hair pt-10 text-center">
              <p className="max-w-[var(--measure-body)] text-body text-muted">
                That is {featured.length} of {full.length}. The rest live in the
                library, where you can watch anything before you buy it.
              </p>
              <Button href={cta.browseLibrary.href} variant="gradient">
                See the full library
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* what is included: the claims on the left, the proof on the
          right. The toggle flips the same video between the HighLevel
          default cut and the branded cut, so white-label is something
          the buyer does, not something they read. */}
      <RuledSection
        bpIdx={3}
        index={3}
        chip={p.included.chip}
        headline={p.included.headline}
        accent={p.included.accent}
      >
        <div className="grid gap-px bg-hair lg:grid-cols-[1fr_1.25fr]">
          <div className="bg-canvas px-6 py-8 md:px-8">
            <RuleList
              items={p.included.items.map((line) => ({ line }))}
              framed={false}
            />
          </div>
          <div className="bg-canvas px-6 py-8 md:px-8 md:py-10">
            <WhiteLabelDemo
              defaultCut={p.included.demo.defaultCut}
              brandedCut={p.included.demo.brandedCut}
            />
          </div>
        </div>
      </RuledSection>

      {/* recent deliveries: branded client work so a buyer sees the outcome */}
      <section
        data-bp-idx="4"
        aria-label="Recent deliveries"
        className="relative overflow-x-clip section-pad"
      >
        <SectionGlow position="left" />
        <div className="shell relative">
          <SectionHead
            index={4}
            chip="Recent work"
            headline="Recently delivered,"
            accent="branded to real SaaS."
            intro="A slice of what we shipped lately. Every frame is white-labeled to the client: their logo, their dashboard, their voiceover. Yours will look like this."
            center
          />
          <div className="mt-12 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {recentDeliveries.map((v) => (
              <div key={v.src} className="group/card">
                <MediaFrame
                  src={v.src}
                  poster={v.poster}
                  label={v.label}
                  tint
                  rounded="rounded-none"
                  caption={{ title: "Delivered", sub: v.sub }}
                />
                <div className="border-b border-hair px-1 pb-4 pt-3.5">
                  <h3 className="font-display text-h4 font-semibold leading-snug tracking-[-0.01em] text-ink">
                    {v.label}
                  </h3>
                  <p className="mt-1 font-mono text-label uppercase text-dim">{v.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* how it works: a connected scroll timeline */}
      <ProcessSection
        bpIdx={5}
        glow="right"
        chip={p.how.chip}
        headline={p.how.headline}
        accent={p.how.accent}
        intro={p.how.intro}
        cta={p.how.cta}
        video={p.how.video}
        arts={["order", "brand-kit", "delivery"] as const}
        steps={p.how.steps}
        icons={howIcons}
      />

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

      {/* Chase Buckner on camera. Authority proof, and un-numbered by its own
          design so it reads as the headline endorsement rather than a step.
          This page had only his pull quote as text; the sales page has carried
          the video all along. */}
      <FeaturedTestimonial />

      {/* the customer founders, in their own words */}
      <VideoTestimonials index={7} />

      {/* proof + FAQ */}
      <section data-bp-idx="8" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <ProofStrip />
          <div className="mt-16">
            <SectionHead
              index={8}
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
        </div>
      </section>
      <CtaBand
        bpIdx={9}
        headline={p.closing.headline}
        accent={p.closing.accent}
        sub={p.closing.sub}
        cta={p.closing.cta}
      />
    </>
  );
}
