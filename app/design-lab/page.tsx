import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DrawnIcon, type IconName } from "@/components/DrawnIcon";
import { pages } from "@/lib/site";

export const metadata: Metadata = {
  title: "Card + icon lab",
  description: "Internal: card treatment options.",
  robots: { index: false, follow: false },
};

/*
 * TEMP comparison page, internal only. Nothing here ships. It exists to
 * put card treatments side by side so we can pick one for the two real
 * problems:
 *   1. two gold things per card (icon AND number both gold), and
 *   2. the bare 26px stroke icon reading thin.
 * The only shared-code change behind it is an opt-in `tone` prop on
 * DrawnIcon, default gold, so the live pages are untouched.
 */

const steps = pages.custom.process.steps.slice(0, 3);
const icons: IconName[] = ["crosshair", "pen-line", "mic"];

const num = (i: number) => String(i + 1).padStart(2, "0");

/* ---- icon frames ---- */
function Tile({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-14 w-14 items-center justify-center rounded-[12px] border border-hair bg-surface">
      {children}
    </span>
  );
}
function TintedTile({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-14 w-14 items-center justify-center rounded-[12px] border border-gold/25 bg-gold/10">
      {children}
    </span>
  );
}

const cardBase =
  "flex h-full flex-col rounded-card border border-hair card-glass p-7";

/* ---- the six treatments, each rendering one card ---- */
type CardProps = { icon: IconName; i: number; title: string; line: string };

// 1. current: gold icon + gold number
function T1({ icon, i, title, line }: CardProps) {
  return (
    <div className={cardBase}>
      <div className="flex items-start justify-between">
        <DrawnIcon name={icon} />
        <span className="font-mono text-label uppercase text-gold [font-variant-numeric:tabular-nums]">
          {num(i)}
        </span>
      </div>
      <h3 className="mt-5 font-display text-h4 font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-body leading-relaxed text-muted">{line}</p>
    </div>
  );
}

// 2. recede the number: gold icon, dim number
function T2({ icon, i, title, line }: CardProps) {
  return (
    <div className={cardBase}>
      <div className="flex items-start justify-between">
        <DrawnIcon name={icon} />
        <span className="font-mono text-label uppercase text-dim [font-variant-numeric:tabular-nums]">
          {num(i)}
        </span>
      </div>
      <h3 className="mt-5 font-display text-h4 font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-body leading-relaxed text-muted">{line}</p>
    </div>
  );
}

// 3. framed icon in a neutral tile, dim number
function T3({ icon, i, title, line }: CardProps) {
  return (
    <div className={cardBase}>
      <div className="flex items-start justify-between">
        <Tile>
          <DrawnIcon name={icon} size={24} />
        </Tile>
        <span className="mt-1 font-mono text-label uppercase text-dim [font-variant-numeric:tabular-nums]">
          {num(i)}
        </span>
      </div>
      <h3 className="mt-5 font-display text-h4 font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-body leading-relaxed text-muted">{line}</p>
    </div>
  );
}

// 4. tinted tile, no number: gold contained to one zone
function T4({ icon, title, line }: CardProps) {
  return (
    <div className={cardBase}>
      <TintedTile>
        <DrawnIcon name={icon} size={24} />
      </TintedTile>
      <h3 className="mt-5 font-display text-h4 font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-body leading-relaxed text-muted">{line}</p>
    </div>
  );
}

// 5. numeral-led: big ghosted number, no icon, one thin gold rule
function T5({ i, title, line }: CardProps) {
  return (
    <div className={cardBase}>
      <span className="font-display text-[2.75rem] font-semibold leading-none text-dim/50 [font-variant-numeric:tabular-nums]">
        {num(i)}
      </span>
      <span aria-hidden="true" className="mt-4 block h-px w-8 bg-gold" />
      <h3 className="mt-5 font-display text-h4 font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-body leading-relaxed text-muted">{line}</p>
    </div>
  );
}

// 6. inverted: neutral (ink) icon in a tile, gold moves to the number
function T6({ icon, i, title, line }: CardProps) {
  return (
    <div className={cardBase}>
      <div className="flex items-start justify-between">
        <Tile>
          <DrawnIcon name={icon} size={24} tone="ink" />
        </Tile>
        <span className="mt-1 font-mono text-label uppercase text-gold [font-variant-numeric:tabular-nums]">
          {num(i)}
        </span>
      </div>
      <h3 className="mt-5 font-display text-h4 font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-body leading-relaxed text-muted">{line}</p>
    </div>
  );
}

const TREATMENTS = [
  {
    n: "01",
    name: "Current",
    fixes: "baseline",
    note: "Bare 26px stroke icon in gold, and the index in gold too. Two gold marks compete, and the icon reads thin. This is what ships today.",
    Card: T1,
  },
  {
    n: "02",
    name: "Recede the number",
    fixes: "double-gold",
    note: "One-line change: the index drops to dim mono, so gold has a single home (the icon). Smallest possible fix, keeps the icon as is.",
    Card: T2,
  },
  {
    n: "03",
    name: "Framed icon",
    fixes: "double-gold + thin icon",
    note: "The icon sits in a bordered surface tile, which gives it weight and stops it floating. Index stays dim. This is the biggest upgrade for the least risk.",
    Card: T3,
  },
  {
    n: "04",
    name: "Tinted tile, no index",
    fixes: "double-gold + thin icon",
    note: "Icon in a gold-tinted tile, and the number is dropped entirely. Gold is contained to one soft zone. Best where the order does not matter (capabilities, not a sequence).",
    Card: T4,
  },
  {
    n: "05",
    name: "Numeral-led",
    fixes: "double-gold + thin icon",
    note: "No icon at all: a large ghosted numeral leads, with one thin gold rule as the only accent. Editorial, and it makes a real sequence read as a sequence. Best for the process steps.",
    Card: T5,
  },
  {
    n: "06",
    name: "Inverted",
    fixes: "double-gold + thin icon",
    note: "The icon goes neutral (ink) in a tile, and gold moves to the index. Flips which mark is the accent, so gold appears exactly once and lands on the number.",
    Card: T6,
  },
] as const;

export default function DesignLabPage() {
  return (
    <div className="hero-pad section-pad-sm">
      <div className="shell">
        <header className="max-w-[var(--measure-lede)]">
          <p className="font-mono text-label uppercase text-gold">
            [ Internal ] Card + icon options. Nothing here ships.
          </p>
          <h1 className="mt-6 font-display text-hero text-ink">
            Card <span className="text-gradient">treatments.</span>
          </h1>
          <p className="mt-6 text-lede leading-relaxed text-muted">
            The same three cards, six ways, so we can pick one. Each fixes
            the two things you flagged: gold used twice per card, and the
            small stroke icon reading basic.
          </p>
        </header>

        <div className="mt-16 grid gap-16">
          {TREATMENTS.map((t) => (
            <section key={t.n}>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                <span className="font-mono text-label uppercase text-gold">
                  {t.n}
                </span>
                <h2 className="font-display text-h3 text-ink">{t.name}</h2>
                <span className="rounded-full border border-hair bg-surface px-3 py-1 font-mono text-label uppercase text-dim">
                  fixes: {t.fixes}
                </span>
              </div>
              <p className="mt-3 max-w-[var(--measure-body)] text-body leading-relaxed text-muted">
                {t.note}
              </p>
              <div className="mt-8 grid items-start gap-5 md:grid-cols-3">
                {steps.map((s, i) => (
                  <t.Card
                    key={s.title}
                    icon={icons[i]}
                    i={i}
                    title={s.title}
                    line={s.line}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
