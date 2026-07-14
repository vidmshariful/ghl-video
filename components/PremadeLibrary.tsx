"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MediaFrame } from "@/components/MediaFrame";
import {
  cta,
  featureAnimations,
  oldVideos,
  oldVideoTypes,
  premadeBySlugTitle,
  premadePacks,
  premadeVideos,
  videoStack,
  type PackVideo,
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
    orderUrl: v.orderUrl,
  }));

const newGroups: FilterDef[] = [
  { label: "Video type", options: [...new Set(newReady.map((v) => v.typeTag))], on: "typeTag" },
  { label: "Capability", options: [...new Set(newReady.map((v) => v.subTag))], on: "subTag" },
];

const oldClassic: BrowseVideo[] = oldVideos.map((v) => ({
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
  orderUrl: v.orderUrl,
}));

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
  orderUrl: "https://order.ghlvideo.com/feature-animations-15",
}));

/* packs first (buyable), then the feature previews under the same filter */
const oldBrowse: BrowseVideo[] = [...oldClassic, ...featureBrowse];

const oldGroups: FilterDef[] = [
  { label: "Video type", options: oldVideoTypes, on: "typeTag" },
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

function GetPackLink({ pack }: { pack: PremadePack }) {
  if (!pack.price || !pack.orderUrl) {
    return (
      <Link
        href={cta.bookACall.href}
        className="group inline-flex items-center gap-2 whitespace-nowrap rounded-[3px] bg-brand-gradient px-6 py-3 text-sm font-semibold text-[#08090D] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
      >
        {cta.bookACall.label}
        <span aria-hidden="true">&rarr;</span>
      </Link>
    );
  }
  return (
    <a
      href={pack.orderUrl}
      target="_blank"
      rel="noopener"
      className="group inline-flex items-center gap-2 whitespace-nowrap rounded-[3px] bg-brand-gradient px-6 py-3 text-sm font-semibold text-[#08090D] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_28px_rgba(0,204,0,0.28)] transition-all duration-200 hover:brightness-[1.07] active:scale-[0.98]"
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
    <div className="group/card">
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
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-hair px-1 pb-4 pt-3.5">
        <div className="min-w-0">
          <h3 className="font-display text-[1.0625rem] font-semibold tracking-[-0.01em] text-ink">
            {video.title}
          </h3>
          <p className="mt-0.5 font-mono text-label uppercase text-dim">
            {video.subtitle ?? video.typeTag}
          </p>
        </div>
        {video.previewOnly ? (
          <span className="font-mono text-label uppercase text-dim">
            In every pack
          </span>
        ) : (
          <div className="flex items-center gap-4">
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
                  Included in every feature-animation pack, branded to your
                  platform.
                </p>
              </div>
              <BuyVideoLink
                video={video}
                label="See the packs"
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
            />
          ))}
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
/* Pack view: playlist (pack buy + single-video buy)                  */
/* ---------------------------------------------------------------- */

function PackPlaylist({ pack }: { pack: PremadePack }) {
  const [catIdx, setCatIdx] = useState(0);
  const [vidIdx, setVidIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const cat = pack.categories[catIdx];
  const video: PackVideo | undefined = cat.videos[vidIdx];
  const single = video ? premadeBySlugTitle[video.title] : undefined;

  const pickCat = (i: number) => {
    setCatIdx(i);
    setVidIdx(0);
  };

  return (
    <div>
      {/* pack header band: bundle price + get the pack */}
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5 border-b border-hair px-5 py-6 md:px-7">
        <div className="max-w-[58ch]">
          <p className="font-display text-h3 text-ink">{pack.name}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {pack.tagline}
          </p>
        </div>
        <div className="flex items-center gap-5">
          {pack.count && (
            <span className="hidden font-mono text-label uppercase text-muted sm:inline">
              [ {pack.count} videos ]
            </span>
          )}
          <span className="flex items-baseline gap-2">
            {pack.anchorPrice && (
              <span className="font-mono text-[0.9375rem] text-dim line-through [font-variant-numeric:tabular-nums]">
                ${pack.anchorPrice.toLocaleString("en-US")}
              </span>
            )}
            <span className="font-mono text-[1.5rem] font-bold text-gold [font-variant-numeric:tabular-nums]">
              ${(pack.price ?? 0).toLocaleString("en-US")}
            </span>
          </span>
          <GetPackLink pack={pack} />
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
            <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-hair pt-4">
              <div className="min-w-0">
                <p className="font-display text-[1.0625rem] font-semibold text-ink">
                  {video.title}
                </p>
                <p className="mt-0.5 font-mono text-label uppercase text-dim">
                  Sample branding. Yours carries your SaaS name and colors.
                </p>
              </div>
              {/* single-video buy sits beside the pack: buy one, or bundle */}
              {single && !video.comingSoon && video.src && (
                <div className="flex items-center gap-3">
                  <span className="font-mono text-label uppercase text-dim">
                    Single
                  </span>
                  <Price value={single.price} />
                  <BuyVideoLink video={single} label="Buy this video" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Stack view: the everything bundle, sold as one                     */
/* ---------------------------------------------------------------- */

function VideoStackView() {
  const s = videoStack;
  const posterFor = (t: string) =>
    oldClassic.find((v) => v.typeTag === t && v.poster)?.poster ??
    featureBrowse.find((v) => v.poster)?.poster ??
    null;

  return (
    <div>
      {/* header band: value anchor + one CTA */}
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5 border-b border-hair px-5 py-6 md:px-7">
        <div className="max-w-[60ch]">
          <p className="font-display text-h3 text-ink">{s.name}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {s.tagline}
          </p>
        </div>
        <div className="flex items-center gap-5">
          <span className="hidden font-mono text-label uppercase text-muted sm:inline">
            [ {s.totalCount} videos ]
          </span>
          <span className="flex items-baseline gap-2">
            <span className="font-mono text-[0.9375rem] text-dim line-through [font-variant-numeric:tabular-nums]">
              ${s.anchorPrice.toLocaleString("en-US")}
            </span>
            <span className="font-mono text-[1.5rem] font-bold text-gold [font-variant-numeric:tabular-nums]">
              ${s.price.toLocaleString("en-US")}
            </span>
          </span>
          <a
            href={s.orderUrl}
            target="_blank"
            rel="noopener"
            className="group inline-flex items-center gap-2 whitespace-nowrap rounded-[3px] bg-brand-gradient px-6 py-3 text-sm font-semibold text-[#08090D] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_28px_rgba(0,204,0,0.28)] transition-all duration-200 hover:brightness-[1.07] active:scale-[0.98]"
          >
            Get the stack
            <span
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            >
              &rarr;
            </span>
          </a>
        </div>
      </div>

      {/* body: overview preview + the five formats inside */}
      <div className="grid lg:grid-cols-[1.35fr_1fr]">
        <div className="border-b border-hair p-5 md:p-7 lg:border-b-0 lg:border-r">
          <p className="mb-3 font-mono text-label uppercase text-dim">
            [ Watch before you buy ]
          </p>
          <video
            src={s.preview}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full border border-hair bg-black"
          />
          <p className="mt-3 text-sm text-muted">
            The complete overview explainer. Every format below, branded to
            your platform and delivered in {s.deliveryDays} days.
          </p>
        </div>

        <div className="p-5 md:p-7">
          <p className="mb-3 font-mono text-label uppercase text-dim">
            [ What&rsquo;s inside ]
          </p>
          <ul className="grid gap-px overflow-hidden rounded-[3px] border border-hair bg-hair">
            {s.formats.map((f) => {
              const poster = posterFor(f.sampleType);
              return (
                <li
                  key={f.name}
                  className="flex items-center gap-4 bg-canvas p-3.5"
                >
                  <span className="relative block h-12 w-20 shrink-0 overflow-hidden rounded-[2px] border border-hair bg-black">
                    {poster ? (
                      // eslint-disable-next-line @next/next/no-img-element -- static export, remote poster
                      <img
                        src={poster}
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
                    <span className="mt-0.5 block font-mono text-[0.625rem] uppercase tracking-[0.14em] text-dim">
                      value ${f.value.toLocaleString("en-US")}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 font-mono text-label uppercase text-dim">
            {s.totalCount} videos. One order. No contracts.
          </p>
        </div>
      </div>
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
          <PackPlaylist pack={activePack} />
        ) : view === videoStack.slug ? (
          <VideoStackView />
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
