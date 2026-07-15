import { Checklist } from "@/components/Checklist";
import { Reveal, RevealItem } from "@/components/Reveal";
import { videoBundles, type VideoBundle } from "@/lib/site";

/*
 * Build-your-own bundles. Each tier is a flat price for a number of
 * videos the buyer picks from anywhere in the library. Growth carries
 * the featured treatment (gold hairline crown, "Most popular"), matching
 * the editing plan cards. The pick count is the gold hero; the price
 * sits under it with the à-la-carte value struck through.
 */
function BundleCard({ bundle }: { bundle: VideoBundle }) {
  const saved = Math.round((1 - bundle.price / bundle.anchorPrice) * 100);
  const lines = [
    `Any ${bundle.pick} videos from the full library`,
    "Mix explainers, demos, short, marketing, and feature animations",
    "Every video white-labeled to your SaaS",
    `Delivery in ${bundle.deliveryDays} days`,
  ];
  return (
    <div
      className={`relative flex h-full flex-col rounded-card border card-glass p-7 md:p-8 ${
        bundle.featured ? "border-gold/50" : "border-hair"
      }`}
    >
      {bundle.featured && (
        <span className="absolute -top-3 left-7 inline-flex items-center rounded-full border border-gold/50 bg-canvas px-3 py-1 font-mono text-label uppercase text-gold">
          Most popular
        </span>
      )}
      <h3 className="font-display text-h3 text-ink">{bundle.name}</h3>
      <p className="mt-1.5 text-sm text-muted">{bundle.blurb}</p>

      {/* the pick count leads: this is what the tier buys you */}
      <div className="mt-6 flex items-baseline gap-2.5">
        <span className="font-mono text-[3rem] font-bold leading-none text-gold [font-variant-numeric:tabular-nums]">
          {bundle.pick}
        </span>
        <span className="font-mono text-label uppercase leading-tight text-muted">
          videos,
          <br />
          your pick
        </span>
      </div>

      {/* price with the à-la-carte value struck through */}
      <div className="mt-5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="font-mono text-[1.5rem] font-bold text-gold [font-variant-numeric:tabular-nums]">
          ${bundle.price.toLocaleString("en-US")}
        </span>
        <span className="font-mono text-[0.9375rem] text-dim line-through [font-variant-numeric:tabular-nums]">
          ${bundle.anchorPrice.toLocaleString("en-US")}
        </span>
        <span className="font-mono text-label uppercase text-muted">
          save {saved}%
        </span>
      </div>

      <Checklist items={lines} accent="gold" className="mt-6 flex-1" />

      <a
        href={bundle.orderUrl}
        target="_blank"
        rel="noopener"
        className="group mt-7 inline-flex items-center justify-center gap-2 rounded-[3px] bg-brand-gradient px-6 py-3.5 text-[0.9375rem] font-semibold text-[#08090D] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_28px_rgba(0,204,0,0.25)] transition-all duration-200 hover:brightness-[1.07] active:scale-[0.98]"
      >
        Get the bundle
        <span
          aria-hidden="true"
          className="transition-transform duration-200 group-hover:translate-x-0.5"
        >
          &rarr;
        </span>
      </a>
    </div>
  );
}

export function VideoBundles() {
  return (
    <Reveal className="grid items-start gap-6 lg:grid-cols-3">
      {videoBundles.map((bundle) => (
        <RevealItem key={bundle.slug} className="h-full">
          <BundleCard bundle={bundle} />
        </RevealItem>
      ))}
    </Reveal>
  );
}
