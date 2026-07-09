import type { ReactNode } from "react";
import { Panel } from "@/components/Panel";
import { SectionChip, type ChipAccent } from "@/components/SectionChip";
import { SectionGlow } from "@/components/SectionGlow";

const accentText: Record<ChipAccent, string> = {
  gold: "text-gold",
  green: "text-green",
  blue: "text-blue",
};

/*
 * Inner-page hero: one bounded panel under the fixed header, chip,
 * display headline with the page's ledger accent, lede, CTA row.
 * The signature gradient stays reserved for the homepage hero and
 * primary buttons; inner pages lead with their own accent color.
 */
export function PageHero({
  chip,
  headline,
  accent,
  accentColor,
  lede,
  signal,
  children,
}: {
  chip: string;
  headline: string;
  accent: string;
  accentColor: ChipAccent;
  lede: string;
  /* mono meta line, e.g. a price signal */
  signal?: string;
  /* CTA row */
  children?: ReactNode;
}) {
  return (
    <section data-bp-idx="1" className="relative overflow-x-clip pt-28 md:pt-32">
      <SectionGlow accent={accentColor} position="left" />
      <div className="shell relative">
        <Panel className="overflow-hidden">
          <div className="p-8 md:p-12 lg:p-14">
            <div className="flex flex-wrap items-center gap-3">
              <SectionChip index={1} label={chip} />
              {signal && (
                <span className="inline-flex items-center rounded-full border border-hair bg-surface px-4 py-2 font-mono text-label uppercase text-gold">
                  {signal}
                </span>
              )}
            </div>
            <h1 className="mt-7 max-w-[22ch] font-display text-hero text-ink">
              {headline}{" "}
              <span className={accentText[accentColor]}>{accent}</span>
            </h1>
            <p className="mt-6 max-w-[54ch] text-lede text-muted">{lede}</p>
            {children && (
              <div className="mt-9 flex flex-wrap gap-4">{children}</div>
            )}
          </div>
        </Panel>
      </div>
    </section>
  );
}
