import type { ReactNode } from "react";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionChip } from "@/components/SectionChip";

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
  intro,
  action,
  className = "",
  children,
}: {
  bpIdx: number;
  index: number;
  chip: string;
  headline: string;
  accent: string;
  intro?: string;
  /* when set, the header becomes a left-aligned title block with this
     control pinned to the right, instead of the centered header */
  action?: ReactNode;
  /* extra classes on the <section>, e.g. to trim padding where this frame
     meets an adjacent framed section */
  className?: string;
  children: ReactNode;
}) {
  const split = action !== undefined;
  return (
    <section
      data-bp-idx={bpIdx}
      className={`relative overflow-x-clip section-pad ${className}`}
    >
      <div className="shell">
        <div className="relative border border-hair">
          {/* the box's rules extend edge to edge */}
          <span
            aria-hidden="true"
            className="absolute -top-px left-1/2 -z-10 h-px w-screen -translate-x-1/2 bg-hair"
          />
          <span
            aria-hidden="true"
            className="absolute -bottom-px left-1/2 -z-10 h-px w-screen -translate-x-1/2 bg-hair"
          />
          {/* the blueprint hatch fills the gutters out to the frame rails */}
          <span
            aria-hidden="true"
            className="hatch pointer-events-none absolute inset-y-0 right-full mr-px w-[var(--rail-gutter)]"
          />
          <span
            aria-hidden="true"
            className="hatch pointer-events-none absolute inset-y-0 left-full ml-px w-[var(--rail-gutter)]"
          />
          {/* header cell: centered by default, or a left title block with
              a right-pinned action when `action` is provided */}
          {split ? (
            <Reveal className="flex flex-col gap-6 border-b border-hair px-6 py-10 md:flex-row md:items-end md:justify-between md:px-8 md:py-12">
              <RevealItem className="max-w-2xl">
                <SectionChip index={index} label={chip} />
                <h2 className="mt-6 font-display text-h2 text-ink">
                  {headline} <span className="text-gradient">{accent}</span>
                </h2>
                {intro && (
                  <p className="mt-4 max-w-[var(--measure-lede)] text-lede text-muted">
                    {intro}
                  </p>
                )}
              </RevealItem>
              <RevealItem className="shrink-0">{action}</RevealItem>
            </Reveal>
          ) : (
            <Reveal className="border-b border-hair px-6 py-12 text-center md:py-14">
              <RevealItem>
                <SectionChip index={index} label={chip} />
                <h2 className="mx-auto mt-6 max-w-[26ch] font-display text-h2 text-ink">
                  {headline}{" "}
                  <span className="text-gradient">{accent}</span>
                </h2>
                {intro && (
                  <p className="mx-auto mt-5 max-w-[var(--measure-lede)] text-lede text-muted">
                    {intro}
                  </p>
                )}
              </RevealItem>
            </Reveal>
          )}
          {children}
        </div>
      </div>
    </section>
  );
}
