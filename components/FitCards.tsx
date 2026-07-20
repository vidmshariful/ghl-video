import Link from "next/link";
import { DrawnIcon, type IconName } from "@/components/DrawnIcon";
import { Reveal, RevealItem } from "@/components/Reveal";

/*
 * The "who it is for" section as cards, not a for/not-for list: this
 * sits right under the hero, where a two-column checklist read as dense
 * and premature. Each card is one audience, with an icon, a short title,
 * a line, and one quiet CTA into the page's own action. Same card
 * language as the bundle and pricing cards (card-glass, hairline,
 * rounded-card), so it stays cohesive.
 */
export type FitCard = {
  icon: IconName;
  title: string;
  line: string;
};

export function FitCards({
  cards,
  cta,
}: {
  cards: readonly FitCard[];
  cta: { label: string; href: string };
}) {
  return (
    <Reveal className="grid gap-5 md:grid-cols-3">
      {cards.map((card) => (
        <RevealItem key={card.title} className="h-full">
          <div className="group flex h-full flex-col rounded-card border border-hair card-glass p-7 md:p-8">
            <DrawnIcon name={card.icon} />
            <h3 className="mt-6 font-display text-h3 text-ink">{card.title}</h3>
            <p className="mt-3 flex-1 text-body leading-relaxed text-muted">
              {card.line}
            </p>
            <Link
              href={cta.href}
              className="tap mt-7 inline-flex items-center gap-2 self-start rounded-[3px] border border-hair px-4 py-2 font-mono text-label uppercase text-ink transition-colors hover:border-gold/60 hover:text-gold"
            >
              {cta.label}
              <span
                aria-hidden="true"
                className="transition-transform duration-200 group-hover:translate-x-0.5"
              >
                &rarr;
              </span>
            </Link>
          </div>
        </RevealItem>
      ))}
    </Reveal>
  );
}
