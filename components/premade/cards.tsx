"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MediaFrame } from "@/components/MediaFrame";
import {
  checkoutHref,
  codeFor,
  cta,
  nicheAddon,
  nicheAddonPrice,
  nicheIntro,
  skuFor,
  withPromo,
} from "@/lib/site";
import { type BrowseVideo, type Version } from "./catalog";

/* ---------------------------------------------------------------- */
/* Shared buy affordances                                             */
/* ---------------------------------------------------------------- */

export function BuyVideoLink({
  video,
  label = cta.orderPremade,
  className = "",
}: {
  video: { slug: string; code?: string | null; checkoutSku?: string | null };
  label?: string;
  className?: string;
}) {
  // a DB catalog row buys by its own code; a preview-only card buys its
  // parent pack by that pack's sku; a legacy row buys by its slug.
  const href = withPromo(
    video.code
      ? `/checkout/${video.code}`
      : video.checkoutSku
        ? `/checkout/${skuFor(video.checkoutSku)}`
        : checkoutHref(video.slug),
  );
  return (
    <Link
      href={href}
      className={`tap group/btn inline-flex items-center gap-1.5 whitespace-nowrap rounded-[3px] bg-brand-gradient px-4 py-2 text-body-sm font-semibold text-canvas shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-all duration-200 hover:brightness-110 active:scale-[0.98] ${className}`}
    >
      {label}
      <span
        aria-hidden="true"
        className="transition-transform duration-200 group-hover/btn:translate-x-0.5"
      >
        &rarr;
      </span>
    </Link>
  );
}

export function Price({ value }: { value: number }) {
  return (
    <span className="font-mono text-lede font-bold text-gold [font-variant-numeric:tabular-nums]">
      ${value.toLocaleString("en-US")}
    </span>
  );
}

/* A Wistia-hosted classic video: baked poster + play, opens the
 * lightbox that embeds the real Wistia player on click. */
export function PosterPlay({
  video,
  onOpen,
  bordered = true,
}: {
  video: BrowseVideo;
  onOpen: () => void;
  bordered?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Play: ${video.title}`}
      aria-haspopup="dialog"
      className={`group/pp relative block aspect-video w-full overflow-hidden bg-black focus-visible:outline-offset-[-4px] ${bordered ? "border border-hair" : ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static export, remote poster */}
      <img
        src={video.poster ?? undefined}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover opacity-90 transition duration-300 group-hover/pp:scale-[1.03] group-hover/pp:opacity-100"
      />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#030303]/90 via-[#030303]/40 to-transparent" />
      <span className="pointer-events-none absolute bottom-3.5 left-4 z-10 font-mono text-label uppercase">
        <span className="text-ink">{video.typeTag}</span>
        {video.subTag && video.subTag !== "Pre-2026" && (
          <span className="text-muted"> / {video.subTag}</span>
        )}
      </span>
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-gradient shadow-[0_0_28px_rgba(0,204,0,0.3)] transition-transform duration-300 group-hover/pp:scale-110">
          <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5" aria-hidden="true">
            <path d="M8 5v14l11-7z" fill="var(--canvas)" />
          </svg>
        </span>
      </span>
    </button>
  );
}

/* Feature animation ships as a bundle, not a single clip: a typographic
 * pack tile stands in for a preview. */
