"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MediaFrame } from "@/components/MediaFrame";
import {
  cta,
  premadeFilterGroups,
  premadePacks,
  type PackVideo,
  type PremadePack,
  type PremadeVideo,
} from "@/lib/site";

/*
 * The premade library. One pack at launch (AI First SaaS Pack). The
 * view rail picks the pack playlist or the "All videos" grid browser;
 * both read the same nine videos so nothing drifts. Everything is sold
 * as the pack, so purchase CTAs point at the pack. Square corners
 * throughout: this is the page's grid-lined instrument panel.
 */

const pack = premadePacks[0];

/* shared price cluster: struck anchor + live price */
function PriceTag({ p }: { p: PremadePack }) {
  return (
    <span className="flex items-baseline gap-2">
      {p.anchorPrice && (
        <span className="font-mono text-[0.9375rem] text-dim line-through [font-variant-numeric:tabular-nums]">
          ${p.anchorPrice.toLocaleString("en-US")}
        </span>
      )}
      <span className="font-mono text-[1.5rem] font-bold text-gold [font-variant-numeric:tabular-nums]">
        ${(p.price ?? 0).toLocaleString("en-US")}
      </span>
    </span>
  );
}

function BuyPackButton({
  p,
  className = "",
}: {
  p: PremadePack;
  className?: string;
}) {
  if (!p.price || !p.orderUrl) {
    return (
      <Link
        href={cta.bookACall.href}
        className={`group inline-flex items-center gap-2 whitespace-nowrap rounded-[3px] bg-green px-6 py-3 text-sm font-semibold text-[#08090D] transition-all duration-200 hover:brightness-110 active:scale-[0.98] ${className}`}
      >
        {cta.bookACall.label}
        <span aria-hidden="true">&rarr;</span>
      </Link>
    );
  }
  return (
    <a
      href={p.orderUrl}
      target="_blank"
      rel="noopener"
      className={`group inline-flex items-center gap-2 whitespace-nowrap rounded-[3px] bg-brand-gradient px-6 py-3 text-sm font-semibold text-[#08090D] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_28px_rgba(0,204,0,0.28)] transition-all duration-200 hover:brightness-[1.07] active:scale-[0.98] ${className}`}
    >
      Get the pack
      <span
        aria-hidden="true"
        className="transition-transform duration-200 group-hover:translate-x-0.5"
      >
        &rarr;
      </span>
    </a>
  );
}

/* ---------------------------------------------------------------- */
/* Preview lightbox with a pack buy bar                               */
/* ---------------------------------------------------------------- */

