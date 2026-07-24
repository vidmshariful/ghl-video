"use client";

import { motion, useReducedMotion } from "framer-motion";
import { GhlMark } from "@/components/GhlMark";

/*
 * The section eyebrow, unified with the hero: the animated GHL mark, a
 * hairline divider, then the label. Squared 4px corners and a soft
 * border so it sits quietly. The three-colour mark stands in for the
 * old bracketed index, so no chip ever reads single-accent. The only
 * animation is a gentle settle from 40% opacity as it scrolls in; the
 * label is static markup for fast scrollers, crawlers, and captures.
 *
 * `index` is still accepted (call sites pass a section number) but no
 * longer rendered now that the mark leads the chip.
 */
export function SectionChip({
  label,
}: {
  index?: number;
  label: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.span
      initial={reduced ? false : { opacity: 0.4 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="inline-flex items-center gap-2.5 rounded-[4px] border border-hair/50 bg-canvas/60 py-2 pl-2.5 pr-3.5"
    >
      <GhlMark className="h-4 w-auto" />
      <span aria-hidden="true" className="h-3.5 w-px bg-hair" />
      <span className="font-mono text-label uppercase tracking-[0.14em] text-dim [text-wrap:balance]">
        {label}
      </span>
    </motion.span>
  );
}
