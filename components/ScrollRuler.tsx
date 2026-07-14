"use client";

import { useEffect, useState } from "react";
import {
  motion,
  useMotionTemplate,
  useScroll,
  useTransform,
} from "framer-motion";

/*
 * The ruler: a mono marker riding the right page-frame rule with the
 * scroll, reading out the current numbered section. Blueprint
 * wayfinding made functional. Desktop only, pointer-transparent.
 */
export function ScrollRuler() {
  const { scrollYProgress } = useScroll();
  const pct = useTransform(scrollYProgress, (v) => v * 100);
  const top = useMotionTemplate`${pct}%`;
  const [idx, setIdx] = useState(1);

  useEffect(() => {
    const sections = [...document.querySelectorAll<HTMLElement>("[data-bp-idx]")];
    if (!sections.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const n = Number((e.target as HTMLElement).dataset.bpIdx);
            if (!Number.isNaN(n)) setIdx(n);
          }
        });
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-y-28 z-40 hidden lg:block"
      style={{ right: "calc((100vw - min(100vw - 1.5rem, 80.5rem)) / 2)" }}
    >
      <motion.div
        style={{ top }}
        className="absolute right-0 flex -translate-y-1/2 items-center gap-2 whitespace-nowrap"
      >
        <span className="whitespace-nowrap font-mono text-[0.625rem] tracking-[0.14em] text-dim">
          [ <span className="text-gold">{String(idx).padStart(2, "0")}</span> ]
        </span>
        <span className="h-px w-3 bg-gold" />
      </motion.div>
    </div>
  );
}
