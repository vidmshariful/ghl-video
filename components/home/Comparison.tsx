import { Fragment } from "react";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionChip } from "@/components/SectionChip";
import { home } from "@/lib/site";

function Cross({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={`h-3 w-3 shrink-0 ${className}`}
      aria-hidden="true"
    >
      <path
        d="M3 3l6 6M9 3l-6 6"
        fill="none"
        stroke="#ff6b6b"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Check({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={`h-3 w-3 shrink-0 ${className}`}
      aria-hidden="true"
    >
      <path
        d="M2 6.2 4.8 9 10 3.4"
        fill="none"
        stroke="var(--green)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const themCard =
  "flex h-full items-start gap-3 rounded-[10px] border border-[#ff6b6b]/[0.15] bg-[#ff6b6b]/[0.05] px-5 py-4 text-body text-dim";
const usCard =
  "flex h-full items-start gap-3 rounded-[10px] border border-green/[0.28] bg-green/[0.08] px-5 py-4 text-body font-medium text-ink";

/*
 * Head to head, them vs us: two columns of tinted cards. The generalist
 * column is a washed light-red, dimmed with a red cross; the GHL column
 * is a live light-green with a green check and bright copy, so the win
 * reads on sight. Rows align across the columns (each grid row stretches
 * both cards to one height); on the narrow layout the cards interleave
 * bad-then-good and the colour carries the label.
 */
export function Comparison() {
  const { comparison } = home;
  return (
    <section
      data-bp-idx="4"
      aria-labelledby="comparison-heading"
      className="relative overflow-x-clip section-pad"
    >
      <div className="shell">
        <Reveal className="text-center">
          <RevealItem>
            <SectionChip index={4} label={comparison.eyebrow} />
            <h2
              id="comparison-heading"
              className="mx-auto mt-6 max-w-[24ch] font-display text-h2 text-ink"
            >
              {comparison.headline}{" "}
              <span className="text-gradient">{comparison.accent}</span>
            </h2>
            <p className="mx-auto mt-4 text-lede text-muted lg:whitespace-nowrap">
              {comparison.intro}
            </p>
          </RevealItem>
        </Reveal>

        <Reveal className="mt-12 grid gap-3 sm:grid-cols-2 sm:gap-x-5">
          {/* column headers, wide layout only */}
          <RevealItem className="hidden sm:block">
            <p className="flex items-center justify-center gap-2 pb-1 font-mono text-label uppercase tracking-[0.14em] text-muted">
              <Cross />
              {comparison.othersLabel}
            </p>
          </RevealItem>
          <RevealItem className="hidden sm:block">
            <p className="flex items-center justify-center gap-2 pb-1 font-mono text-label uppercase tracking-[0.14em] text-green">
              <Check />
              {comparison.usLabel}
            </p>
          </RevealItem>

          {comparison.rows.map((row) => (
            <Fragment key={row.label}>
              <RevealItem className="h-full">
                <div className={themCard}>
                  <Cross className="mt-[0.3em]" />
                  {row.others}
                </div>
              </RevealItem>
              <RevealItem className="h-full">
                <div className={usCard}>
                  <Check className="mt-[0.3em]" />
                  {row.us}
                </div>
              </RevealItem>
            </Fragment>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
