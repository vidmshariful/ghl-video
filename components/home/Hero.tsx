"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/Button";
import { MediaFrame } from "@/components/MediaFrame";
import { Panel } from "@/components/Panel";
import { SectionChip } from "@/components/SectionChip";
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
    <section className="relative pt-28 pb-14 md:pt-32">
      {/* ambient: one gold and one green field behind the hero card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 top-6 h-[30rem] w-[46rem]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(252,192,0,0.09), transparent 72%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-24 h-[32rem] w-[48rem]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(0,204,0,0.09), transparent 72%)",
        }}
      />

      <div className="shell relative">
        <Panel className="overflow-hidden">
          <div className="grid lg:grid-cols-[1fr_auto_1.05fr]">
            {/* copy panel */}
            <div className="flex flex-col p-8 md:p-12 lg:p-14">
              <motion.div {...fadeUp(0.05)}>
                <SectionChip index={1} label={home.hero.eyebrow} />
              </motion.div>

              <h1 className="mt-8 font-display text-[clamp(2.5rem,5vw,4.25rem)] font-bold leading-[0.98] tracking-[-0.035em] text-ink">
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

              {/* checklist strip anchors the panel bottom */}
              <motion.div {...fadeUp(0.69)} className="mt-auto pt-10">
                <ul className="flex flex-wrap gap-x-8 gap-y-2.5 border-t border-hair pt-5">
                  {home.hero.checklist.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-2.5 font-mono text-label uppercase text-muted"
                    >
                      <svg
                        viewBox="0 0 12 12"
                        className="h-2.5 w-2.5"
                        aria-hidden="true"
                      >
                        <path
                          d="M2 6.2 4.8 9 10 3.4"
                          fill="none"
                          stroke="#00CC00"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
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
                caption={{ title: featured.client, sub: featured.format }}
                autoplay
                startAt={"startAt" in featured ? featured.startAt : 0}
                interactive={false}
                className="!absolute inset-3 h-auto !aspect-auto"
              />
            </motion.div>
          </div>
        </Panel>
      </div>
    </section>
  );
}
