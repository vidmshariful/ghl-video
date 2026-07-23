"use client";

import { useState } from "react";
import Link from "next/link";
import { bundleCategories, skuFor, type BundleTier } from "@/lib/site";

/*
 * Video bundles in three flavors: New, Classic, and Mix. A segmented
 * control switches the category; each tier is a card listing exactly
 * what it includes, with the source library tagged on every line when a
 * bundle mixes both. The featured tier carries the gold crown, matching
 * the editing plan cards. One gradient CTA per card.
 */
function BundleCard({ tier }: { tier: BundleTier }) {
  const saved = Math.round((1 - tier.price / tier.anchorPrice) * 100);
  const mixed = new Set(tier.items.map((i) => i.library)).size > 1;
  return (
    <div
      className={`relative flex h-full flex-col rounded-card border card-glass p-7 md:p-8 ${
        tier.featured ? "border-gold/50" : "border-hair"
      }`}
    >
      {tier.featured && (
        <span className="absolute -top-3 left-7 inline-flex items-center rounded-full border border-gold/50 bg-canvas px-3 py-1 font-mono text-label uppercase text-gold">
          Most popular
        </span>
      )}
      <h3 className="font-display text-h3 text-ink">{tier.name}</h3>

      {/* price with the à-la-carte value struck through */}
      <div className="mt-4 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="font-mono text-stat-lg font-bold leading-none text-gold [font-variant-numeric:tabular-nums]">
          ${tier.price.toLocaleString("en-US")}
        </span>
        <span className="font-mono text-body text-dim line-through [font-variant-numeric:tabular-nums]">
          ${tier.anchorPrice.toLocaleString("en-US")}
        </span>
        <span className="font-mono text-label uppercase text-muted">
          save {saved}%
        </span>
      </div>

      {/* exactly what's included */}
      <ul className="mt-6 flex-1">
        {tier.items.map((item) => (
          <li
            key={item.label}
            className="flex items-start gap-3 border-t border-hair py-3 first:border-t-0"
          >
            <svg
              viewBox="0 0 12 12"
              className="mt-1 h-3 w-3 shrink-0"
              aria-hidden="true"
            >
              <path
                d="M2 6.2 4.8 9 10 3.4"
                fill="none"
                stroke="var(--gold)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-body text-muted">
              {item.label}
              {mixed && (
                <span className="ml-1.5 font-mono text-label uppercase tracking-[0.08em] text-dim">
                  [{item.library}]
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-5 font-mono text-label uppercase text-dim">
        Delivery in {tier.deliveryDays} days
      </p>

      <Link
        href={`/checkout/${skuFor(tier.slug)}`}
        className="group mt-5 inline-flex items-center justify-center gap-2 rounded-[3px] bg-brand-gradient px-6 py-3.5 text-body font-semibold text-canvas shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_28px_rgba(0,204,0,0.25)] transition-all duration-200 hover:brightness-[1.07] active:scale-[0.98]"
      >
        Order Now
        <span
          aria-hidden="true"
          className="transition-transform duration-200 group-hover:translate-x-0.5"
        >
          &rarr;
        </span>
      </Link>
    </div>
  );
}

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
          <div className="mx-auto mt-10 grid max-w-4xl items-start gap-5 sm:grid-cols-2">
            {c.tiers.map((tier) => (
              <BundleCard key={tier.slug} tier={tier} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
