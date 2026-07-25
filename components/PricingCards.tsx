import { Button } from "@/components/Button";
import { Reveal, RevealItem } from "@/components/Reveal";

/*
 * The pricing lattice: cards divided by dashed hairlines with drafting
 * ticks at the outer corners, in the drawing-board voice. Exactly one
 * card is highlighted: it sits in a gold-tinted rounded panel that
 * bleeds past the row on large screens and carries the only gradient
 * CTA in the grid. Everything else stays quiet on the canvas.
 *
 * Card anatomy, top to bottom: name, one-line blurb, the price with its
 * note (and the struck anchor when there is one), a dashed divider, the
 * CTA, then the feature list. A feature ending in ":" renders as a
 * ladder lead ("Everything in Starter, plus:") without a check.
 */
export type PricingCardData = {
  name: string;
  blurb: string;
  priceLabel: string;
  priceNote?: string;
  anchor?: string;
  saveNote?: string;
  features: readonly string[];
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
  const inner = (
    <div className="flex h-full flex-col p-7 md:p-8">
      <h3 className="font-display text-h3 text-ink">{card.name}</h3>
      <p className="mt-1.5 text-body-sm text-muted">{card.blurb}</p>

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

      <Button
        href={card.cta.href}
        variant={card.featured ? "gradient" : "primary"}
        size="md"
        className="w-full"
      >
        {card.cta.label}
      </Button>

      <ul className="mt-7 flex-1 space-y-3">
        {card.features.map((f) =>
          f.endsWith(":") ? (
            <li key={f} className="pt-1 text-body font-medium text-ink">
              {f.slice(0, -1)}...
            </li>
          ) : (
            <li key={f} className="flex items-start gap-3">
              <Check />
              <span className="text-body leading-relaxed text-muted">{f}</span>
            </li>
          ),
        )}
      </ul>
    </div>
  );

  if (!card.featured) return inner;
  return (
    <div className="relative z-10 h-full p-1.5 lg:-my-4 lg:p-0">
      <div className="relative h-full rounded-card border border-gold/40 bg-[linear-gradient(180deg,rgba(252,192,0,0.10),rgba(252,192,0,0.02))] shadow-[0_0_48px_-16px_rgba(252,192,0,0.35)]">
        {card.featuredLabel && (
          <span className="absolute -top-3 left-7 inline-flex items-center rounded-full border border-gold/50 bg-canvas px-3 py-1 font-mono text-label uppercase text-gold">
            {card.featuredLabel}
          </span>
        )}
        {inner}
      </div>
    </div>
  );
}

export function PricingCards({
  cards,
  columns = 4,
}: {
  cards: readonly PricingCardData[];
  columns?: 3 | 4;
}) {
  const grid =
    columns === 4
      ? "md:grid-cols-2 xl:grid-cols-4"
      : "lg:grid-cols-3";
  const cell =
    columns === 4
      ? "border-t border-dashed border-hair first:border-t-0 md:border-l md:odd:border-l-0 md:[&:nth-child(2)]:border-t-0 xl:border-t-0 xl:border-l xl:first:border-l-0"
      : "border-t border-dashed border-hair first:border-t-0 lg:border-t-0 lg:border-l lg:first:border-l-0";

  return (
    <div className="relative border-y border-dashed border-hair">
      {/* drafting ticks on the lattice corners */}
      {[
        "-top-[11px] -left-[4px]",
        "-top-[11px] -right-[4px]",
        "-bottom-[11px] -left-[4px]",
        "-bottom-[11px] -right-[4px]",
      ].map((pos) => (
        <span
          key={pos}
          aria-hidden="true"
          className={`absolute ${pos} select-none font-mono text-body-sm leading-none text-dim`}
        >
          +
        </span>
      ))}
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
