"use client";

import { useState } from "react";
import { bundleCategories, cta, skuFor } from "@/lib/site";
import { PricingCards } from "@/components/PricingCards";

/*
 * Video bundles in three flavors: New, Classic, and Mix. A segmented
 * control switches the category; each tier renders on the shared
 * pricing lattice (PricingCards, the client's dashed-frame model), with
 * the source library tagged on every line when a bundle mixes both.
 */
export function VideoBundles() {
  const [cat, setCat] = useState(bundleCategories[0].slug);
  const active =
    bundleCategories.find((c) => c.slug === cat) ?? bundleCategories[0];

  return (
    <div>
      {/* category switcher */}
      <div
        role="tablist"
        aria-label="Bundle type"
        className="mx-auto flex w-fit flex-wrap justify-center gap-1 rounded-[4px] border border-hair bg-surface/60 p-1"
      >
        {bundleCategories.map((c) => {
          const isActive = c.slug === active.slug;
          return (
            <button
              key={c.slug}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setCat(c.slug)}
              className={`tap rounded-[3px] px-4 py-2 font-mono text-label uppercase transition-colors ${
                isActive
                  ? "bg-gold/15 font-semibold text-gold"
                  : "text-muted hover:text-ink"
              }`}
            >
              {c.name}
            </button>
          );
        })}
      </div>

      {/* every category renders into the HTML (crawlable); only the
          active one displays */}
      {bundleCategories.map((c) => (
        <div key={c.slug} hidden={c.slug !== active.slug}>
          <p className="mx-auto mt-5 max-w-[var(--measure-body)] text-center text-body leading-relaxed text-muted">
            {c.blurb}
          </p>
          <div className="mx-auto mt-10 max-w-4xl">
            <PricingCards
              columns={2}
              cards={c.tiers.map((tier) => {
                const mixed = new Set(tier.items.map((i) => i.library)).size > 1;
                return {
                  name: tier.name,
                  priceLabel: `$${tier.price.toLocaleString("en-US")}`,
                  anchor: `$${tier.anchorPrice.toLocaleString("en-US")}`,
                  saveNote: `save ${Math.round((1 - tier.price / tier.anchorPrice) * 100)}%`,
                  features: tier.items.map((i) => ({
                    text: i.label,
                    tag: mixed ? i.library : undefined,
                  })),
                  footNote: `Delivery in ${tier.deliveryDays} days`,
                  featured: tier.featured,
                  featuredLabel: tier.featured ? "Most popular" : undefined,
                  cta: {
                    label: cta.orderPremade,
                    href: `/checkout/${skuFor(tier.slug)}`,
                  },
                };
              })}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
