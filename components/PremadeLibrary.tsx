"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MediaFrame } from "@/components/MediaFrame";
import {
  collab,
  cta,
  featureAnimations,
  oldVideos,
  oldVideoTypes,
  premadePacks,
  premadeVideos,
  videoStack,
  type CollabVersion,
  type PremadePack,
} from "@/lib/site";

/* a common shape both the new catalog and the classic library browse
 * through: a card, a price, a preview, and a real order link */
type BrowseVideo = {
  slug: string;
  title: string;
  typeTag: string;
  subTag: string;
  price: number;
  preview: string | null;
  poster: string | null;
  wistiaId: string | null;
  subtitle: string | null;
  packCount: number | null;
  /* feature animations ship in two cuts and aren't sold on their own */
  realPreview: string | null;
  realPoster: string | null;
  previewOnly: boolean;
  /* what a preview-only card says in place of a price + buy button */
  previewNote: string | null;
  previewCtaLabel: string | null;
  orderUrl: string;
};

type FilterDef = {
  label: string;
  options: readonly string[];
  on: "typeTag" | "subTag";
};

/* feature animations exist in two cuts the buyer toggles between */
type Version = "simplified" | "real";

const newReady: BrowseVideo[] = premadeVideos
  .filter((v) => !v.comingSoon && v.preview)
  .map((v) => ({
    slug: v.slug,
    title: v.title,
    typeTag: v.type,
    subTag: v.capability,
    price: v.price,
    preview: v.preview,
    poster: v.poster,
    wistiaId: null,
    subtitle: null,
    packCount: null,
    realPreview: null,
    realPoster: null,
    previewOnly: false,
    previewNote: null,
    previewCtaLabel: null,
    orderUrl: v.orderUrl,
  }));

const newGroups: FilterDef[] = [
  { label: "Video type", options: [...new Set(newReady.map((v) => v.typeTag))], on: "typeTag" },
  { label: "Capability", options: [...new Set(newReady.map((v) => v.subTag))], on: "subTag" },
];

/* feature animations get their own playlist tab, so the classic grid is
 * every other pre-2026 type: the individually-buyable videos. */
const oldClassic: BrowseVideo[] = oldVideos
  .filter((v) => v.type !== "Feature Animation")
  .map((v) => ({
    slug: v.slug,
    title: v.title,
    typeTag: v.type,
    subTag: "Pre-2026",
    price: v.price,
    preview: v.preview ?? null,
    poster: v.poster,
    wistiaId: v.wistiaId ?? null,
    subtitle: v.subtitle ?? null,
    packCount: v.packCount ?? null,
    realPreview: null,
    realPoster: null,
    previewOnly: false,
    previewNote: null,
    previewCtaLabel: null,
    orderUrl: v.orderUrl,
  }));

const oldBrowse: BrowseVideo[] = oldClassic;

const oldGroups: FilterDef[] = [
  {
    label: "Video type",
    options: oldVideoTypes.filter((t) => t !== "Feature Animation"),
    on: "typeTag",
  },
];

/* the three feature-animation bundles: this is how they are sold, in
 * multiples, never one at a time. */
const featurePacks = oldVideos.filter((v) => v.type === "Feature Animation");

/* the 23 feature animations, each a two-cut preview (Simplified / Real
 * UI). Bundled in the packs, so no single price or checkout. */
const featureBrowse: BrowseVideo[] = featureAnimations.map((f) => ({
  slug: `fa-${f.slug}`,
  title: f.name,
  typeTag: "Feature Animation",
  subTag: "Pre-2026",
  price: 0,
  preview: f.simplified,
  poster: f.thumbSimplified,
  wistiaId: null,
  subtitle: f.real ? "Simplified and Real UI" : "Simplified UI",
  packCount: null,
  realPreview: f.real,
  realPoster: f.thumbReal,
  previewOnly: true,
  previewNote: "Included in every feature-animation pack, branded to you.",
  previewCtaLabel: "See the packs",
  orderUrl: "https://order.ghlvideo.com/feature-animations-15",
}));

/* the Complete Video Stack's pre-decided line-up: our HighLevel team's
 * pick of the strongest videos across the new and classic library, in
 * the exact counts the stack sells (2 / 1 / 20 / 15 / 15 = 53). Swappable
 * on request at checkout. Built here so the counts can never drift. */
const stackNote =
  "Hand-picked by our HighLevel team from the full library, updated for every reseller. Want a different video in any slot? Request swaps at checkout.";

const stackByType = (type: string) =>
  oldClassic.filter((v) => v.typeTag === type);

const stackPicks: BrowseVideo[] = [
  ...stackByType("Explainer").slice(0, 2),
  ...stackByType("Demo").filter((v) => v.slug === "demo-v3-6708"),
  ...stackByType("Short Explainer").slice(0, 20),
  ...stackByType("Marketing").slice(0, 15),
  ...featureBrowse.slice(0, 15),
].map((v) => ({
  ...v,
  price: 0,
  previewOnly: true,
  previewNote: "Part of the Complete Video Stack, branded to your platform.",
  previewCtaLabel: "Get the stack",
  orderUrl: videoStack.orderUrl,
}));

