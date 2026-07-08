"use client";

import { useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/*
 * The core interaction (brief 5.3): a video that plays on hover and
 * pauses on leave. Poster when idle, streams on demand (preload none).
 * A transparent full-cover button carries click, tap, and keyboard
 * toggling with an accessible name. interactive=false renders no
 * button: for tiles inside a Link, where the card itself navigates
 * and hover-play is the only motion. Under prefers-reduced-motion,
 * hover does nothing; playback stays available via the button.
 */
export function HoverClip({
  src,
  poster,
  label = "video preview",
  interactive = true,
  className = "",
  rounded = "rounded-media",
}: {
  src: string;
  poster: string | null;
  label?: string;
  interactive?: boolean;
  className?: string;
  rounded?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const reduced = useReducedMotion();

  const play = () => ref.current?.play().catch(() => {});
  const pause = () => ref.current?.pause();

  return (
    <div
      className={`group/clip relative overflow-hidden border border-hair bg-[#05060A] ${rounded} ${className}`}
      onMouseEnter={reduced ? undefined : play}
      onMouseLeave={reduced ? undefined : pause}
    >
      <video
        ref={ref}
        src={src}
        poster={poster ?? undefined}
        muted
        loop
        playsInline
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="absolute inset-0 h-full w-full object-cover"
      />
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
        className={`pointer-events-none absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full border border-hair bg-canvas/70 backdrop-blur-sm transition-opacity duration-300 ${
          playing ? "opacity-0" : "opacity-80"
        }`}
      >
        <svg viewBox="0 0 16 16" className="ml-0.5 h-3 w-3">
          <path d="M3 1.8v12.4L14 8 3 1.8Z" fill="#EEF0F6" />
        </svg>
      </span>
    </div>
  );
}
