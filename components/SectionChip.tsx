"use client";

import { motion, useReducedMotion } from "framer-motion";

export type ChipAccent = "gold" | "green" | "blue";

const accents: Record<ChipAccent, string> = {
  gold: "text-gold",
  green: "text-green",
  blue: "text-blue",
};

const EASE = [0.22, 1, 0.36, 1] as const;

/*
 * Bracketed section index chip: wayfinding through the page, a real
 * sequence, so the numbering carries information. On first view the
 * brackets slide open and the label prints between them.
 */
export function SectionChip({
  index,
  label,
  accent = "gold",
}: {
  index: number;
  label: string;
  accent?: ChipAccent;
}) {
  const reduced = useReducedMotion();
  const bracket = (glyph: string, from: number) => (
    <motion.span
      aria-hidden="true"
      className="bp-anim text-dim"
      initial={reduced ? false : { x: from }}
      whileInView={{ x: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, ease: EASE }}
    >
      {glyph}
    </motion.span>
  );

  return (
    <p className="inline-flex items-center gap-3 rounded-full border border-hair bg-surface px-4 py-2 font-mono text-label uppercase">
      <span className="inline-flex items-center gap-1.5">
        {bracket("[", 10)}
        <motion.span
          className={`bp-anim ${accents[accent]}`}
          initial={reduced ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.35, delay: 0.18, ease: EASE }}
        >
          {String(index).padStart(2, "0")}
        </motion.span>
        {bracket("]", -10)}
      </span>
      <motion.span
        className="bp-anim text-muted"
        initial={reduced ? false : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.35, delay: 0.28, ease: EASE }}
      >
        {label}
      </motion.span>
    </p>
  );
}
