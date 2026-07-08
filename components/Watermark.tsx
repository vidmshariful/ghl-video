"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";

/*
 * The giant wordmark closing the page, drifting slightly slower than
 * the scroll so the final moment has depth.
 */
export function Watermark() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end end"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [56, 0]);

  return (
    <div ref={ref} className="overflow-hidden border-t border-hair">
      <motion.p
        aria-hidden="true"
        style={reduced ? undefined : { y }}
        className="pointer-events-none select-none whitespace-nowrap py-4 text-center font-display text-[12.5vw] font-bold leading-[0.85] tracking-tight text-ink opacity-[0.05]"
      >
        GHL VIDEO
      </motion.p>
    </div>
  );
}
