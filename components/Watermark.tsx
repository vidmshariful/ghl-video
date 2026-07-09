"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";

/*
 * The brand end-cap: the metallic wordmark asset inside a bounded
 * grid cell (hairline frame, corner ticks, moving gradient hairline),
 * sitting within the container like every other panel. Drifts
 * slightly slower than the scroll.
 */
function Tick({ pos }: { pos: string }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute ${pos} font-mono text-[0.625rem] leading-none text-dim/70`}
    >
      +
    </span>
  );
}

export function Watermark() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end end"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [32, 0]);

  return (
    <div ref={ref} className="border-t border-hair">
      <div className="shell py-10 md:py-14">
        <div className="relative rounded-card border border-hair card-glass overflow-hidden">
          <div
            aria-hidden="true"
            className="grad-line absolute inset-x-0 top-0 h-px"
          />
          <Tick pos="-left-1 -top-1.5" />
          <Tick pos="-right-1 -top-1.5" />
          <Tick pos="-left-1 -bottom-1.5" />
          <Tick pos="-right-1 -bottom-1.5" />
          <motion.div
            style={reduced ? undefined : { y }}
            className="px-6 py-8 md:px-12 md:py-12"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
            <img
              src="/watermark.png"
              alt=""
              aria-hidden="true"
              className="pointer-events-none w-full select-none"
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
