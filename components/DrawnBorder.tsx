"use client";

import { motion, useReducedMotion } from "framer-motion";

/*
 * A section's top hairline that draws itself left to right when the
 * section enters view. Replaces a static border-t; the bp-anim class
 * keeps it visible in print.
 */
export function DrawnBorder() {
  const reduced = useReducedMotion();
  return (
    <motion.div
      aria-hidden="true"
      className="bp-anim absolute inset-x-0 top-0 h-px origin-left bg-hair"
      initial={reduced ? false : { scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    />
  );
}
