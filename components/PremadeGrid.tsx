"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MediaFrame } from "@/components/MediaFrame";
import {
  premadeTypes,
  premadeVideos,
  type PremadeType,
  type PremadeVideo,
} from "@/lib/site";

/*
 * The filterable launch-set grid. Filters speak the bracket language;
 * the active type is gold, the count reads like a spec line. Cards are
 * NOT boxes: the media frame is the card, with a hairline underline
 * carrying title, purpose, price, and the per-SKU order button.
 */

function Card({ video }: { video: PremadeVideo }) {
  return (
    <div data-cell className="group/cell">
      {video.preview ? (
        <MediaFrame
          src={video.preview}
          poster={video.poster}
          label={video.title}
          tint="gold"
          caption={{ title: video.type, sub: "Premade" }}
        />
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-media border border-hair bg-[#030303]">
          <span className="font-mono text-label uppercase text-dim">
            [ Preview coming ]
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-hair px-1 pb-5 pt-4">
        <div className="min-w-0">
          <h3 className="font-display text-[1.125rem] font-semibold tracking-[-0.01em] text-ink">
            {video.title}
          </h3>
          <p className="mt-1 max-w-[34ch] text-sm text-muted">
            {video.purpose}
          </p>
        </div>
        <div className="flex items-center gap-5">
          <span className="font-mono text-price text-gold [font-variant-numeric:tabular-nums]">
            ${video.price}
          </span>
          <a
            href={video.orderUrl}
            target="_blank"
            rel="noopener"
            className="group/btn inline-flex items-center gap-2 whitespace-nowrap rounded-[3px] bg-green px-5 py-2.5 text-sm font-semibold text-[#08090D] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
          >
            Order for ${video.price}
            <span
              aria-hidden="true"
              className="transition-transform duration-200 group-hover/btn:translate-x-0.5"
            >
              &rarr;
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}

export function PremadeGrid() {
  const [active, setActive] = useState<PremadeType | "All">("All");
  const reduced = useReducedMotion();
  const shown =
    active === "All"
      ? premadeVideos
      : premadeVideos.filter((v) => v.type === active);

  return (
    <div>
      {/* filter rail: bracket chips over a hairline */}
      <div
        role="tablist"
        aria-label="Filter videos by type"
        className="flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-hair pb-4"
      >
        {(["All", ...premadeTypes] as const).map((type) => {
          const isActive = active === type;
          const count =
            type === "All"
              ? premadeVideos.length
              : premadeVideos.filter((v) => v.type === type).length;
          return (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(type)}
              className="group/tab flex min-h-11 items-center gap-1.5 px-3 font-mono text-[0.8125rem] transition-colors"
            >
              <span
                aria-hidden="true"
                className={`transition-opacity ${
                  isActive
                    ? "text-gold opacity-100"
                    : "text-dim opacity-0 group-hover/tab:opacity-100"
                }`}
              >
                [
              </span>
              <span
                className={
                  isActive
                    ? "font-semibold text-gold"
                    : "text-muted group-hover/tab:text-ink"
                }
              >
                {type}
              </span>
              <span
                className={`text-[0.6875rem] ${isActive ? "text-gold/70" : "text-dim"}`}
              >
                {count}
              </span>
              <span
                aria-hidden="true"
                className={`transition-opacity ${
                  isActive
                    ? "text-gold opacity-100"
                    : "text-dim opacity-0 group-hover/tab:opacity-100"
                }`}
              >
                ]
              </span>
            </button>
          );
        })}
      </div>

      <motion.div layout={!reduced} className="mt-8 grid gap-x-6 gap-y-10 lg:grid-cols-2">
        <AnimatePresence mode="popLayout" initial={false}>
          {shown.map((video) => (
            <motion.div
              key={video.slug}
              layout={!reduced}
              initial={reduced ? false : { opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduced ? undefined : { opacity: 0, scale: 0.985 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <Card video={video} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
