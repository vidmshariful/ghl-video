import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { PremadeLibrary } from "@/components/PremadeLibrary";
import {
  featuredBrowse,
  libraryBrowse,
  libraryGroups,
  recentBrowse,
} from "@/components/premade/catalog";
import { getCatalog, recentCutoff } from "@/lib/catalog-db";
import { Reveal } from "@/components/Reveal";
import { SectionGlow } from "@/components/SectionGlow";
import { productCatalogSchema, serviceSchema } from "@/lib/schema";
import { cta, deliveryWindow, sellableProducts, site } from "@/lib/site";

/*
 * The full library, on a page of its own.
 *
 * It used to be a section inside /premade, which is a sales page with a job of
 * its own. Eighty videos inside a page that is also arguing why you should buy
 * at all meant browsing fought selling and both lost: the deepest part of what
 * we sell was the hardest part to actually look at.
 *
 * Open to everybody, deliberately. No account to browse, no account to watch,
 * no account to buy. Signing in adds to this page rather than unlocking it,
 * which is the opposite of putting a catalogue behind a wall.
 *
 * /premade keeps its nav place, its five inherited redirects and its job. What
 * it keeps of the library is a taster and a way through to here.
 */

const RECENT_DAYS = 120;

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/library/", {
    title: "The GoHighLevel Video Library",
    description: `Every premade GoHighLevel video we make: explainers, demos, feature animations, marketing videos and complete packs. White-labeled to your SaaS and delivered in ${deliveryWindow}.`,
    alternates: { canonical: "/library/" },
  });
}

export default async function LibraryPage() {
  const rows = await getCatalog();
  const cutoff = recentCutoff(RECENT_DAYS);
  const featured = featuredBrowse(rows);
  const recent = recentBrowse(rows, cutoff);
  const full = libraryBrowse(rows);
  const fullGroups = libraryGroups(full);

  /* every sellable one-time product with its on-domain checkout, derived from
     the one sellable-catalog source so it can never drift from the prices the
     cards show */
  const catalog = sellableProducts
    .filter((prod) => prod.type === "one_time" && prod.priceCents > 0)
    .map((prod) => ({
      name: prod.name,
      price: prod.priceCents / 100,
      url: `${site.url}/checkout/${prod.sku}`,
    }));
  const prices = catalog.map((c) => c.price);

  return (
    <main>
      <JsonLd
        schema={[
          serviceSchema({
            name: "The GoHighLevel Video Library",
            description:
              "Every premade HighLevel video we make: explainers, demos, feature animations, marketing videos and complete packs. Branded to your SaaS and delivered in days.",
            path: "/library/",
            offers: {
              lowPrice: Math.min(...prices),
              highPrice: Math.max(...prices),
              count: catalog.length,
            },
          }),
          productCatalogSchema(catalog),
        ]}
      />

      {/* A short header, not a hero. Somebody arriving here came to look at
          videos, and a screen of argument before the first thumbnail is the
          thing this page exists to stop. */}
      <section className="relative overflow-x-clip pb-6 pt-16 md:pt-24">
        <SectionGlow position="left" />
        <div className="shell relative">
          <Reveal>
            <p className="font-mono text-label uppercase tracking-[0.14em] text-dim">
              The library
            </p>
            <h1 className="mt-3 max-w-[16ch] font-display text-hero tracking-tight text-text">
              Every video we make, <span className="text-gradient">ready for your brand</span>
            </h1>
            <p className="mt-5 max-w-[var(--measure-lede)] text-lede text-muted">
              {full.length} videos, white-labeled to your SaaS and delivered in{" "}
              {deliveryWindow}. Watch anything here, buy one on its own, or take
              a pack. No account needed to look.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={cta.requestQuote.href}
                className="tap rounded-[3px] border border-hair px-5 py-3 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
              >
                {cta.requestQuote.label}
              </Link>
              <Link
                href="/premade/"
                className="tap rounded-[3px] border border-hair px-5 py-3 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
              >
                How premade works
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section
        id="videos"
        aria-label="The video library"
        className="relative scroll-mt-24 overflow-x-clip pb-24"
      >
        <div className="shell relative">
          <PremadeLibrary
            featured={featured}
            recent={recent}
            full={full}
            fullGroups={fullGroups}
          />
        </div>
      </section>
    </main>
  );
}
