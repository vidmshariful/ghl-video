import { Checklist } from "@/components/Checklist";

type Plan = {
  name: string;
  price: number;
  longForm: number;
  longFormNote?: string;
  shortForm: number;
  featured: boolean;
  note?: string;
  orderUrl: string;
};

/*
 * Editing plan card. Growth carries the featured treatment: blue
 * hairline crown and the "Most chosen" tag. Prices render gold, the
 * per-plan CTA keeps the fixed vocabulary ("Start editing").
 */
export function PricingTier({
  plan,
  featuredLabel,
}: {
  plan: Plan;
  featuredLabel: string;
}) {
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
        plan.featured ? "border-blue/50" : "border-hair"
      }`}
    >
      {plan.featured && (
        <span className="absolute -top-3 left-7 inline-flex items-center rounded-full border border-blue/50 bg-canvas px-3 py-1 font-mono text-label uppercase text-blue">
          {featuredLabel}
        </span>
      )}
      <h3 className="font-display text-h3 text-ink">{plan.name}</h3>
      <p className="mt-4 flex items-baseline gap-2">
        <span className="font-mono text-[2.25rem] font-bold leading-none text-gold [font-variant-numeric:tabular-nums]">
          ${plan.price.toLocaleString("en-US")}
        </span>
        <span className="font-mono text-label uppercase text-dim">/ month</span>
      </p>
      <Checklist items={lines} accent="blue" className="mt-6 flex-1" />
      <a
        href={plan.orderUrl}
        target="_blank"
        rel="noopener"
        className={`group mt-7 inline-flex items-center justify-center gap-2 rounded-[3px] px-6 py-3.5 text-[0.9375rem] font-semibold transition-all duration-200 active:scale-[0.98] ${
          plan.featured
            ? "bg-brand-gradient text-[#08090D] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_28px_rgba(0,204,0,0.25)] hover:brightness-[1.07]"
            : "bg-green text-[#08090D] hover:brightness-110"
        }`}
      >
        Start editing
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
