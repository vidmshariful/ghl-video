"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

/* Corner registration ticks pop in as the panel reveals, like a
 * plotter placing marks. */
function Tick({ pos, delay }: { pos: string; delay: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.span
      aria-hidden="true"
      className={`bp-anim absolute ${pos} font-mono text-[0.625rem] leading-none text-dim/70`}
      initial={reduced ? false : { opacity: 0, scale: 0.4 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.3, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      +
    </motion.span>
  );
}

/*
 * Bounded section panel: hairline border, dark gradient ground, corner
 * ticks. The page is built from these so nothing floats on a void.
 */
export function Panel({
  children,
  className = "",
  ticks = true,
}: {
  children: ReactNode;
  className?: string;
  ticks?: boolean;
}) {
  return (
    <div
      className={`relative rounded-card border border-hair card-glass ${className}`}
    >
      {ticks && (
        <>
          <Tick pos="-left-1 -top-1.5" delay={0.1} />
          <Tick pos="-right-1 -top-1.5" delay={0.16} />
          <Tick pos="-right-1 -bottom-1.5" delay={0.22} />
          <Tick pos="-left-1 -bottom-1.5" delay={0.28} />
        </>
      )}
      {children}
    </div>
  );
}
