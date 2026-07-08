"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/*
 * Every clip and thumbnail on the site passes through this frame, so
 * all media reads as one system: 16:9, card radius, hairline border
 * with a top-edge light, and a unified dark grade (flat dim, faint
 * brand tint, slight desaturation). A bottom scrim keeps any baked-in
 * text in placeholder clips receding behind the frame's own mono
 * caption, which is always the readable layer.
 *
 * Idle shows the graded poster. On hover (or keyboard toggle via the
 * cover button) the clip plays, the grade lifts, and the image scales
 * a breath. interactive=false drops the button for frames inside a
 * Link, where the card itself navigates. prefers-reduced-motion:
 * hover does nothing, no scale, playback stays available through the
 * button.
 */
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
  const reduced = useReducedMotion();

  const play = () => {
    const v = ref.current;
    if (!v) return;
    if (startAt > 0 && v.currentTime < startAt) v.currentTime = startAt;
    v.play().catch(() => {});
  };
  const pause = () => ref.current?.pause();

  useEffect(() => {
    if (!autoplay) return;
    if (reduced) {
      ref.current?.pause();
      return;
    }
    play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, reduced]);

  return (
    <figure
      className={`group/mf relative aspect-video overflow-hidden border border-hair bg-[#05060A] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${rounded} ${className}`}
      onMouseEnter={reduced ? undefined : play}
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
        className={`absolute inset-0 h-full w-full object-cover brightness-[0.85] saturate-[0.8] transition-transform duration-[1400ms] ease-out ${
          playing && !reduced ? "scale-[1.03]" : "scale-100"
        }`}
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
          onClick={() => (playing ? pause() : play())}
          aria-label={(playing ? "Pause: " : "Play: ") + label}
          className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-offset-[-4px]"
        />
      )}

      {/* quiet play affordance, fades once playing */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute bottom-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-hair bg-canvas/70 backdrop-blur-sm transition-opacity duration-300 ${
          playing ? "opacity-0" : "opacity-80"
        }`}
      >
        <svg viewBox="0 0 16 16" className="ml-0.5 h-3 w-3">
          <path d="M3 1.8v12.4L14 8 3 1.8Z" fill="#EEF0F6" />
        </svg>
      </span>
    </figure>
  );
}
