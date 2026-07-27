"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/*
 * The homepage hero showreel. The Wistia thumbnail fills the hero
 * panel (graded to match the ambient MediaFrame look it replaced), with
 * a gold play button; clicking opens the real Wistia player with sound
 * in a lightbox. Same embed and lightbox shape as the library's Wistia
 * videos (components/premade/cards.tsx), so behaviour stays consistent.
 */
export function HeroShowreel({
  wistiaId,
  poster,
  title,
  label,
}: {
  wistiaId: string;
  poster: string;
  title: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Play ${title}`}
        aria-haspopup="dialog"
        className="group/hs absolute inset-3 overflow-hidden rounded-[12px] border border-hair bg-[#030303] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={poster}
          alt=""
          className="absolute inset-0 h-full w-full object-cover brightness-[0.82] saturate-[0.85] transition-transform duration-700 group-hover/hs:scale-[1.03]"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-canvas/35 transition-colors duration-500 group-hover/hs:bg-canvas/20"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-brand-gradient text-canvas shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_44px_rgba(0,204,0,0.35)] transition-transform duration-300 group-hover/hs:scale-105">
            <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
        <span className="absolute bottom-3 left-3 rounded-[3px] border border-hair/60 bg-canvas/70 px-2.5 py-1 font-mono text-label uppercase tracking-[0.1em] text-muted backdrop-blur-sm">
          {label}
        </span>
      </button>
      {open ? (
        <Lightbox wistiaId={wistiaId} title={title} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function Lightbox({
  wistiaId,
  title,
  onClose,
}: {
  wistiaId: string;
  title: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-canvas/90 p-4 backdrop-blur-md md:p-12"
    >
      <div className="relative w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close video"
          className="absolute -top-12 right-0 flex h-10 w-10 items-center justify-center rounded-[3px] border border-hair bg-[#111219] text-ink transition-colors hover:border-gold"
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
        <div className="aspect-video w-full overflow-hidden border border-hair bg-black">
          <iframe
            src={`https://fast.wistia.net/embed/iframe/${wistiaId}?autoPlay=true&playerColor=FCC000`}
            title={title}
            allow="autoplay; fullscreen"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
