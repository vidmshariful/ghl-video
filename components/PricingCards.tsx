import { Button } from "@/components/Button";
import { Reveal, RevealItem } from "@/components/Reveal";

/*
 * The pricing lattice, to the client's model (July 2026): every card
 * sits in the same dashed hairline frame, inside and out, and nothing
 * uses a solid border. The one highlighted card is lifted by a deep
 * gold-tinted gradient FILL (never a border) plus a small dashed tag
 * riding the top rule. Card anatomy, top to bottom: name, one-line
 * blurb, the price with its note (struck anchor when real), a dashed
 * divider, the feature list, then the CTA pinned to the bottom so
 * every button in the row sits on one line. All CTAs are the gradient.
 *
 * A feature given as a plain string ending in ":" renders as a ladder
 * lead ("Everything in Starter, plus:") without a check; a feature
 * object may carry a small mono tag ("[Classic Library]").
 */
export type PricingFeature = string | { text: string; tag?: string };

export type PricingCardData = {
  name: string;
  blurb?: string;
  priceLabel: string;
  priceNote?: string;
  anchor?: string;
  saveNote?: string;
  features: readonly PricingFeature[];
  footNote?: string;
  featured?: boolean;
  featuredLabel?: string;
  cta: { label: string; href: string };
};

function Check() {
  return (
    <svg viewBox="0 0 12 12" className="mt-[5px] h-3 w-3 shrink-0" aria-hidden="true">
      <path
        d="M2 6.2 4.8 9 10 3.4"
        fill="none"
        stroke="var(--gold)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Card({ card }: { card: PricingCardData }) {
  return (
    <div
      className={`relative flex h-full flex-col p-7 md:p-8 ${
        card.featured
          ? "bg-[linear-gradient(180deg,rgba(252,192,0,0.13),rgba(252,192,0,0.01)_70%)]"
          : ""
      }`}
    >
      {card.featured && card.featuredLabel && (
        <span className="absolute -top-[13px] left-1/2 -translate-x-1/2 whitespace-nowrap border border-dashed border-gold/60 bg-canvas px-3 py-1 font-mono text-label uppercase text-gold">
          {card.featuredLabel}
        </span>
      )}

      <h3 className="font-display text-h3 text-ink">{card.name}</h3>
      {card.blurb && <p className="mt-1.5 text-body-sm text-muted">{card.blurb}</p>}

      <p className="mt-6 flex items-baseline gap-2">
        <span className="font-mono text-stat-lg font-bold leading-none text-gold [font-variant-numeric:tabular-nums]">
          {card.priceLabel}
        </span>
        {card.priceNote && (
          <span className="font-mono text-label uppercase text-dim">{card.priceNote}</span>
        )}
      </p>
      {card.anchor && (
        <p className="mt-2 flex items-baseline gap-2.5">
          <span className="font-mono text-body text-dim line-through [font-variant-numeric:tabular-nums]">
            {card.anchor}
          </span>
          {card.saveNote && (
            <span className="font-mono text-label uppercase text-muted">{card.saveNote}</span>
          )}
        </p>
      )}

      <div className="my-6 border-t border-dashed border-hair" aria-hidden="true" />

      <ul className="flex-1 space-y-3">
        {card.features.map((f) => {
          const text = typeof f === "string" ? f : f.text;
          const tag = typeof f === "string" ? undefined : f.tag;
          if (typeof f === "string" && f.endsWith(":")) {
            return (
              <li key={text} className="pt-1 text-body font-medium text-ink">
                {f.slice(0, -1)}...
              </li>
            );
          }
          return (
            <li key={text} className="flex items-start gap-3">
              <Check />
              <span className="text-body leading-relaxed text-muted">
                {text}
                {tag && (
                  <span className="ml-1.5 font-mono text-label uppercase tracking-[0.08em] text-dim">
                    [{tag}]
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {card.footNote && (
        <p className="mt-6 font-mono text-label uppercase text-dim">{card.footNote}</p>
      )}

      <Button
        href={card.cta.href}
        variant="gradient"
        size="md"
        className="mt-6 w-full"
      >
        {card.cta.label}
      </Button>
    </div>
  );
}

const GRIDS: Record<2 | 3 | 4, { grid: string; cell: string }> = {
  2: {
    grid: "sm:grid-cols-2",
    cell: "border-t border-dashed border-hair first:border-t-0 sm:border-l sm:odd:border-l-0 sm:[&:nth-child(2)]:border-t-0",
  },
  3: {
    grid: "lg:grid-cols-3",
    cell: "border-t border-dashed border-hair first:border-t-0 lg:border-t-0 lg:border-l lg:first:border-l-0",
  },
  4: {
    grid: "md:grid-cols-2 xl:grid-cols-4",
    cell: "border-t border-dashed border-hair first:border-t-0 md:border-l md:odd:border-l-0 md:[&:nth-child(2)]:border-t-0 xl:border-t-0 xl:border-l xl:first:border-l-0",
  },
};

export function PricingCards({
  cards,
  columns = 4,
}: {
  cards: readonly PricingCardData[];
  columns?: 2 | 3 | 4;
}) {
  const { grid, cell } = GRIDS[columns];
  return (
    <div className="border border-dashed border-hair">
      <Reveal className={`grid grid-cols-1 ${grid}`}>
        {cards.map((card) => (
          <RevealItem key={card.name} className={`${cell} h-full`}>
            <Card card={card} />
          </RevealItem>
        ))}
      </Reveal>
    </div>
  );
}
