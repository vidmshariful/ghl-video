"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { Button } from "@/components/Button";
import { Eyebrow } from "@/components/Eyebrow";
import { home, cta } from "@/lib/site";

const EASE = [0.22, 1, 0.36, 1] as const;

/*
 * Abstract atmosphere, not a literal video: the signature gold-to-
 * green glow as a soft gradient field on near-black, vignetted for
 * depth, with slow drift plus a gentle scroll parallax. The headline
 * owns the frame. Video-first lives in the Work section and the
 * premade grid, where the media is framed and graded.
 */
function GlowField() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  /* layers drift apart as you scroll: nearer glows move more */
  const yGold = useTransform(scrollY, [0, 900], [0, 150]);
  const yGreen = useTransform(scrollY, [0, 900], [0, 70]);
  const yBlue = useTransform(scrollY, [0, 900], [0, 210]);

  /* parallax lives on the wrapper, drift keyframes on the child:
   * both write transform, so they must not share an element */
  return (
    <div ref={ref} aria-hidden="true" className="absolute inset-0 bg-[#05060A]">
      <motion.div
        style={reduced ? undefined : { y: yGold }}
        className="absolute -left-[14%] top-[26%] h-[85%] w-[62%]"
      >
        <div className="drift-a h-full w-full rounded-full bg-gold opacity-[0.16] blur-[130px]" />
      </motion.div>
      <motion.div
        style={reduced ? undefined : { y: yGreen }}
        className="absolute -right-[10%] -top-[22%] h-[85%] w-[62%]"
      >
        <div className="drift-b h-full w-full rounded-full bg-green opacity-[0.12] blur-[140px]" />
      </motion.div>
      <motion.div
        style={reduced ? undefined : { y: yBlue }}
        className="absolute bottom-[-25%] left-[38%] h-[55%] w-[40%]"
      >
        <div className="drift-c h-full w-full rounded-full bg-blue opacity-[0.06] blur-[120px]" />
      </motion.div>
      {/* vignette: edges fall away so the field reads deep, not flat */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_38%_28%,transparent_38%,rgba(5,6,10,0.82)_100%)]" />
      {/* settle into the trust strip below */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-canvas to-transparent" />
    </div>
  );
}

/* One orchestrated reveal on load, under 900ms, then the page is calm. */
function HeadlineLine({
  children,
  delay,
  className = "",
}: {
  children: React.ReactNode;
  delay: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <span className="block overflow-hidden pb-[0.08em]">
      <motion.span
        className={`block ${className}`}
        initial={reduced ? false : { y: "108%" }}
        animate={{ y: 0 }}
        transition={{ duration: 0.7, delay, ease: EASE }}
      >
        {children}
      </motion.span>
    </span>
  );
}

export function Hero() {
  const reduced = useReducedMotion();
  const fadeUp = (delay: number) => ({
    initial: reduced ? false : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay, ease: EASE },
  });

  return (
    <section className="relative flex min-h-[92svh] items-center overflow-hidden">
      <GlowField />

      <div className="shell relative pt-32 pb-24">
        <div className="max-w-4xl">
          <motion.div {...fadeUp(0.05)}>
            <Eyebrow accent="gold">{home.hero.eyebrow}</Eyebrow>
          </motion.div>

          <h1 className="mt-5 font-display text-hero text-ink">
            <HeadlineLine delay={0.12}>{home.hero.headline}</HeadlineLine>
            <HeadlineLine delay={0.21} className="text-gradient">
              {home.hero.headlineAccent}
            </HeadlineLine>
          </h1>

          <motion.p
            {...fadeUp(0.45)}
            className="mt-6 max-w-[44ch] text-lede text-muted"
          >
            {home.hero.lede}
          </motion.p>

          <motion.div
            {...fadeUp(0.57)}
            className="mt-9 flex flex-wrap items-center gap-4"
          >
            <Button href={cta.bookACall.href} variant="primary">
              {cta.bookACall.label}
            </Button>
            <Button href={cta.seePremade.href} variant="ghost">
              {cta.seePremade.label}
            </Button>
          </motion.div>

          <motion.p
            {...fadeUp(0.69)}
            className="mt-8 font-mono text-label uppercase text-gold"
          >
            {home.hero.signal}
          </motion.p>
        </div>
      </div>
    </section>
  );
}