const stackGroups: FilterDef[] = [
  {
    label: "Format",
    options: [...new Set(stackPicks.map((v) => v.typeTag))],
    on: "typeTag",
  },
];

/*
 * The premade library: the home for every video and pack. The view
 * rail lists "All videos" (default) plus each pack. "All videos" is a
 * filterable grid browser; a pack is a playlist. Every video is
 * individually purchasable (price by type) and also bundled in its
 * pack, so single-buy and pack-buy live side by side. Square corners
 * throughout: this is the page's grid-lined instrument panel.
 */

/* ---------------------------------------------------------------- */
/* Shared buy affordances                                             */
/* ---------------------------------------------------------------- */

function BuyVideoLink({
  video,
  label = "Buy now",
  className = "",
}: {
  video: { orderUrl: string };
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={video.orderUrl}
      target="_blank"
      rel="noopener"
      className={`group/btn inline-flex items-center gap-1.5 whitespace-nowrap rounded-[3px] bg-brand-gradient px-4 py-2 text-[0.8125rem] font-semibold text-[#08090D] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-all duration-200 hover:brightness-110 active:scale-[0.98] ${className}`}
    >
      {label}
      <span
        aria-hidden="true"
        className="transition-transform duration-200 group-hover/btn:translate-x-0.5"
      >
        &rarr;
      </span>
    </a>
  );
}

function Price({ value }: { value: number }) {
  return (
    <span className="font-mono text-[1.125rem] font-bold text-gold [font-variant-numeric:tabular-nums]">
      ${value.toLocaleString("en-US")}
    </span>
  );
}

/* A Wistia-hosted classic video: baked poster + play, opens the
 * lightbox that embeds the real Wistia player on click. */
