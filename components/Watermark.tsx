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
      {/* SVG textLength pins the mark to the exact section width */}
      <motion.div
        aria-hidden="true"
        style={reduced ? undefined : { y }}
        className="pointer-events-none select-none px-3 py-5"
      >
        <svg viewBox="0 0 1000 128" className="block w-full">
          <text
            x="500"
            y="104"
            textAnchor="middle"
            textLength="996"
            lengthAdjust="spacingAndGlyphs"
            className="fill-ink opacity-[0.07]"
            style={{
              fontFamily: "var(--font-inter), system-ui, sans-serif",
              fontWeight: 900,
              fontSize: "124px",
              letterSpacing: "-0.03em",
            }}
          >
            GHL VIDEO
          </text>
        </svg>
      </motion.div>
    </div>
  );
}
