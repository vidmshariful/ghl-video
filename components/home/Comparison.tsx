"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Panel } from "@/components/Panel";
import { DrawnBorder } from "@/components/DrawnBorder";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionChip } from "@/components/SectionChip";
import { SectionGlow } from "@/components/SectionGlow";
import { home } from "@/lib/site";

/*
 * Head to head. The GHL Video column has to WIN on sight: a continuous
 * green edge, a green check on every cell, a faint green tint. The
 * competitor column is dimmed with a quiet cross. You should read
 * "us: yes, them: no" before you read a single word. Rows cascade from
 * ONE trigger so fast scrollers and print never see missing rows.
 */
const rowsContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } },
};

function Check() {
  return (
    <svg
      viewBox="0 0 12 12"
      className="mt-[0.35em] h-3 w-3 shrink-0"
      aria-hidden="true"
    >
      <path
        d="M2 6.2 4.8 9 10 3.4"
        fill="none"
        stroke="#FCC000"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Comparison() {
  const { comparison } = home;
  const reduced = useReducedMotion();
  const rowV: Variants = {
    hidden: reduced ? { opacity: 1 } : { opacity: 0, y: 8 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
    },
  };
  const us =
    "flex items-start gap-2 border-l border-gold/40 bg-gold/[0.06] px-5 py-3.5 text-body font-medium text-ink";
  const them =
    "flex items-start gap-2 px-6 py-3.5 text-body text-dim";

  return (
    <section
      data-bp-idx="4"
      aria-labelledby="comparison-heading"
      className="relative overflow-hidden section-pad"
    >
      <DrawnBorder />
      <SectionGlow accent="green" position="left" />
      <div className="shell relative">
        <Reveal>
          <RevealItem>
            <SectionChip index={4} label={comparison.eyebrow} accent="green" />
            <h2
              id="comparison-heading"
              className="mt-6 max-w-[22ch] font-display text-h2 text-ink"
            >
              {comparison.headline}
            </h2>
            <p className="mt-4 max-w-[var(--measure-lede)] text-lede text-muted">
              {comparison.intro}
            </p>
          </RevealItem>

          <RevealItem className="mt-12">
            <Panel className="overflow-hidden">
              {/* mobile header row */}
              <div className="grid grid-cols-2 border-b border-hair md:hidden">
                <p className="px-5 py-3.5 font-mono text-label uppercase text-dim">
                  {comparison.othersLabel}
                </p>
                <p className="border-l border-gold/40 border-t-2 border-t-gold bg-gold/[0.06] px-5 py-3.5 font-mono text-label uppercase text-gold">
                  {comparison.usLabel}
                </p>
              </div>
              {/* desktop header row with the winning cap on the us column */}
              <div className="hidden grid-cols-[9rem_1fr_1fr] border-b border-hair md:grid">
                <span />
                <p className="px-6 py-3.5 font-mono text-label uppercase text-dim">
                  {comparison.othersLabel}
                </p>
                <p className="border-l border-gold/40 border-t-2 border-t-gold bg-gold/[0.06] px-5 py-3.5 font-mono text-label uppercase text-gold">
                  {comparison.usLabel}
                </p>
              </div>

              <motion.div
                variants={rowsContainer}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-80px" }}
              >
                {comparison.rows.map((row, i) => (
                  <motion.div key={row.label} variants={rowV} className="reveal-i">
                    {/* desktop */}
                    <div
                      className={`group hidden grid-cols-[9rem_1fr_1fr] md:grid ${
                        i > 0 ? "border-t border-hair" : ""
                      }`}
                    >
                      <p className="px-5 py-3.5 font-mono text-label uppercase text-dim transition-colors duration-200 group-hover:text-gold">
                        {row.label}
                      </p>
                      <p className={them}>
                        <span
                          aria-hidden="true"
                          className="mt-[0.1em] shrink-0 font-mono text-dim"
                        >
                          &times;
                        </span>
                        {row.others}
                      </p>
                      <p className={us}>
                        <Check />
                        {row.us}
                      </p>
                    </div>
                    {/* mobile: row label once, then the two values.
                        Green tint and check mark the winner; no repeated
                        column label. */}
                    <div
                      className={`grid grid-cols-2 md:hidden ${i > 0 ? "border-t border-hair" : ""}`}
                    >
                      <div className="px-5 py-3.5">
                        <p className="font-mono text-label uppercase tracking-[0.12em] text-dim">
                          {row.label}
                        </p>
                        <p className="mt-1.5 flex items-start gap-1.5 text-body text-dim">
                          <span aria-hidden="true" className="font-mono">
                            &times;
                          </span>
                          {row.others}
                        </p>
                      </div>
                      <div className="flex flex-col justify-center border-l border-gold/40 bg-gold/[0.06] px-5 py-3.5">
                        <p className="flex items-start gap-1.5 text-body font-medium text-ink">
                          <Check />
                          {row.us}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </Panel>
          </RevealItem>
        </Reveal>
      </div>
    </section>
  );
}