function PosterPlay({
  video,
  onOpen,
}: {
  video: BrowseVideo;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Play: ${video.title}`}
      aria-haspopup="dialog"
      className="group/pp relative block aspect-video w-full overflow-hidden border border-hair bg-black focus-visible:outline-offset-[-4px]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static export, remote poster */}
      <img
        src={video.poster ?? undefined}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover opacity-90 transition duration-300 group-hover/pp:scale-[1.03] group-hover/pp:opacity-100"
      />
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      <span className="pointer-events-none absolute left-3 top-3 rounded-[3px] bg-black/55 px-2 py-1 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-[#EEF0F6] backdrop-blur-sm">
        {video.typeTag}
      </span>
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-gradient shadow-[0_0_28px_rgba(0,204,0,0.3)] transition-transform duration-300 group-hover/pp:scale-110">
          <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5" aria-hidden="true">
            <path d="M8 5v14l11-7z" fill="#08090D" />
          </svg>
        </span>
      </span>
    </button>
  );
}

/* Feature animation ships as a bundle, not a single clip: a typographic
 * pack tile stands in for a preview. */
function PackTile({ count }: { count: number }) {
  return (
    <div className="relative flex aspect-video w-full flex-col items-center justify-center overflow-hidden border border-hair bg-surface">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hatch opacity-20"
      />
      <span className="relative font-mono text-[2.75rem] font-bold leading-none text-gradient [font-variant-numeric:tabular-nums]">
        {count}
      </span>
      <span className="relative mt-2 font-mono text-label uppercase tracking-[0.14em] text-muted">
        feature animations
      </span>
    </div>
  );
}

/* Simplified UI vs Real UI segmented control, gold accent for the
 * active cut. Stops propagation so a card toggle never opens the card. */
function VersionToggle({
  version,
  onChange,
}: {
  version: Version;
  onChange: (v: Version) => void;
}) {
  const opts: [Version, string][] = [
    ["simplified", "Simplified UI"],
    ["real", "Real UI"],
  ];
  return (
    <div
      role="tablist"
      aria-label="UI version"
      className="inline-flex rounded-[3px] border border-hair bg-surface/90 p-0.5 backdrop-blur-sm"
    >
      {opts.map(([v, label]) => {
        const active = version === v;
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={(e) => {
              e.stopPropagation();
              onChange(v);
            }}
            className={`rounded-[2px] px-2.5 py-1 font-mono text-[0.6875rem] uppercase tracking-[0.1em] transition-colors ${
              active
                ? "bg-gold/15 font-semibold text-gold"
                : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* One card for every library row. Wistia classics get a poster+play;
 * mp4 classics get the hover frame; feature animations get a two-cut
 * toggle and no single price; feature packs get the typographic tile. */
function LibraryCard({
  video,
  onPreview,
}: {
  video: BrowseVideo;
  onPreview: (v: BrowseVideo, version: Version) => void;
}) {
  const [version, setVersion] = useState<Version>("simplified");
  const twoCut = video.previewOnly && video.realPreview;
  const src =
    twoCut && version === "real" && video.realPreview
      ? video.realPreview
      : video.preview;
  const poster =
    twoCut && version === "real" && video.realPoster
      ? video.realPoster
      : video.poster;

  return (
    <div className="group/card flex h-full flex-col">
      {video.wistiaId && video.poster ? (
        <PosterPlay video={video} onOpen={() => onPreview(video, "simplified")} />
      ) : video.preview ? (
        <div className="relative">
          <MediaFrame
            key={version}
            src={src ?? video.preview}
            poster={poster}
            label={video.title}
            tint="gold"
            interactive={false}
            rounded="rounded-none"
            caption={{ title: video.typeTag, sub: video.subTag }}
          />
          {twoCut && (
            <div className="absolute left-2 top-2 z-20">
              <VersionToggle version={version} onChange={setVersion} />
            </div>
          )}
          <button
            type="button"
            onClick={() => onPreview(video, version)}
            aria-label={`Preview: ${video.title}`}
            aria-haspopup="dialog"
            className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-offset-[-4px]"
          />
        </div>
      ) : video.packCount ? (
        <PackTile count={video.packCount} />
      ) : (
        <div className="flex aspect-video items-center justify-center border border-hair bg-[#030303]">
          <span className="font-mono text-label uppercase text-dim">
            [ Preview coming ]
          </span>
        </div>
      )}
      <div className="flex flex-1 flex-col border-b border-hair px-1 pb-4 pt-3.5">
        <div className="min-w-0">
          <h3 className="font-display text-[1.0625rem] font-semibold leading-snug tracking-[-0.01em] text-ink">
            {video.title}
          </h3>
          <p className="mt-1 font-mono text-label uppercase text-dim">
            {video.subtitle ?? video.typeTag}
          </p>
        </div>
        {video.previewOnly ? (
          <span className="mt-auto pt-4 font-mono text-label uppercase text-dim">
            Included
          </span>
        ) : (
          <div className="mt-auto flex items-center justify-between gap-3 pt-4">
            <Price value={video.price} />
            <BuyVideoLink video={video} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Preview lightbox with a single-video buy bar                       */
/* ---------------------------------------------------------------- */

function PreviewLightbox({
  video,
  initialVersion = "simplified",
  onClose,
}: {
  video: BrowseVideo;
  initialVersion?: Version;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasReal = Boolean(video.realPreview);
  const [version, setVersion] = useState<Version>(
    hasReal ? initialVersion : "simplified",
  );
  const src =
    version === "real" && video.realPreview ? video.realPreview : video.preview;
  const poster =
    version === "real" && video.realPoster ? video.realPoster : video.poster;

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
          className="absolute -top-12 right-0 flex h-10 w-10 items-center justify-center rounded-[3px] border border-[#2b2f40] bg-[#111219] text-[#EEF0F6] transition-colors hover:border-gold"
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
        {hasReal && (
          <div className="mb-3 flex justify-center">
            <VersionToggle version={version} onChange={setVersion} />
          </div>
        )}
        {video.wistiaId ? (
          <div className="aspect-video w-full border border-[#2b2f40] bg-black">
            <iframe
              src={`https://fast.wistia.net/embed/iframe/${video.wistiaId}?autoPlay=true&playerColor=FCC000`}
              title={video.title}
              allow="autoplay; fullscreen"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        ) : (
          <video
            key={src ?? video.slug}
            ref={videoRef}
            src={src ?? undefined}
            poster={poster ?? undefined}
            controls
            autoPlay
            playsInline
            className="aspect-video w-full border border-[#2b2f40] bg-black"
          />
        )}
        {/* the buy bar: the preview closes with the action in reach */}
        <div className="flex flex-wrap items-center justify-between gap-4 border border-t-0 border-[#2b2f40] bg-[#111219] px-5 py-4">
          {video.previewOnly ? (
            <>
              <div>
                <p className="font-display text-[1.0625rem] font-semibold text-[#EEF0F6]">
                  {video.title}
                </p>
                <p className="mt-0.5 text-sm text-[#9096A8]">
                  {video.previewNote ??
                    "Included in the bundle, branded to your platform."}
                </p>
              </div>
              <BuyVideoLink
                video={video}
                label={video.previewCtaLabel ?? "Order the bundle"}
                className="px-6 py-3 text-sm"
              />
            </>
          ) : (
            <>
              <div>
                <p className="font-display text-[1.0625rem] font-semibold text-[#EEF0F6]">
                  {video.title}
                </p>
                <p className="mt-0.5 text-sm text-[#9096A8]">
                  Make it yours, branded to you.{" "}
                  <span className="font-mono font-semibold text-gold">
                    ${video.price.toLocaleString("en-US")} one-time
                  </span>
                </p>
              </div>
              <BuyVideoLink video={video} className="px-6 py-3 text-sm" />
            </>
          )}
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
  countOf,
}: {
  label: string;
  options: readonly string[];
  active: string | null;
  onPick: (v: string | null) => void;
  countOf?: (opt: string | null) => number;
}) {
  return (
    <div className="border-t border-hair px-5 py-5 first:border-t-0">
      <p className="font-mono text-label uppercase text-dim">[ {label} ]</p>
      <ul className="mt-3 grid gap-0.5">
        {[null, ...options].map((opt) => {
          const isActive = active === opt;
          const count = countOf?.(opt);
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
                <span className="flex-1">{opt ?? "Any"}</span>
                {count !== undefined && (
                  <span
                    className={`font-mono text-[0.6875rem] [font-variant-numeric:tabular-nums] ${
                      isActive ? "text-gold/70" : "text-dim"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function VideoBrowser({
  videos,
  groups,
  note,
}: {
  videos: BrowseVideo[];
  groups: FilterDef[];
  note?: string;
}) {
  const reduced = useReducedMotion();
  const [sel, setSel] = useState<Record<string, string | null>>({});
  const [preview, setPreview] = useState<{
    video: BrowseVideo;
    version: Version;
  } | null>(null);

  const shown = videos.filter((v) =>
    groups.every((g) => !sel[g.label] || v[g.on] === sel[g.label]),
  );
  const filtered = groups.some((g) => sel[g.label]);

  return (
    <div>
      {note && (
        <p className="border-b border-hair px-5 py-3.5 text-sm text-muted md:px-7">
          {note}
        </p>
      )}
      <div className="grid lg:grid-cols-[15.5rem_1fr]">
        {/* sidebar */}
        <aside className="border-b border-hair lg:border-b-0 lg:border-r">
          {groups.map((g) => (
            <FilterGroup
              key={g.label}
              label={g.label}
              options={g.options}
              active={sel[g.label] ?? null}
              onPick={(val) => setSel((s) => ({ ...s, [g.label]: val }))}
              countOf={(opt) =>
                opt === null
                  ? videos.length
                  : videos.filter((v) => v[g.on] === opt).length
              }
            />
          ))}
        </aside>

        {/* results */}
        <div className="flex min-w-0 flex-col">
          <div className="flex min-h-[3rem] items-center justify-between gap-4 border-b border-hair bg-surface px-5 py-2">
            <p className="font-mono text-label uppercase text-muted">
              {shown.length} {shown.length === 1 ? "video" : "videos"}
            </p>
            {filtered && (
              <button
                type="button"
                onClick={() => setSel({})}
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
                      className="h-full"
                    >
                      <LibraryCard
                        video={video}
                        onPreview={(v, version) =>
                          setPreview({ video: v, version })
                        }
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {preview && (
        <PreviewLightbox
          video={preview.video}
          initialVersion={preview.version}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Feature animations: a two-cut playlist over the pack pricing        */
/* ---------------------------------------------------------------- */

function FeatureAnimationView() {
  const [idx, setIdx] = useState(0);
  const [version, setVersion] = useState<Version>("simplified");
  const feat = featureAnimations[idx];
  const hasReal = Boolean(feat.real);
  const src = version === "real" && feat.real ? feat.real : feat.simplified;
  const poster =
    version === "real" && feat.real ? feat.thumbReal : feat.thumbSimplified;

  return (
    <div>
      {/* what this is */}
      <div className="border-b border-hair px-5 py-6 md:px-7">
        <p className="font-display text-h3 text-ink">Feature Animations</p>
        <p className="mt-1.5 max-w-[70ch] text-sm leading-relaxed text-muted">
          Every HighLevel feature as a short animation, in two cuts: a clean
          Simplified UI and the Real UI on the live dashboard. Sold in bundles,
          branded to your platform.
        </p>
      </div>

      {/* playlist: preview left, list right */}
      <div className="grid lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 border-b border-hair lg:border-b-0 lg:border-r">
          <div className="flex min-h-[3rem] flex-wrap items-center justify-between gap-3 border-b border-hair bg-surface px-5 py-2">
            <p className="font-mono text-label uppercase text-dim">
              [ {feat.name} ]
            </p>
            {hasReal ? (
              <VersionToggle version={version} onChange={setVersion} />
            ) : (
              <span className="font-mono text-label uppercase text-dim">
                Simplified UI only
              </span>
            )}
          </div>
          <div className="p-5 md:p-7">
            <video
              key={src}
              src={src}
              poster={poster}
              controls
              autoPlay
              muted
              playsInline
              className="aspect-video w-full border border-hair bg-black"
            />
          </div>
        </div>

        <div
          role="listbox"
          aria-label="Feature animations"
          aria-activedescendant={`fa-opt-${idx}`}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIdx((i) => Math.min(i + 1, featureAnimations.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIdx((i) => Math.max(i - 1, 0));
            }
          }}
          className="lg:relative focus-visible:outline-2"
        >
          {/* absolute-fill on desktop so the player sets the height and
              the list scrolls inside it, not the other way around */}
          <div className="flex h-full flex-col lg:absolute lg:inset-0">
          <p className="flex min-h-[3rem] shrink-0 items-center border-b border-hair bg-surface px-5 py-2 font-mono text-label uppercase text-dim">
            <span>
              {featureAnimations.length} animations{" "}
              <span className="hidden lg:inline">/ use &uarr; &darr; keys</span>
            </span>
          </p>
          <div className="max-h-[26rem] flex-1 overflow-y-auto min-h-0 lg:max-h-none">
            {featureAnimations.map((f, i) => (
              <button
                key={f.slug}
                id={`fa-opt-${i}`}
                type="button"
                role="option"
                aria-selected={i === idx}
                onClick={() => setIdx(i)}
                className={`flex w-full items-baseline gap-3 border-b border-hair px-5 py-3.5 text-left transition-colors last:border-b-0 ${
                  i === idx
                    ? "border-l-2 border-l-gold bg-surface"
                    : "border-l-2 border-l-transparent hover:bg-surface/60"
                }`}
              >
                <span
                  className={`font-mono text-label [font-variant-numeric:tabular-nums] ${
                    i === idx ? "text-gold" : "text-dim"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-[0.875rem] font-medium leading-snug ${
                      i === idx ? "text-ink" : "text-muted"
                    }`}
                  >
                    {f.name}
                  </span>
                  <span className="mt-0.5 block font-mono text-[0.625rem] uppercase tracking-[0.14em] text-dim">
                    {f.real ? "Simplified + Real UI" : "Simplified UI"}
                  </span>
                </span>
              </button>
            ))}
          </div>
          </div>
        </div>
      </div>

      {/* pricing: sold in bundles, never one at a time */}
      <div className="border-t border-hair px-5 py-6 md:px-7">
        <p className="font-mono text-label uppercase text-dim">[ Pricing ]</p>
        <p className="mt-1 max-w-[60ch] text-sm text-muted">
          Feature animations are ordered in bundles, not one at a time. Pick the
          pack that covers the features you need.
        </p>
        <div className="mt-5 grid items-start gap-4 sm:grid-cols-3">
          {featurePacks.map((pack) => (
            <FeaturePriceCard key={pack.slug} pack={pack} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* what every feature-animation order ships with, identical across the
 * three bundles. Verbatim from the live pricing accordion. */
const featureIncludes: { text: string; ok: boolean; highlight?: boolean }[] = [
  { text: "Same video with your logo and brand color", ok: true },
  { text: "Both realistic and simplified version", ok: true },
  { text: "Keep or remove the default caption", ok: true },
  { text: "Add background music, on demand", ok: true },
  { text: "Delivery in 5 to 7 days", ok: true },
  {
    text: "Both old and new UI, released at LevelUp Summit",
    ok: true,
    highlight: true,
  },
  { text: "No voiceover", ok: false },
];

function FeaturePriceCard({ pack }: { pack: (typeof featurePacks)[number] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col rounded-[3px] border border-hair bg-canvas p-5">
      <p className="font-mono text-label uppercase text-dim">
        {pack.packCount} animations
      </p>
      <p className="mt-2 font-mono text-[1.75rem] font-bold leading-none text-gold [font-variant-numeric:tabular-nums]">
        ${pack.price.toLocaleString("en-US")}
      </p>
      <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">
        {pack.subtitle}
      </p>
      <a
        href={pack.orderUrl}
        target="_blank"
        rel="noopener"
        className="group/btn mt-4 inline-flex items-center justify-center gap-1.5 rounded-[3px] bg-brand-gradient px-4 py-2.5 text-[0.8125rem] font-semibold text-[#08090D] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
      >
        Order {pack.packCount}
        {"× "}
        <span
          aria-hidden="true"
          className="transition-transform duration-200 group-hover/btn:translate-x-0.5"
        >
          &rarr;
        </span>
      </a>

      {/* what's included: closed by default, opens on click */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-4 flex items-center justify-between gap-2 border-t border-hair pt-4 font-mono text-label uppercase text-muted transition-colors hover:text-gold"
      >
        What&rsquo;s included
        <span
          aria-hidden="true"
          className={`text-gold transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        >
          &darr;
        </span>
      </button>
      {open && (
        <ul className="mt-3 grid gap-2">
          {featureIncludes.map((it) => (
            <li key={it.text} className="flex items-start gap-2.5 text-[0.8125rem]">
              <span
                aria-hidden="true"
                className={`mt-0.5 shrink-0 ${it.ok ? "text-green" : "text-error"}`}
              >
                {it.ok ? (
                  <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none">
                    <path
                      d="M2.5 7.5l3 3 6-7"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none">
                    <path
                      d="M3.5 3.5l7 7M10.5 3.5l-7 7"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </span>
              <span
                className={
                  it.highlight
                    ? "font-medium text-gold"
                    : it.ok
                      ? "text-muted"
                      : "text-dim"
                }
              >
                {it.text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Bundle view: details (watch-before + what's inside) then preview   */
/* ---------------------------------------------------------------- */

type BundleSummaryItem = {
  name: string;
  count: number;
  value?: number | null;
  poster?: string | null;
};

/* the team walkthrough lands here; a designed placeholder until it is
 * shot and dropped in. */
function ComingSoonVideo() {
  return (
    <div className="relative flex aspect-video w-full flex-col items-center justify-center border border-hair bg-surface text-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hatch opacity-30"
      />
      <span className="relative flex h-12 w-12 items-center justify-center rounded-full border border-hair bg-canvas">
        <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5 text-gold" aria-hidden="true">
          <path d="M8 5v14l11-7z" fill="currentColor" />
        </svg>
      </span>
      <span className="relative mt-4 rounded-full border border-hair bg-canvas px-4 py-1.5 font-mono text-label uppercase text-dim">
        Video coming soon
      </span>
      <p className="relative mt-3 max-w-[38ch] px-6 text-sm text-muted">
        A short walkthrough from our team is being filmed and lands here soon.
      </p>
    </div>
  );
}

function BundleView({
  name,
  tagline,
  count,
  price,
  anchorPrice,
  orderUrl,
  ctaLabel,
  overviewNote,
  summaryItems,
  footNote,
  previewVideos,
  previewGroups,
  previewNote,
}: {
  name: string;
  tagline: string;
  count: number | null;
  price: number | null;
  anchorPrice?: number | null;
  orderUrl: string | null;
  ctaLabel: string;
  overviewNote: string;
  summaryItems: BundleSummaryItem[];
  footNote?: string | null;
  previewVideos: BrowseVideo[];
  previewGroups: FilterDef[];
  previewNote?: string | null;
}) {
  const canOrder = Boolean(price && orderUrl);
  return (
    <div>
      {/* header band: value anchor + one CTA */}
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5 border-b border-hair px-5 py-6 md:px-7">
        <div className="max-w-[60ch]">
          <p className="font-display text-h3 text-ink">{name}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{tagline}</p>
        </div>
        <div className="flex items-center gap-5">
          {count !== null && (
            <span className="hidden font-mono text-label uppercase text-muted sm:inline">
              [ {count} videos ]
            </span>
          )}
          {canOrder ? (
            <>
              <span className="flex items-baseline gap-2">
                {anchorPrice ? (
                  <span className="font-mono text-[0.9375rem] text-dim line-through [font-variant-numeric:tabular-nums]">
                    ${anchorPrice.toLocaleString("en-US")}
                  </span>
                ) : null}
                <span className="font-mono text-[1.5rem] font-bold text-gold [font-variant-numeric:tabular-nums]">
                  ${(price ?? 0).toLocaleString("en-US")}
                </span>
              </span>
              <a
                href={orderUrl ?? "#"}
                target="_blank"
                rel="noopener"
                className="group inline-flex items-center gap-2 whitespace-nowrap rounded-[3px] bg-brand-gradient px-6 py-3 text-sm font-semibold text-[#08090D] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_28px_rgba(0,204,0,0.28)] transition-all duration-200 hover:brightness-[1.07] active:scale-[0.98]"
              >
                {ctaLabel}
                <span
                  aria-hidden="true"
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
                >
                  &rarr;
                </span>
              </a>
            </>
          ) : (
            <Link
              href={cta.bookACall.href}
              className="group inline-flex items-center gap-2 whitespace-nowrap rounded-[3px] bg-brand-gradient px-6 py-3 text-sm font-semibold text-[#08090D] transition-all duration-200 hover:brightness-[1.07] active:scale-[0.98]"
            >
              {cta.bookACall.label}
              <span aria-hidden="true">&rarr;</span>
            </Link>
          )}
        </div>
      </div>

      {/* details: watch-before walkthrough + what's inside */}
      <div className="grid lg:grid-cols-[1.35fr_1fr]">
        <div className="border-b border-hair p-5 md:p-7 lg:border-b-0 lg:border-r">
          <p className="mb-3 font-mono text-label uppercase text-dim">
            [ Watch before you buy ]
          </p>
          <ComingSoonVideo />
          <p className="mt-3 text-sm text-muted">{overviewNote}</p>
        </div>

        <div className="p-5 md:p-7">
          <p className="mb-3 font-mono text-label uppercase text-dim">
            [ What&rsquo;s inside ]
          </p>
          <ul className="grid gap-px overflow-hidden rounded-[3px] border border-hair bg-hair">
            {summaryItems.map((f) => (
              <li key={f.name} className="flex items-center gap-4 bg-canvas p-3.5">
                <span className="relative block h-12 w-20 shrink-0 overflow-hidden rounded-[2px] border border-hair bg-black">
                  {f.poster ? (
                    // eslint-disable-next-line @next/next/no-img-element -- static export, remote poster
                    <img
                      src={f.poster}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover opacity-85"
                    />
                  ) : null}
                  <span className="absolute inset-0 flex items-center justify-center font-mono text-[0.9375rem] font-bold text-gradient [font-variant-numeric:tabular-nums]">
                    {f.count}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[0.9375rem] font-semibold text-ink">
                    {f.count}
                    {"× "}
                    {f.name}
                  </span>
                  {f.value ? (
                    <span className="mt-0.5 block font-mono text-[0.625rem] uppercase tracking-[0.14em] text-dim">
                      value ${f.value.toLocaleString("en-US")}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          {footNote && (
            <p className="mt-4 font-mono text-label uppercase text-dim">
              {footNote}
            </p>
          )}
        </div>
      </div>

      {/* preview: every included video, filterable and previewable */}
      <div className="border-t border-hair">
        <div className="px-5 py-6 md:px-7">
          <p className="font-mono text-label uppercase text-dim">
            [ Preview the line-up ]
          </p>
          {previewNote && (
            <p className="mt-1 max-w-[72ch] text-sm leading-relaxed text-muted">
              {previewNote}
            </p>
          )}
        </div>
        <div className="border-t border-hair">
          <VideoBrowser videos={previewVideos} groups={previewGroups} />
        </div>
      </div>
    </div>
  );
}

function VideoStackView() {
  const s = videoStack;
  const posterFor = (t: string) =>
    oldClassic.find((v) => v.typeTag === t && v.poster)?.poster ??
    featureBrowse.find((v) => v.poster)?.poster ??
    null;

  return (
    <BundleView
      name={s.name}
      tagline={s.tagline}
      count={s.totalCount}
      price={s.price}
      anchorPrice={s.anchorPrice}
      orderUrl={s.orderUrl}
      ctaLabel="Get the stack"
      overviewNote={`A walkthrough of the full stack from our team. Every format below ships branded to your platform, delivered in ${s.deliveryDays} days.`}
      summaryItems={s.formats.map((f) => ({
        name: f.name,
        count: f.count,
        value: f.value,
        poster: posterFor(f.sampleType),
      }))}
      footNote={`${s.totalCount} videos. One order. No contracts.`}
      previewVideos={stackPicks}
      previewGroups={stackGroups}
      previewNote={stackNote}
    />
  );
}

/* A pack rendered like the stack: details section, then a previewable
 * line-up of everything inside, grouped by category. */
function PackBundleView({ pack }: { pack: PremadePack }) {
  const previewVideos: BrowseVideo[] = pack.categories.flatMap((c) =>
    c.videos.map((v) => ({
      slug: `${pack.slug}-${v.title}`,
      title: v.title,
      typeTag: c.name,
      subTag: v.format,
      price: 0,
      preview: v.src,
      poster: v.poster,
      wistiaId: null,
      subtitle: v.format,
      packCount: null,
      realPreview: null,
      realPoster: null,
      previewOnly: true,
      previewNote: `Included in the ${pack.name}, branded to your platform.`,
      previewCtaLabel: "Get the pack",
      orderUrl: pack.orderUrl ?? cta.bookACall.href,
    })),
  );
  const previewGroups: FilterDef[] = [
    {
      label: "Category",
      options: pack.categories.map((c) => c.name),
      on: "typeTag",
    },
  ];
  const summaryItems: BundleSummaryItem[] = pack.categories.map((c) => ({
    name: c.name,
    count: c.count ?? c.videos.length,
    poster: c.videos.find((v) => v.poster)?.poster ?? null,
  }));

  return (
    <BundleView
      name={pack.name}
      tagline={pack.tagline}
      count={pack.count}
      price={pack.price}
      anchorPrice={pack.anchorPrice}
      orderUrl={pack.orderUrl}
      ctaLabel="Get the pack"
      overviewNote="A walkthrough of the pack from our team, branded to your platform. Every video below is included."
      summaryItems={summaryItems}
      footNote={pack.count ? `${pack.count} videos. One order.` : null}
      previewVideos={previewVideos}
      previewGroups={previewGroups}
      previewNote="Preview every video in the pack. Finished videos play now; the rest are in production and land as they release."
    />
  );
}

/* ---------------------------------------------------------------- */
/* HighLevel x Vidiosa: collaborations, played version by version      */
/* ---------------------------------------------------------------- */

/* A version's own preview, in a popup, with its buy-or-download CTA. */
function VersionLightbox({
  version,
  onClose,
}: {
  version: CollabVersion;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    document.documentElement.style.overflow = "hidden";
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

  const free = version.price === 0;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={version.name}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#08090D]/90 p-4 backdrop-blur-md md:p-12"
      onClick={onClose}
    >
      <div className="relative w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="absolute -top-12 right-0 flex h-10 w-10 items-center justify-center rounded-[3px] border border-[#2b2f40] bg-[#111219] text-[#EEF0F6] transition-colors hover:border-gold"
        >
          <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        {version.wistiaId ? (
          <div className="aspect-video w-full border border-[#2b2f40] bg-black">
            <iframe
              src={`https://fast.wistia.net/embed/iframe/${version.wistiaId}?autoPlay=true&playerColor=FCC000`}
              title={version.name}
              allow="autoplay; fullscreen"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        ) : (
          <div className="relative flex aspect-video w-full flex-col items-center justify-center border border-[#2b2f40] bg-surface text-center">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 hatch opacity-30" />
            <span className="relative rounded-full border border-hair bg-canvas px-4 py-1.5 font-mono text-label uppercase text-dim">
              Example coming soon
            </span>
            <p className="relative mt-3 max-w-[38ch] px-6 text-sm text-muted">
              We are producing a {version.name} sample. Order now and we brand
              it for you.
            </p>
          </div>
        )}
        {/* buy or download, in reach */}
        <div className="flex flex-wrap items-center justify-between gap-4 border border-t-0 border-[#2b2f40] bg-[#111219] px-5 py-4">
          <div>
            <p className="font-display text-[1.0625rem] font-semibold text-[#EEF0F6]">
              {version.name}
            </p>
            <p className="mt-0.5 text-sm text-[#9096A8]">
              {version.note}{" "}
              <span className="font-mono font-semibold text-gold">
                {free ? "Free" : `$${version.price.toLocaleString("en-US")}`}
              </span>
            </p>
          </div>
          <a
            href={version.url}
            target="_blank"
            rel="noopener"
            {...(version.cta === "download" ? { download: "" } : {})}
            className="group inline-flex items-center gap-2 whitespace-nowrap rounded-[3px] bg-brand-gradient px-6 py-3 text-sm font-semibold text-[#08090D] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
          >
            {version.cta === "download" ? "Download free" : "Buy now"}
            <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
              &rarr;
            </span>
          </a>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function CollabView() {
  const project = collab.projects[0];
  const [open, setOpen] = useState<CollabVersion | null>(null);
  return (
    <div>
      {/* header band */}
      <div className="border-b border-hair px-5 py-6 md:px-7">
        <p className="font-display text-h3 text-ink">{project.name}</p>
        <p className="mt-1.5 max-w-[72ch] text-sm leading-relaxed text-muted">
          {project.tagline}
        </p>
      </div>

      {/* body: the HighLevel original on the left, the versions on the right */}
      <div className="grid lg:grid-cols-[1.35fr_1fr]">
        <div className="min-w-0 border-b border-hair lg:border-b-0 lg:border-r">
          <p className="flex min-h-[3rem] items-center border-b border-hair bg-surface px-5 font-mono text-label uppercase text-dim">
            [ The HighLevel original ]
          </p>
          <div className="p-5 md:p-7">
            <video
              src={project.mainPreview}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full border border-hair bg-black"
            />
            <p className="mt-3 text-sm text-muted">
              The exact video we produced for HighLevel. Pick a version on the
              right to see it branded and grab it.
            </p>
          </div>
        </div>

        <div className="min-w-0">
          <p className="flex min-h-[3rem] items-center border-b border-hair bg-surface px-5 font-mono text-label uppercase text-dim">
            [ {project.versions.length} versions ]
          </p>
          <ul>
            {project.versions.map((v) => (
              <li key={v.slug}>
                <button
                  type="button"
                  onClick={() => setOpen(v)}
                  aria-haspopup="dialog"
                  className="group/v flex w-full items-center gap-4 border-b border-hair px-5 py-4 text-left transition-colors last:border-b-0 hover:bg-surface"
                >
                  {/* play affordance */}
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hair bg-canvas transition-colors group-hover/v:border-gold">
                    <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4 text-gold" aria-hidden="true">
                      <path d="M8 5v14l11-7z" fill="currentColor" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[0.9375rem] font-semibold text-ink">
                      {v.name}
                    </span>
                    <span className="mt-0.5 block text-[0.8125rem] leading-snug text-muted">
                      {v.note}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[0.9375rem] font-bold text-gold [font-variant-numeric:tabular-nums]">
                    {v.price === 0 ? "Free" : `$${v.price.toLocaleString("en-US")}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {open && <VersionLightbox version={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* The library shell                                                  */
/* ---------------------------------------------------------------- */

export function PremadeLibrary() {
  const [view, setView] = useState<string>("new");
  const activePack = premadePacks.find((p) => p.slug === view);

  const tabs = [
    { slug: "new", label: "All New Videos", count: newReady.length as number | null },
    ...premadePacks.map((p) => ({ slug: p.slug, label: p.name, count: p.count })),
    { slug: videoStack.slug, label: videoStack.name, count: videoStack.totalCount as number | null },
    { slug: collab.slug, label: collab.tabLabel, count: null },
    { slug: "features", label: "Feature Animations", count: featureAnimations.length as number | null },
    { slug: "old", label: "Classic Library", count: oldBrowse.length as number | null },
  ];

  return (
    <div>
      {/* view rail: All videos first, then each pack */}
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
        {activePack ? (
          <PackBundleView pack={activePack} />
        ) : view === videoStack.slug ? (
          <VideoStackView />
        ) : view === collab.slug ? (
          <CollabView />
        ) : view === "features" ? (
          <FeatureAnimationView />
        ) : view === "old" ? (
          <VideoBrowser
            videos={oldBrowse}
            groups={oldGroups}
            note="Produced before HighLevel's 2026 refresh. Most still brand cleanly, at the original prices and checkout links."
          />
        ) : (
          <VideoBrowser videos={newReady} groups={newGroups} />
        )}
      </div>
    </div>
  );
}