export function PackTile({ count, bordered = true }: { count: number; bordered?: boolean }) {
  return (
    <div className={`relative flex aspect-video w-full flex-col items-center justify-center overflow-hidden bg-surface ${bordered ? "border border-hair" : ""}`}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hatch opacity-20"
      />
      <span className="relative font-mono text-stat-lg font-bold leading-none text-gradient [font-variant-numeric:tabular-nums]">
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
export function VersionToggle({
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
            className={`rounded-[2px] px-2.5 py-1 font-mono text-label uppercase tracking-[0.1em] transition-colors ${
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

/* A quiet per-video upsell: hover or focus reveals the ICP customization
 * offer. Informational for now; the copy points buyers to the checkout add-on. */
function NicheNote({ price = 50 }: { price?: number }) {
  return (
    <div className="group/niche relative px-4 py-2.5">
      <button
        type="button"
        aria-label="ICP customization details"
        className="inline-flex items-center gap-1.5 font-mono text-label uppercase tracking-[0.08em] text-dim transition-colors hover:text-gold focus-visible:text-gold focus:outline-none"
      >
        <svg
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 7.2v3.4M8 5.1h.01" strokeLinecap="round" />
        </svg>
        {nicheAddon.trigger}
      </button>
      <div
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-4 right-4 z-50 mb-2 border border-hair bg-surface p-4 opacity-0 shadow-[0_18px_50px_-18px_rgba(0,0,0,0.85)] transition-opacity duration-200 group-hover/niche:opacity-100 group-focus-within/niche:opacity-100"
      >
        <p className="font-display text-body font-semibold text-ink">{nicheAddon.title}</p>
        <p className="mt-1 text-body-sm leading-relaxed text-muted">{nicheIntro(price)}</p>
        <ul className="mt-2.5 space-y-1.5">
          {nicheAddon.bullets.map((line) => (
            <li
              key={line}
              className="flex items-start gap-2 text-body-sm leading-relaxed text-muted"
            >
              <svg viewBox="0 0 12 12" className="mt-[5px] h-3 w-3 shrink-0" aria-hidden="true">
                <path
                  d="M2 6.2 4.8 9 10 3.4"
                  fill="none"
                  stroke="var(--gold)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {line}
            </li>
          ))}
        </ul>
        <p className="mt-3 font-mono text-label uppercase text-gold/80">{nicheAddon.cta}</p>
      </div>
    </div>
  );
}

/* One card for every library row. Wistia classics get a poster+play;
 * mp4 classics get the hover frame; feature animations get a two-cut
 * toggle and no single price; feature packs get the typographic tile. */
export function LibraryCard({
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

  /* the descriptor line only earns its place when it is a real
     description, not a repeat of the type/capability shown on the video */
  const descriptor =
    video.subtitle && video.subtitle !== video.subTag ? video.subtitle : null;
  /* the permanent product code, shown so a buyer and the team can name the
     exact video. DB rows carry it directly; legacy rows resolve it from the
     slug. Bundle-content cards (previewOnly) show none: you buy the pack, not
     the video, and a stale per-video code would clash with the renumber. */
  const code = video.previewOnly
    ? null
    : video.code
      ? video.code.toUpperCase()
      : codeFor(video.slug);

  return (
    <div className="group/card flex h-full flex-col border border-hair bg-card shadow-[0_4px_18px_-8px_rgba(0,0,0,0.6)] transition-all duration-300 hover:-translate-y-0.5 hover:border-gold/30 hover:shadow-[0_18px_40px_-14px_rgba(0,0,0,0.85)]">
      {video.wistiaId && video.poster ? (
        <PosterPlay
          video={video}
          onOpen={() => onPreview(video, "simplified")}
          bordered={false}
        />
      ) : video.preview ? (
        <div className="relative">
          <MediaFrame
            key={version}
            src={src ?? video.preview}
            poster={poster}
            label={video.title}
            tint
            interactive={false}
            rounded="rounded-none"
            bordered={false}
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
        <PackTile count={video.packCount} bordered={false} />
      ) : (
        <div className="flex aspect-video items-center justify-center bg-[#030303]">
          <span className="font-mono text-label uppercase text-dim">
            [ Preview coming ]
          </span>
        </div>
      )}

      {/* description, all left-aligned: SKU, title, feature category */}
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
        {code && (
          <p className="font-mono text-label uppercase tracking-[0.12em] text-gold/80 [font-variant-numeric:tabular-nums]">
            {code}
          </p>
        )}
        <h3 className="mt-1 font-display text-h4 font-semibold leading-snug tracking-[-0.01em] text-ink">
          {video.title}
        </h3>
        {descriptor && (
          <p className="mt-1 font-mono text-label uppercase text-dim">{descriptor}</p>
        )}
      </div>

      {video.previewOnly ? (
        <div className="border-t border-hair px-4 py-3 text-center font-mono text-label uppercase text-dim">
          Included in the pack
        </div>
      ) : (
        <>
          {/* price + buy on one line: price left, button right, a divider
              between them, top and bottom rules edge to edge with the card */}
          <div className="flex items-stretch border-y border-hair">
            <div className="flex flex-1 items-center px-4 py-3">
              <Price value={video.price} />
            </div>
            <div className="flex items-center border-l border-hair px-3">
              <BuyVideoLink video={video} />
            </div>
          </div>
          <NicheNote price={nicheAddonPrice(!!code?.startsWith("DEMO"))} />
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Preview lightbox with a single-video buy bar                       */
/* ---------------------------------------------------------------- */

export function PreviewLightbox({
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-canvas/90 p-4 backdrop-blur-md md:p-12"
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
          className="absolute -top-12 right-0 flex h-10 w-10 items-center justify-center rounded-[3px] border border-hair bg-surface text-ink transition-colors hover:border-gold"
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
          <div className="aspect-video w-full border border-hair bg-black">
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
            className="aspect-video w-full border border-hair bg-black"
          />
        )}
        {/* the buy bar: the preview closes with the action in reach */}
        <div className="flex flex-wrap items-center justify-between gap-4 border border-t-0 border-hair bg-surface px-5 py-4">
          {video.previewOnly ? (
            <>
              <div>
                <p className="font-display text-h4 font-semibold text-ink">
                  {video.title}
                </p>
                <p className="mt-0.5 text-body text-muted">
                  {video.previewNote ??
                    "Included in the bundle, branded to your platform."}
                </p>
              </div>
              <BuyVideoLink
                video={video}
                label={video.previewCtaLabel ?? "Order the bundle"}
                className="px-6 py-3 text-body"
              />
            </>
          ) : (
            <>
              <div>
                <p className="font-display text-h4 font-semibold text-ink">
                  {video.title}
                </p>
                <p className="mt-0.5 text-body text-muted">
                  Make it yours, branded to you.{" "}
                  <span className="font-mono font-semibold text-gold">
                    ${video.price.toLocaleString("en-US")} one-time
                  </span>
                </p>
              </div>
              <BuyVideoLink video={video} className="px-6 py-3 text-body" />
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
