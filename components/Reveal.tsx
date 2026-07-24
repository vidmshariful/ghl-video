"use client";

import { motion, useInView, useReducedMotion, type Variants } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

/*
 * Scroll reveal for GROUPS, not atoms (brief section 6). Wrap a whole
 * section header or card row in <Reveal>, mark the moving pieces with
 * <RevealItem>. Fires once, small translate, short duration.
 *
 * Hardened: the in-view observer is backed by a safety net that force-shows
 * the group if it is on screen and the observer missed it (instant jumps,
 * deep links, layout shifting under late-loading video). Content can never
 * sit hidden in the viewport for more than a beat.
 */

const group: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

export function Reveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.1 });
  const [forced, setForced] = useState(false);
  const shown = inView || forced;

  useEffect(() => {
    if (shown) return;
    const check = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) setForced(true);
    };
    check();
    const iv = window.setInterval(check, 800);
    window.addEventListener("scroll", check, { passive: true });
    return () => {
      window.clearInterval(iv);
      window.removeEventListener("scroll", check);
    };
  }, [shown]);

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={group}
      initial="hidden"
      animate={shown ? "show" : "hidden"}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const item: Variants = {
    hidden: reduced ? { opacity: 1 } : { opacity: 0, y: 16 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
    },
  };
  return (
    <motion.div className={`reveal-i ${className}`} variants={item}>
      {children}
    </motion.div>
  );
}
