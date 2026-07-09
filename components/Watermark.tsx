"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { socials } from "@/lib/site";

/*
 * The brand end-cap: the metallic wordmark filling its grid cell edge
 * to edge (no ground, just the frame), with a social strip cell below,
 * four hairline-divided tiles. Drifts slightly slower than the scroll.
 */
function Tick({ pos }: { pos: string }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute ${pos} z-10 font-mono text-[0.625rem] leading-none text-dim/70`}
    >
      +
    </span>
  );
}

const icons: Record<string, React.ReactNode> = {
  YouTube: (
    <path d="M21.6 7.2a2.5 2.5 0 0 0-1.76-1.77C18.28 5 12 5 12 5s-6.28 0-7.84.43A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.76 1.77C5.72 19 12 19 12 19s6.28 0 7.84-.43a2.5 2.5 0 0 0 1.76-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z" />
  ),
  Facebook: (
    <path d="M13.5 21v-7h2.4l.36-2.8H13.5V9.4c0-.81.22-1.36 1.38-1.36h1.48V5.55c-.26-.03-1.13-.11-2.15-.11-2.13 0-3.58 1.3-3.58 3.68v2.08H8.25V14h2.38v7h2.87Z" />
  ),
  Instagram: (
    <path d="M12 4.3c2.5 0 2.8 0 3.8.06a5.2 5.2 0 0 1 1.75.32 3.1 3.1 0 0 1 1.77 1.77c.2.56.3 1.14.32 1.75.05 1 .06 1.3.06 3.8s0 2.8-.06 3.8a5.2 5.2 0 0 1-.32 1.75 3.1 3.1 0 0 1-1.77 1.77 5.2 5.2 0 0 1-1.75.32c-1 .05-1.3.06-3.8.06s-2.8 0-3.8-.06a5.2 5.2 0 0 1-1.75-.32 3.1 3.1 0 0 1-1.77-1.77 5.2 5.2 0 0 1-.32-1.75c-.05-1-.06-1.3-.06-3.8s0-2.8.06-3.8a5.2 5.2 0 0 1 .32-1.75A3.1 3.1 0 0 1 6.45 4.68a5.2 5.2 0 0 1 1.75-.32c1-.05 1.3-.06 3.8-.06ZM12 2.5c-2.55 0-2.87.01-3.87.06a7 7 0 0 0-2.29.44 4.9 4.9 0 0 0-2.84 2.84 7 7 0 0 0-.44 2.29c-.05 1-.06 1.32-.06 3.87s.01 2.87.06 3.87a7 7 0 0 0 .44 2.29 4.9 4.9 0 0 0 2.84 2.84 7 7 0 0 0 2.29.44c1 .05 1.32.06 3.87.06s2.87-.01 3.87-.06a7 7 0 0 0 2.29-.44 4.9 4.9 0 0 0 2.84-2.84 7 7 0 0 0 .44-2.29c.05-1 .06-1.32.06-3.87s-.01-2.87-.06-3.87a7 7 0 0 0-.44-2.29 4.9 4.9 0 0 0-2.84-2.84 7 7 0 0 0-2.29-.44c-1-.05-1.32-.06-3.87-.06Zm0 4.62a4.88 4.88 0 1 0 0 9.76 4.88 4.88 0 0 0 0-9.76Zm0 8.05a3.17 3.17 0 1 1 0-6.34 3.17 3.17 0 0 1 0 6.34Zm6.21-8.25a1.14 1.14 0 1 1-2.28 0 1.14 1.14 0 0 1 2.28 0Z" />
  ),
  LinkedIn: (
    <path d="M6.94 8.5H3.56V21h3.38V8.5ZM5.25 7.06a1.97 1.97 0 1 0 0-3.94 1.97 1.97 0 0 0 0 3.94ZM21 13.63c0-3.3-1.76-4.84-4.11-4.84a3.54 3.54 0 0 0-3.21 1.77h-.07V8.5H10.4V21h3.38v-6.19c0-1.63.31-3.21 2.33-3.21 2 0 2.02 1.87 2.02 3.32V21H21v-7.37Z" />
  ),
};

export function Watermark() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end end"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [24, 0]);

  return (
    <div ref={ref} className="border-t border-hair">
      <div className="shell py-10 md:py-14">
        {/* the mark, edge to edge in its frame */}
        <motion.div
          style={reduced ? undefined : { y }}
          className="relative rounded-card border border-hair"
        >
          <Tick pos="-left-1 -top-1.5" />
          <Tick pos="-right-1 -top-1.5" />
          <Tick pos="-left-1 -bottom-1.5" />
          <Tick pos="-right-1 -bottom-1.5" />
          {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
          <img
            src="/watermark.png"
            width={2157}
            height={266}
            alt=""
            aria-hidden="true"
            className="pointer-events-none block w-full select-none"
          />
        </motion.div>

        {/* the social strip: four hairline-divided tiles */}
        <div className="mt-6 grid grid-cols-4 divide-x divide-hair rounded-card border border-hair">
          {socials.map((s) => (
            <a
              key={s.name}
              href={s.href}
              target="_blank"
              rel="noopener"
              aria-label={`GHL Video on ${s.name}`}
              className="group flex items-center justify-center gap-3 py-5 text-dim transition-colors first:rounded-l-card last:rounded-r-card hover:bg-white/[0.02] hover:text-ink"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                {icons[s.name]}
              </svg>
              <span className="hidden font-mono text-label uppercase sm:block">
                {s.name}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
