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
 * Thumbnails autoplay muted whenever they are in the viewport and
 * pause offscreen. CLICK (or Enter on the cover button) opens the
 * lightbox: the video pops up centered and autoplays FROM THE START
 * with sound and native controls; Escape or backdrop closes.
 * interactive=false drops the click affordance for frames inside a
 * Link. prefers-reduced-motion: no ambient autoplay (graded poster);
 * the lightbox still works since it is user-initiated.
 */

function Lightbox({
  src,
  poster,
  label,
  onClose,
}: {
  src: string;
  poster: string | null;
  label: string;
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
    videoRef.current?.play().catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      /* trap Tab inside the dialog: it has exactly two focusable
       * elements, the close button and the video */
      if (e.key === "Tab") {
        const stops = [closeRef.current, videoRef.current].filter(
          Boolean,
        ) as HTMLElement[];
        if (!stops.length) return;
        const idx = stops.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        const next = e.shiftKey
          ? stops[(idx - 1 + stops.length) % stops.length]
          : stops[(idx + 1) % stops.length];
        next.focus();
      }
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
  startAt = 0,
  endAt,
  tint,
  groupEase = false,
  rounded = "rounded-media",
  className = "",
}: {
  src: string;
  poster: string | null;
  label?: string;
  caption?: { title: string; sub: string };
  interactive?: boolean;
  /* ambient loop window: skip a clip's intro and loop back before its
   * tail (placeholder clips carry title cards); the lightbox always
   * plays the full clip from the start */
  startAt?: number;
  endAt?: number;
  /* accent-tinted grade so a service's media wears its own color */
  tint?: "gold" | "green" | "blue";
  /* also ease the grade when an ancestor group/svc container hovers */
  groupEase?: boolean;
  rounded?: string;
  className?: string;
}) {
  const figureRef = useRef<HTMLElement>(null);
  const ref = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = figureRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* ambient playback follows the viewport; Save-Data users get the
   * graded poster with tap-to-popup, like reduced motion already does */
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const saveData =
      (navigator as { connection?: { saveData?: boolean } }).connection
        ?.saveData === true;
    if (reduced || saveData || open || !inView) {
      v.pause();
      return;
    }
    if (startAt > 0 && v.currentTime < startAt) v.currentTime = startAt;
    v.play().catch(() => {});
  }, [inView, open, reduced, startAt]);

  return (
    <figure
      ref={figureRef}
      className={`group/mf relative aspect-video overflow-hidden border border-hair bg-[#05060A] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${rounded} ${className}`}
    >
      <video
        ref={ref}
        src={src}
        poster={poster ?? undefined}
        muted
        loop={startAt === 0 && endAt === undefined}
        playsInline
        preload="metadata"
        onTimeUpdate={
          endAt !== undefined
            ? (e) => {
                if (e.currentTarget.currentTime >= endAt)
                  e.currentTarget.currentTime = startAt;
              }
            : undefined
        }
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

      {/* unified grade, always on for ambient playback; eases as a
          hover affordance */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 transition-opacity duration-500 group-hover/mf:opacity-60 ${
          groupEase ? "group-hover/svc:opacity-60" : ""
        }`}
      >
        <div className="absolute inset-0 bg-canvas/45" />
        <div
          className="absolute inset-0"
          style={{
            background:
              tint === "gold"
                ? "linear-gradient(135deg, rgba(252,192,0,0.08), transparent 55%)"
                : tint === "green"
                  ? "linear-gradient(135deg, rgba(0,204,0,0.08), transparent 55%)"
                  : tint === "blue"
                    ? "linear-gradient(135deg, rgba(0,144,252,0.08), transparent 55%)"
                    : "linear-gradient(135deg, rgba(252,192,0,0.05), transparent 42%, rgba(0,204,0,0.05))",
          }}
        />
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
          onClick={() => setOpen(true)}
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
          onClose={() => setOpen(false)}
        />
      )}
    </figure>
  );
}
