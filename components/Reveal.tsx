"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

/*
 * Scroll reveal for GROUPS, not atoms (brief section 6). Wrap a whole
 * section header or card row in <Reveal>, mark the moving pieces with
 * <RevealItem>. Fires once, small translate, short duration.
 */

const group: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

/*
 * Both take `as`, because wrapping list items in divs costs more than it
 * looks. It puts a div between <ul> and <li>, which is invalid, and it
 * makes every item the only child of its own wrapper, so `first:` and
 * `last:` match every item at once: `first:pt-0 last:pb-0` silently
 * zeroes the padding on all of them. Render the semantic element and
 * both problems go away.
 */
type Tag = "div" | "ul" | "ol" | "li";

const tagged = {
  div: motion.div,
  ul: motion.ul,
  ol: motion.ol,
  li: motion.li,
} as const;

export function Reveal({
  children,
  className = "",
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: Tag;
}) {
  const C = tagged[as];
  return (
    <C
      className={className}
      variants={group}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
    >
      {children}
    </C>
  );
}

export function RevealItem({
  children,
  className = "",
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: Tag;
}) {
  const reduced = useReducedMotion();
  const C = tagged[as];
  const item: Variants = {
    hidden: reduced ? { opacity: 1 } : { opacity: 0, y: 16 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
    },
  };
  return (
    <C className={`reveal-i ${className}`} variants={item}>
      {children}
    </C>
  );
}
