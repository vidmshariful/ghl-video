"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/Button";
import { HeroReviewer } from "@/components/home/HeroReviewer";
import { GhlMark } from "@/components/GhlMark";
import { HeroAtmosphere } from "@/components/HeroAtmosphere";
import { MediaFrame } from "@/components/MediaFrame";
import { Panel } from "@/components/Panel";
import { home, cta } from "@/lib/site";

const EASE = [0.22, 1, 0.36, 1] as const;

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
        className="block"
        initial={reduced ? false : { y: "108%" }}
        animate={{ y: 0 }}
        transition={{ duration: 0.7, delay, ease: EASE }}
      >
        {/* gradient and clip live on an INLINE box: when the accent
            phrase wraps on small screens, box-decoration-break gives
            each line the full gold-to-green run instead of a block
            background that leaves the second line stuck in gold */}
        <span className={className}>{children}</span>
      </motion.span>
    </span>
  );
}

/*
 * Blueprint hero: one bounded two-panel card inside the page frame.
 * Copy panel left (chip, headline, lede, CTAs, checklist strip), the
 * work playing right, graded through MediaFrame, with a hatched
 * gutter between. The signature gradient lives on the accent line.
 */
export function Hero() {
  const reduced = useReducedMotion();
  const { work } = home;
  const featured = work.pieces[0];

  const fadeUp = (delay: number) => ({
    initial: reduced ? false : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay, ease: EASE },
  });

  return (
    /* the one hero that is not hero-pad, on purpose: this hero is a
       bounded panel, so its border IS the start line. Centered text on
       the other pages needs more air above it to start at the same
       optical point. Matching the numbers would make them look less
       alike, not more. */
    <section data-bp-idx="1" className="relative overflow-x-clip pt-28 pb-14 md:pt-32">
      {/* the one place with ambient colour + grain: reduced, hero only */}
      <HeroAtmosphere />

      <div className="shell relative">
        <Panel className="overflow-hidden">
          {/* a light traces the panel border as the page drafts itself */}
          {!reduced && (
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-20 h-full w-full"
              fill="none"
            >
              <motion.rect
                x="0.5"
                y="0.5"
                rx="16"
                style={{ width: "calc(100% - 1px)", height: "calc(100% - 1px)" }}
                stroke="#3A4157"
                strokeWidth="1"
                initial={{ pathLength: 0, opacity: 1 }}
                animate={{ pathLength: 1, opacity: [1, 1, 0] }}
                transition={{
                  pathLength: { delay: 0.15, duration: 1, ease: "easeInOut" },
                  opacity: { delay: 0.15, duration: 2, times: [0, 0.6, 1] },
                }}
              />
            </svg>
          )}
          <div className="grid lg:grid-cols-[1fr_auto_1.05fr]">
            {/* copy panel */}
            <div className="flex flex-col p-8 md:p-12 lg:p-14">
              <motion.div {...fadeUp(0.05)}>
                <span className="inline-flex items-center gap-2.5 rounded-[4px] border border-hair/50 bg-canvas/60 py-2 pl-2.5 pr-3.5">
                  <GhlMark className="h-4 w-auto" />
                  <span aria-hidden="true" className="h-3.5 w-px bg-hair" />
                  <span className="font-mono text-label uppercase tracking-[0.14em] text-dim">
                    {home.hero.eyebrow}
                  </span>
                </span>
              </motion.div>

              <h1 className="mt-8 font-display text-hero text-ink">
                <HeadlineLine delay={0.12}>{home.hero.headline}</HeadlineLine>
                <HeadlineLine delay={0.21} className="text-gradient">
                  {home.hero.headlineAccent}
                </HeadlineLine>
              </h1>

              <motion.p
                {...fadeUp(0.45)}
                className="mt-6 max-w-[var(--measure-lede)] text-lede text-muted"
              >
                {home.hero.lede}
              </motion.p>

              <motion.div
                {...fadeUp(0.57)}
                className="mt-9 flex flex-wrap items-center gap-4"
              >
                <Button href={cta.bookACall.href} variant="hero">
                  {cta.bookACall.label}
                </Button>
                <Button href={cta.seePremade.href} variant="ghost">
                  {cta.seePremade.label}
                </Button>
              </motion.div>

              {/* client voice anchors the panel bottom: photo slot,
                  hairline divider, two-line quote. Desktop only; on
                  mobile it re-renders after the media so the moving
                  work appears right after the CTAs */}
              <motion.div {...fadeUp(0.69)} className="mt-auto hidden pt-10 lg:block">
                <HeroReviewer
                  name={home.hero.testimonial.name}
                  quote={home.hero.testimonial.quote}
                  source={home.hero.testimonial.source}
                  video={home.hero.testimonial.video}
                  poster={home.hero.testimonial.poster}
                />
              </motion.div>
            </div>

            {/* hatched gutter, the drafting-table seam */}
            <div className="hatch hidden w-6 border-x border-hair lg:block" />

            {/* the work, playing */}
            <motion.div
              className="relative min-h-[16rem] p-3 lg:min-h-[30rem]"
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.35, ease: EASE }}
            >
              <MediaFrame
                src={featured.src}
                poster={featured.poster}
                label={`${featured.client}, ${featured.format}`}
                caption={{ title: featured.format }}
                className="!absolute inset-3 h-auto !aspect-auto"
              />
            </motion.div>

            {/* mobile-only client voice, after the media */}
            <motion.div {...fadeUp(0.69)} className="px-8 pb-8 lg:hidden">
              <HeroReviewer
                name={home.hero.testimonial.name}
                quote={home.hero.testimonial.quote}
                source={home.hero.testimonial.source}
                video={home.hero.testimonial.video}
                poster={home.hero.testimonial.poster}
              />
            </motion.div>
          </div>
        </Panel>
      </div>
    </section>
  );
}
