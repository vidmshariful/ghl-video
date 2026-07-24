"use client";

import { useEffect, useRef, useState } from "react";

function Play({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={className} aria-hidden="true">
      <path d="M3.5 2.5 9.5 6l-6 3.5z" fill="currentColor" />
    </svg>
  );
}

/*
 * The hero client-voice row: a circular avatar that plays the reviewer's
 * testimonial (muted loop) once a video is set, and on click opens a small
 * player popup above it with an arrow pointing back down to the avatar, so
 * the two read as connected. With no video yet it shows the initial + a
 * play badge and the popup shows a placeholder.
 */
export function HeroReviewer({
  name,
  quote,
  source,
  video,
  poster,
}: {
  name: string;
  quote: string;
  source: string;
  video: string | null;
  poster: string | null;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const initial = name.trim()[0]?.toUpperCase() ?? "";

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="flex items-center gap-5 border-t border-hair pt-6">
      <div ref={wrapRef} className="relative shrink-0">
        {/* the player popup, above the avatar, with a downward arrow */}
        {open && (
          <div className="absolute bottom-full left-0 z-30 mb-3 w-64">
            <div className="overflow-hidden rounded-[6px] border border-hair bg-card shadow-[0_24px_60px_-24px_rgba(0,0,0,0.95)]">
              <div className="relative aspect-video bg-canvas">
                {video ? (
                  <video
                    src={video}
                    poster={poster ?? undefined}
                    autoPlay
                    controls
                    playsInline
                    className="h-full w-full object-cover"
                  />
                ) : poster ? (
                  // eslint-disable-next-line @next/next/no-img-element -- static export
                  <img src={poster} alt={name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-dim">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-hair bg-surface text-gold">
                      <Play className="h-3.5 w-3.5" />
                    </span>
                    <span className="font-mono text-label uppercase">Video coming</span>
                  </div>
                )}
              </div>
              <p className="px-3 py-2 font-mono text-label uppercase text-dim">
                {name} / {source}
              </p>
            </div>
            <span
              aria-hidden="true"
              className="absolute left-7 top-full -mt-[7px] h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-hair bg-card"
            />
          </div>
        )}

        {/* the avatar, click to open */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={`Play ${name}'s review`}
          aria-expanded={open}
          className="group relative block h-14 w-14 overflow-hidden rounded-full border border-hair"
        >
          {video ? (
            <video
              src={video}
              poster={poster ?? undefined}
              autoPlay
              muted
              loop
              playsInline
              className="h-full w-full object-cover"
            />
          ) : poster ? (
            // eslint-disable-next-line @next/next/no-img-element -- static export
            <img src={poster} alt={name} className="h-full w-full object-cover" />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-full w-full items-center justify-center bg-card font-display font-semibold text-muted"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, rgba(252,192,0,0.12), rgba(0,204,0,0.12))",
              }}
            >
              {initial}
            </span>
          )}
          <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border border-canvas bg-gold text-canvas">
            <Play className="h-2.5 w-2.5" />
          </span>
        </button>
      </div>

      <div aria-hidden="true" className="h-12 w-px shrink-0 bg-hair" />
      <div>
        <p className="max-w-[var(--measure-body)] text-body leading-relaxed text-muted">
          {quote}
        </p>
        <p className="mt-2 font-mono text-label uppercase text-dim">
          {name} / {source}
        </p>
      </div>
    </div>
  );
}
