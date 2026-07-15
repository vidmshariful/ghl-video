import type { ReactNode } from "react";
import { SectionChip, type ChipAccent } from "@/components/SectionChip";
import { SectionGlow } from "@/components/SectionGlow";

/* Registration mark: a circled dot where the boundary rule crosses
 * the page-frame verticals, like a plotter aligning the sheet. */
function Mark({ side }: { side: "left" | "right" }) {
  return (
    <span
      className={`absolute -top-[5px] ${side === "left" ? "-left-[5px]" : "-right-[5px]"} flex h-2.5 w-2.5 items-center justify-center rounded-full border border-hair bg-canvas`}
    >
      <span className="h-[3px] w-[3px] rounded-full bg-dim" />
    </span>
  );
}

/*
 * Inner-page hero: not a card. The composition sits open on the dark
 * canvas inside the page frame (heroes are always dark, client hard
 * rule), centered, and closes with a boundary: a full-width rule
 * carrying registration marks at the frame rails, then a hatched
 * strip that hands off to the next zone.
 */
export function PageHero({
  chip,
  headline,
  accent,
  accentColor,
  lede,
  signal,
  divider = true,
  children,
}: {
  chip: string;
  headline: string;
  accent: string;
  accentColor: ChipAccent;
  lede: string;
  /* mono meta line, e.g. a price signal */
  signal?: string;
  /* the hatched hand-off strip below the boundary rule */
  divider?: boolean;
  /* CTA row */
  children?: ReactNode;
}) {
  return (
    <section data-bp-idx="1" className="relative overflow-x-clip hero-pad">
      <SectionGlow accent={accentColor} position="left" />
      <div className="shell relative pb-14 text-center md:pb-16">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <SectionChip index={1} label={chip} />
          {signal && (
            <span className="inline-flex items-center rounded-full border border-hair bg-surface px-4 py-2 font-mono text-label uppercase text-gold">
              {signal}
            </span>
          )}
        </div>
        <h1 className="mx-auto mt-8 max-w-[22ch] font-display text-hero text-ink">
          {headline} <span className="text-gradient">{accent}</span>
        </h1>
        <p className="mx-auto mt-6 max-w-[var(--measure-lede)] text-lede text-muted">{lede}</p>
        {children && (
          <div className="mt-9 flex flex-wrap justify-center gap-4">
            {children}
          </div>
        )}
      </div>

      {/* the boundary */}
      <div aria-hidden="true" className="relative">
        <div className="h-px w-full bg-hair" />
        <div className="shell relative">
          <Mark side="left" />
          <Mark side="right" />
        </div>
        {divider && (
          <div className="relative h-10 border-b border-hair">
            <div className="absolute inset-0 hatch" />
          </div>
        )}
      </div>
    </section>
  );
}
