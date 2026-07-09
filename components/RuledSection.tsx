import type { ReactNode } from "react";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionChip, type ChipAccent } from "@/components/SectionChip";

const accentText: Record<ChipAccent, string> = {
  gold: "text-gold",
  green: "text-green",
  blue: "text-blue",
};

/*
 * Ruled section: a square hairline box whose top and bottom rules run
 * the full viewport width, like a drawing pinned into the page grid.
 * Centered header cell, then whatever ruled rows the section needs as
 * children (use gap-px bg-hair grids with square bg-canvas cells).
 */
export function RuledSection({
  bpIdx,
  index,
  chip,
  headline,
  accent,
  accentColor = "gold",
  intro,
  children,
}: {
  bpIdx: number;
  index: number;
  chip: string;
  headline: string;
  accent: string;
  accentColor?: ChipAccent;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section data-bp-idx={bpIdx} className="relative overflow-x-clip section-pad">
      <div className="shell">
        <div className="relative border border-hair">
          {/* the box's rules extend edge to edge */}
          <span
            aria-hidden="true"
            className="absolute -top-px left-1/2 -z-10 h-px w-screen -translate-x-1/2 bg-hair/60"
          />
          <span
            aria-hidden="true"
            className="absolute -bottom-px left-1/2 -z-10 h-px w-screen -translate-x-1/2 bg-hair/60"
          />
          {/* header cell, centered */}
          <Reveal className="border-b border-hair px-6 py-12 text-center md:py-14">
            <RevealItem>
              <SectionChip index={index} label={chip} />
              <h2 className="mx-auto mt-6 max-w-[26ch] font-display text-h2 text-ink">
                {headline}{" "}
                <span className={accentText[accentColor]}>{accent}</span>
              </h2>
              {intro && (
                <p className="mx-auto mt-5 max-w-[52ch] text-lede text-muted">
                  {intro}
                </p>
              )}
            </RevealItem>
          </Reveal>
          {children}
        </div>
      </div>
    </section>
  );
}
