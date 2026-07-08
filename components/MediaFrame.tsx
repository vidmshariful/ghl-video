"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useReducedMotion } from "framer-motion";

/*
 * Every clip and thumbnail on the site passes through this frame, so
 * all media reads as one system: 16:9, card radius, hairline border
 * with a top-edge light, and a unified dark grade (flat dim, faint
 * brand tint, slight desaturation). A bottom scrim keeps any baked-in
 * text in placeholder clips receding behind the frame's own mono
 * caption, which is always the readable layer.
 *
 * Hover previews the clip muted in place. CLICK (or Enter on the
 * cover button) opens the lightbox: the video pops up centered and
 * autoplays with sound, native controls, Escape or backdrop to close.
 * interactive=false drops the click affordance for frames that live
 * inside a Link. prefers-reduced-motion: hover does nothing; the
 * lightbox still works since it is user-initiated.
 */

function Lightbox({
  src,
  poster,
  label,
  startAt,
  onClose,
}: {
  src: string;
  poster: string | null;
  label: string;
  startAt: number;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    document.documentElement.style.overflow = "hidden";
    /* explicit play() inside the click's user-activation window: the
     * autoplay attribute alone will not start unmuted playback */
    const v = videoRef.current;
    if (v) {
      if (startAt > 0) v.currentTime = startAt;
      v.play().catch(() => {});
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
      prev?.focus();
    };
  }, [onClose, startAt]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
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
          className="absolute -top-12 right-0 flex h-10 w-10 items-center justify-center rounded-[3px] border border-hair bg-surface text-ink transition-colors hover:border-green"
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
          src={src}
          poster={poster ?? undefined}
          controls
          playsInline
          className="aspect-video w-full rounded-[6px] border border-hair bg-black"
        />
      </div>
    </div>,
    document.body,
  );
}

export function MediaFrame({
  src,
  poster,
  label = "video preview",
  caption,
  interactive = true,
  autoplay = false,
  startAt = 0,
  rounded = "rounded-media",
  className = "",
}: {
  src: string;
  poster: string | null;
  label?: string;
  caption?: { title: string; sub: string };
  interactive?: boolean;
  /* muted ambient playback (hero panel); reduced motion gets the poster */
  autoplay?: boolean;
  /* skip a clip's intro segment (placeholder clips carry title cards);
   * looping returns to this offset, not zero */
  startAt?: number;
  rounded?: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();

  const play = () => {
    const v = ref.current;
    if (!v) return;
    if (startAt > 0 && v.currentTime < startAt) v.currentTime = startAt;
    v.play().catch(() => {});
  };
  const pause = () => ref.current?.pause();

  useEffect(() => {
    if (!autoplay || open) return;
    if (reduced) {
      ref.current?.pause();
      return;
    }
    play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, reduced, open]);

  const openLightbox = () => {
    pause();
    setOpen(true);
  };

  return (
    <figure
      className={`group/mf relative aspect-video overflow-hidden border border-hair bg-[#05060A] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${rounded} ${className}`}
      onMouseEnter={reduced || open ? undefined : play}
      onMouseLeave={reduced ? undefined : pause}
    >
      <video
        ref={ref}
        src={src}
        poster={poster ?? undefined}
        muted
        loop={startAt === 0}
        playsInline
        preload={autoplay ? "auto" : "none"}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={
          startAt > 0
            ? (e) => {
                e.currentTarget.currentTime = startAt;
                e.currentTarget.play().catch(() => {});
              }
            : undefined
        }
        className="absolute inset-0 h-full w-full object-cover brightness-[0.85] saturate-[0.8]"
      />

      {/* unified grade; lifts as a hover reward, stays put on ambient
          autoplay so the hero never blazes */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 transition-opacity duration-500 ${
          playing && !autoplay ? "opacity-35" : "opacity-100"
        }`}
      >
        <div className="absolute inset-0 bg-canvas/45" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(252,192,0,0.05),transparent_42%,rgba(0,204,0,0.05))]" />
      </div>

      {/* bottom scrim: the frame's caption owns this zone, clip text recedes */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#05060A]/90 via-[#05060A]/40 to-transparent"
      />

      {caption && (
        <figcaption className="pointer-events-none absolute bottom-3.5 left-4 z-10 font-mono text-label uppercase">
          <span className="text-ink">{caption.title}</span>
          <span className="text-dim"> / {caption.sub}</span>
        </figcaption>
      )}

      {interactive && (
        <button
          type="button"
          onClick={openLightbox}
          aria-label={`Play: ${label}`}
          aria-haspopup="dialog"
          className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-offset-[-4px]"
        />
      )}

      {/* quiet play affordance */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-hair bg-canvas/70 opacity-80 backdrop-blur-sm transition-transform duration-300 group-hover/mf:scale-110"
      >
        <svg viewBox="0 0 16 16" className="ml-0.5 h-3 w-3">
          <path d="M3 1.8v12.4L14 8 3 1.8Z" fill="#EEF0F6" />
        </svg>
      </span>

      {open && (
        <Lightbox
          src={src}
          poster={poster}
          label={label}
          startAt={startAt}
          onClose={() => setOpen(false)}
        />
      )}
    </figure>
  );
}