function PreviewLightbox({
  video,
  onClose,
}: {
  video: PremadeVideo;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    document.documentElement.style.overflow = "hidden";
    videoRef.current?.play().catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
      prev?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={video.title}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#08090D]/90 p-4 backdrop-blur-md md:p-12"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close video"
          className="absolute -top-12 right-0 flex h-10 w-10 items-center justify-center rounded-[3px] border border-[#2b2f40] bg-[#111219] text-[#EEF0F6] transition-colors hover:border-green"
        >
          <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" aria-hidden="true">
            <path
              d="M2 2l8 8M10 2l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <video
          ref={videoRef}
          src={video.preview ?? undefined}
          poster={video.poster ?? undefined}
          controls
          playsInline
          className="aspect-video w-full border border-[#2b2f40] bg-black"
        />
        {/* the buy bar: the preview closes with the action in reach */}
        <div className="flex flex-wrap items-center justify-between gap-4 border border-t-0 border-[#2b2f40] bg-[#111219] px-5 py-4">
          <div>
            <p className="font-display text-[1.0625rem] font-semibold text-[#EEF0F6]">
              {video.title}
            </p>
            <p className="mt-0.5 text-sm text-[#9096A8]">
              In the {pack.name}. Branded to you.{" "}
              {pack.anchorPrice && (
                <span className="text-[#5A6076] line-through">
                  ${pack.anchorPrice.toLocaleString("en-US")}
                </span>
              )}{" "}
              <span className="font-mono font-semibold text-gold">
                ${(pack.price ?? 0).toLocaleString("en-US")}
              </span>
            </p>
          </div>
          <BuyPackButton p={pack} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ---------------------------------------------------------------- */
/* All view: sidebar browser                                          */
/* ---------------------------------------------------------------- */

function FilterGroup({
  label,
  options,
  active,
  onPick,
}: {
  label: string;
  options: readonly string[];
  active: string | null;
  onPick: (v: string | null) => void;
}) {
  return (
    <div className="border-t border-hair px-5 py-5 first:border-t-0">
      <p className="font-mono text-label uppercase text-dim">[ {label} ]</p>
      <ul className="mt-3 grid gap-0.5">
        {[null, ...options].map((opt) => {
          const isActive = active === opt;
          return (
            <li key={opt ?? "any"}>
              <button
                type="button"
                onClick={() => onPick(opt)}
                aria-pressed={isActive}
                className={`flex w-full items-center gap-2.5 px-2 py-1.5 text-left text-[0.8125rem] transition-colors ${
                  isActive ? "text-gold" : "text-muted hover:text-ink"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 shrink-0 rounded-full border ${
                    isActive ? "border-gold bg-gold" : "border-dim"
                  }`}
                />
                {opt ?? "Any"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AllBrowser() {
  const reduced = useReducedMotion();
  const [format, setFormat] = useState<string | null>(null);
  const [availability, setAvailability] = useState<string | null>(null);
  const [preview, setPreview] = useState<PremadeVideo | null>(null);

  const shown = pack.categories
    .flatMap((c) => c.videos)
    .map((v, i): PremadeVideo => ({
      slug: `${v.title}-${i}`,
      title: v.title,
      type: v.type,
      format: v.format,
      preview: v.src,
      poster: v.poster,
      comingSoon: v.comingSoon ?? false,
    }))
    .filter(
      (v) =>
        (!format || v.format === format) &&
        (!availability ||
          (availability === "Coming soon" ? v.comingSoon : !v.comingSoon)),
    );
  const filtered = format || availability;

  return (
    <div>
      {/* pack offer banner: the purchase lives here too */}
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-b border-hair px-5 py-5 md:px-7">
        <div className="max-w-[52ch]">
          <p className="font-display text-[1.0625rem] font-semibold text-ink">
            {pack.name}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            All nine videos, white-labeled to your SaaS. Preview any one below.
          </p>
        </div>
        <div className="flex items-center gap-5">
          <PriceTag p={pack} />
          <BuyPackButton p={pack} />
        </div>
      </div>

      <div className="grid lg:grid-cols-[15.5rem_1fr]">
        {/* sidebar */}
        <aside className="border-b border-hair lg:border-b-0 lg:border-r">
          <FilterGroup
            label="Format"
            options={premadeFilterGroups.format}
            active={format}
            onPick={setFormat}
          />
          <FilterGroup
            label="Availability"
            options={premadeFilterGroups.availability}
            active={availability}
            onPick={setAvailability}
          />
        </aside>

        {/* results */}
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-hair px-5 py-3">
            <p className="font-mono text-label uppercase text-muted">
              {shown.length} {shown.length === 1 ? "video" : "videos"}
            </p>
            {filtered && (
              <button
                type="button"
                onClick={() => {
                  setFormat(null);
                  setAvailability(null);
                }}
                className="font-mono text-label uppercase text-dim transition-colors hover:text-gold"
              >
                [ Clear filters ]
              </button>
            )}
          </div>
          <div className="max-h-[44rem] overflow-y-auto p-5">
            {shown.length === 0 ? (
              <div className="flex h-64 items-center justify-center">
                <p className="font-mono text-label uppercase text-dim">
                  [ No videos match. Clear a filter. ]
                </p>
              </div>
            ) : (
              <motion.div
                layout={!reduced}
                className="grid gap-x-5 gap-y-8 md:grid-cols-2"
              >
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
                      <div className="group/card">
                        {video.comingSoon || !video.preview ? (
                          <div className="relative flex aspect-video items-center justify-center overflow-hidden border border-hair bg-surface">
                            <div
                              aria-hidden="true"
                              className="absolute inset-0 hatch opacity-40"
                            />
                            <span className="relative rounded-full border border-hair bg-canvas px-3 py-1.5 font-mono text-label uppercase text-dim">
                              Coming soon
                            </span>
                          </div>
                        ) : (
                          <div className="relative">
                            <MediaFrame
                              src={video.preview}
                              poster={video.poster}
                              label={video.title}
                              tint="gold"
                              interactive={false}
                              rounded="rounded-none"
                              caption={{ title: video.type, sub: video.format }}
                            />
                            <button
                              type="button"
                              onClick={() => setPreview(video)}
                              aria-label={`Preview: ${video.title}`}
                              aria-haspopup="dialog"
                              className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-offset-[-4px]"
                            />
                          </div>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-hair px-1 pb-4 pt-3.5">
                          <div className="min-w-0">
                            <h3 className="font-display text-[1.0625rem] font-semibold tracking-[-0.01em] text-ink">
                              {video.title}
                            </h3>
                            <p className="mt-0.5 font-mono text-label uppercase text-dim">
                              {video.format}
                            </p>
                          </div>
                          {video.comingSoon || !video.preview ? (
                            <span className="font-mono text-label uppercase text-dim">
                              In production
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPreview(video)}
                              aria-haspopup="dialog"
                              className="group/btn inline-flex items-center gap-1.5 whitespace-nowrap rounded-[3px] border border-hair px-4 py-2 text-[0.8125rem] font-semibold text-ink transition-colors hover:border-gold hover:text-gold"
                            >
                              Preview
                              <span
                                aria-hidden="true"
                                className="transition-transform duration-200 group-hover/btn:translate-x-0.5"
                              >
                                &rarr;
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {preview && (
        <PreviewLightbox video={preview} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Pack view: playlist                                                */
/* ---------------------------------------------------------------- */

function PackPlaylist({ pack }: { pack: PremadePack }) {
  const [catIdx, setCatIdx] = useState(0);
  const [vidIdx, setVidIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const cat = pack.categories[catIdx];
  const video: PackVideo | undefined = cat.videos[vidIdx];

  const pickCat = (i: number) => {
    setCatIdx(i);
    setVidIdx(0);
  };

  return (
    <div>
      {/* pack header band */}
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5 border-b border-hair px-5 py-6 md:px-7">
        <div className="max-w-[58ch]">
          <p className="font-display text-h3 text-ink">{pack.name}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {pack.tagline}
          </p>
        </div>
        <div className="flex items-center gap-6">
          {pack.count && (
            <span className="hidden font-mono text-label uppercase text-muted sm:inline">
              [ {pack.count} videos ]
            </span>
          )}
          <PriceTag p={pack} />
          <BuyPackButton p={pack} />
        </div>
      </div>

      {/* category tabs */}
      {pack.categories.length > 1 && (
        <div
          role="tablist"
          aria-label="Pack categories"
          className="flex flex-wrap gap-x-1 gap-y-1 border-b border-hair px-3 py-2.5"
        >
          {pack.categories.map((c, i) => (
            <button
              key={c.name}
              type="button"
              role="tab"
              aria-selected={i === catIdx}
              onClick={() => pickCat(i)}
              className={`flex min-h-10 items-center gap-2 px-3 font-mono text-[0.8125rem] transition-colors ${
                i === catIdx
                  ? "font-semibold text-gold"
                  : "text-muted hover:text-ink"
              }`}
            >
              <span
                aria-hidden="true"
                className={i === catIdx ? "text-gold" : "text-dim"}
              >
                [
              </span>
              {c.name}
              {c.count !== null && (
                <span
                  className={`text-[0.6875rem] ${i === catIdx ? "text-gold/70" : "text-dim"}`}
                >
                  {c.count}
                </span>
              )}
              <span
                aria-hidden="true"
                className={i === catIdx ? "text-gold" : "text-dim"}
              >
                ]
              </span>
            </button>
          ))}
        </div>
      )}

      {/* category line */}
      <p className="border-b border-hair px-5 py-3 text-sm text-muted md:px-7">
        {cat.line}
      </p>

      {/* playlist: rail + player */}
      <div className="grid lg:grid-cols-[19rem_1fr]">
        <div
          ref={listRef}
          role="listbox"
          aria-label="Included videos"
          aria-activedescendant={`pack-video-${vidIdx}`}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setVidIdx((v) => Math.min(v + 1, cat.videos.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setVidIdx((v) => Math.max(v - 1, 0));
            }
          }}
          className="border-b border-hair focus-visible:outline-2 lg:border-b-0 lg:border-r"
        >
          <p className="border-b border-hair px-5 py-3 font-mono text-label uppercase text-dim">
            Included videos{" "}
            <span className="hidden lg:inline">/ use &uarr; &darr; keys</span>
          </p>
          <div className="max-h-[26rem] overflow-y-auto">
            {cat.videos.map((v, i) => (
              <button
                key={v.title}
                id={`pack-video-${i}`}
                type="button"
                role="option"
                aria-selected={i === vidIdx}
                onClick={() => setVidIdx(i)}
                className={`flex w-full items-baseline gap-3 border-b border-hair px-5 py-4 text-left transition-colors last:border-b-0 ${
                  i === vidIdx
                    ? "border-l-2 border-l-gold bg-surface"
                    : "border-l-2 border-l-transparent hover:bg-surface/60"
                }`}
              >
                <span
                  className={`font-mono text-label [font-variant-numeric:tabular-nums] ${
                    i === vidIdx ? "text-gold" : "text-dim"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-[0.875rem] font-medium leading-snug ${
                      i === vidIdx ? "text-ink" : "text-muted"
                    }`}
                  >
                    {v.title}
                  </span>
                  <span className="mt-0.5 block font-mono text-[0.625rem] uppercase tracking-[0.14em] text-dim">
                    {v.format}
                  </span>
                </span>
                {v.comingSoon && (
                  <span className="shrink-0 self-center rounded-full border border-hair px-2 py-0.5 font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-dim">
                    Soon
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-0 p-5 md:p-7">
          {video && (video.comingSoon || !video.src) ? (
            <div className="relative flex aspect-video w-full flex-col items-center justify-center border border-hair bg-surface text-center">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 hatch opacity-30"
              />
              <span className="relative rounded-full border border-hair bg-canvas px-4 py-1.5 font-mono text-label uppercase text-dim">
                In production
              </span>
              <p className="relative mt-4 max-w-[36ch] px-6 text-sm text-muted">
                {video.title} is being produced now and lands in the pack as
                soon as it releases.
              </p>
            </div>
          ) : video ? (
            <video
              key={video.src + video.title}
              src={video.src ?? undefined}
              poster={video.poster ?? undefined}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full border border-hair bg-black"
            />
          ) : null}
          {video && (
            <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3 border-t border-hair pt-4">
              <p className="font-display text-[1.0625rem] font-semibold text-ink">
                {video.title}
              </p>
              <p className="font-mono text-label uppercase text-dim">
                Sample branding. Yours carries your SaaS name, logo, and colors.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* The library shell                                                  */
/* ---------------------------------------------------------------- */

export function PremadeLibrary() {
  const [view, setView] = useState<string>(pack.slug);
  const activePack = premadePacks.find((p) => p.slug === view);

  const tabs = [
    ...premadePacks.map((p) => ({ slug: p.slug, label: p.name, count: p.count })),
    { slug: "all", label: "All videos", count: null as number | null },
  ];

  return (
    <div>
      {/* view rail */}
      <div
        role="tablist"
        aria-label="Catalog view"
        className="flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-hair pb-4"
      >
        {tabs.map((tab) => {
          const isActive = view === tab.slug;
          return (
            <button
              key={tab.slug}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setView(tab.slug)}
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
                {tab.label}
              </span>
              {tab.count !== null && (
                <span
                  className={`text-[0.6875rem] ${isActive ? "text-gold/70" : "text-dim"}`}
                >
                  {tab.count}
                </span>
              )}
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

      {/* the instrument panel: square, hairline-framed */}
      <div className="mt-8 border border-hair bg-canvas">
        {activePack ? <PackPlaylist pack={activePack} /> : <AllBrowser />}
      </div>
    </div>
  );
}
