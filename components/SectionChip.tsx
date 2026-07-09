"use client";

import { motion, useReducedMotion } from "framer-motion";

export type ChipAccent = "gold" | "green" | "blue";

/*
 * Bracketed section index chip. Brackets and number are STATIC in the
 * markup (never a broken intermediate state for fast scrollers,
 * crawlers, or captures); the only animation is a gentle settle of
 * the whole chip from 40% opacity. Index numbers are always gold, the
 * blueprint ink, so no section ever reads single-accent because of
 * its chip; section accents live in headings, links, and cards.
 */
export function SectionChip({
  index,
  label,
}: {
  index: number;
  label: string;
  /* kept for call-site compatibility; numbers render gold regardless */
  accent?: ChipAccent;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.p
      initial={reduced ? false : { opacity: 0.4 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="inline-flex items-center gap-3 rounded-full border border-hair bg-surface px-4 py-2 font-mono text-label uppercase"
    >
      <span className="whitespace-nowrap text-dim">
        [{" "}
        <span className="text-gold [font-variant-numeric:tabular-nums]">
          {String(index).padStart(2, "0")}
        </span>{" "}
        ]
      </span>
      <span className="text-muted [text-wrap:balance]">{label}</span>
    </motion.p>
  );
}
