"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/Button";
import { Eyebrow } from "@/components/Eyebrow";
import { ReelPlaceholder } from "@/components/ReelPlaceholder";
import { home, showreel, cta } from "@/lib/site";

const EASE = [0.22, 1, 0.36, 1] as const;

/* Mono caption naming the current reel segment. Config-driven: when the
 * real reel lands, the segment list in lib/site.ts drives this. */
function NowPlaying() {
  const [i, setI] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || showreel.segments.length < 2) return;
    const t = setInterval(
      () => setI((v) => (v + 1) % showreel.segments.length),
      6000,
    );
    return () => clearInterval(t);
  }, [reduced]);

  const seg = showreel.segments[i];
  return (
    <div className="pointer-events-none absolute bottom-8 right-6 hidden font-mono text-label uppercase text-dim md:block lg:right-12">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-block"
        >
          Now playing: <span className="text-muted">{seg.format}</span> /{" "}
          <span className="text-muted">{seg.client}</span>
        </motion.span>
      </AnimatePresence>
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

export function ShowreelHero() {
  const reduced = useReducedMotion();
  const fadeUp = (delay: number) => ({
    initial: reduced ? false : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay, ease: EASE },
  });

  return (
    <section className="relative flex min-h-[92svh] items-center overflow-hidden">
      {/* the reel. Swaps from placeholder to <video> when assets land. */}
      {showreel.src ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={showreel.src}
          poster={showreel.poster ?? undefined}
          autoPlay={!reduced}
          muted
          loop
          playsInline
          aria-hidden="true"
        />
      ) : (
        <ReelPlaceholder />
      )}

      {/* scrim: heavier on the left where the type sits, fades to canvas
          at the bottom so the next section joins seamlessly */}
      <div className="absolute inset-0 bg-gradient-to-r from-canvas/90 via-canvas/60 to-canvas/20" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-canvas to-transparent" />

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

      <NowPlaying />
    </section>
  );
}
