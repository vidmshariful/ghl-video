import Link from "next/link";
import { Checklist } from "@/components/Checklist";
import { cta } from "@/lib/site";

type Plan = {
  name: string;
  sku: string;
  price: number;
  /* published list price, struck through beside what is charged */
  anchorPrice: number;
  longForm: number;
  longFormNote?: string;
  shortForm: number;
  featured: boolean;
  note?: string;
};

/*
 * Editing plan card. Growth carries the featured treatment: gold
 * hairline crown and the "Most chosen" tag. Prices render gold, the
 * per-plan CTA is the gradient (the one button style).
 */
export function PricingTier({
  plan,
  featuredLabel,
}: {
  plan: Plan;
  featuredLabel: string;
}) {
  const saved = Math.round((1 - plan.price / plan.anchorPrice) * 100);
  const lines = [
    `${plan.longForm} long-form videos${plan.longFormNote ? ` (${plan.longFormNote})` : ""}`,
    `${plan.shortForm} short-form videos`,
    ...(plan.note ? [plan.note.charAt(0).toUpperCase() + plan.note.slice(1)] : []),
    "Unlimited revisions",
    "No contract, cancel anytime",
  ];
  return (
    <div
      className={`relative flex h-full flex-col rounded-card border card-glass p-7 md:p-8 ${
        plan.featured ? "border-gold/50" : "border-hair"
      }`}
    >
      {plan.featured && (
        <span className="absolute -top-3 left-7 inline-flex items-center rounded-full border border-gold/50 bg-canvas px-3 py-1 font-mono text-label uppercase text-gold">
          {featuredLabel}
        </span>
      )}
      <h3 className="font-display text-h3 text-ink">{plan.name}</h3>
      {/* Price on its own line, list price and saving on the next. Run as
          one row and the widest plan ($1,795 / month $2,395 save 25%)
          wraps where the others do not, which drops that card's
          checklist and misaligns all three. Two lines always. */}
      <p className="mt-4 flex items-baseline gap-2">
        <span className="font-mono text-stat-lg font-bold leading-none text-gold [font-variant-numeric:tabular-nums]">
          ${plan.price.toLocaleString("en-US")}
        </span>
        <span className="font-mono text-label uppercase text-dim">/ month</span>
      </p>
      <p className="mt-2 flex items-baseline gap-2.5">
        <span className="font-mono text-body text-dim line-through [font-variant-numeric:tabular-nums]">
          ${plan.anchorPrice.toLocaleString("en-US")}
        </span>
        <span className="font-mono text-label uppercase text-muted">
          save {saved}%
        </span>
      </p>
      <Checklist items={lines} className="mt-6 flex-1" />
      <StartEditingCta sku={plan.sku} />
    </div>
  );
}

function StartEditingCta({ sku }: { sku: string }) {
  // Subscription plans link their sku directly: it is tied to a Stripe
  // price and never goes through skuFor (see lib/site.ts).
  return (
    <Link
      href={`/checkout/${sku}`}
      className="group mt-7 inline-flex items-center justify-center gap-2 rounded-[3px] bg-brand-gradient px-6 py-3.5 text-body font-semibold text-canvas shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_28px_rgba(0,204,0,0.25)] transition-all duration-200 hover:brightness-[1.07] active:scale-[0.98]"
    >
      {cta.startEditing}
      <span
        aria-hidden="true"
        className="transition-transform duration-200 group-hover:translate-x-0.5"
      >
        &rarr;
      </span>
    </Link>
  );
}
