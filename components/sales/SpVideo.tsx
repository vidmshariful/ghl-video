"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

function PlayIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M8 5v14l11-7z" fill="#07080b" />
    </svg>
  );
}

/*
 * Sales-system video: muted autoplay loop in view, click opens a centered
 * lightbox that plays from the start with sound. A null src renders a clean
 * placeholder (real clip not delivered yet). Scoped to the .sp system.
 */
export function SpVideo({
  src,
  poster,
  label = "video",
  placeholder = "Video coming",
  wistiaId = null,
}: {
  src: string | null;
  poster: string | null;
  label?: string;
  placeholder?: string;
  /* a Wistia-hosted classic video: show the poster, play in the lightbox */
  wistiaId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [inView, setInView] = useState(false);
  const figRef = useRef<HTMLDivElement>(null);
  const vidRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = figRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), {
      threshold: 0.25,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const v = vidRef.current;
    if (!v) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (inView && !open && !reduce) v.play().catch(() => {});
    else v.pause();
  }, [inView, open]);

  if (!src && !wistiaId) {
    return (
      <div ref={figRef} className="sp-video sp-video--placeholder">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element -- local poster
          <img src={poster} alt="" />
        ) : null}
        <span className="sp-pill" style={{ position: "relative", zIndex: 1 }}>
          {placeholder}
        </span>
      </div>
    );
  }

  return (
    <>
      <div ref={figRef} className="sp-video">
        {src ? (
          <video ref={vidRef} src={src} poster={poster ?? undefined} muted loop playsInline preload="none" />
        ) : poster ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote wistia poster
          <img src={poster} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : null}
        <button type="button" className="sp-play" aria-label={`Play ${label}`} onClick={() => setOpen(true)}>
          <span>
            <PlayIcon />
          </span>
        </button>
      </div>
      {open ? (
        <Lightbox src={src} wistiaId={wistiaId} poster={poster} label={label} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function Lightbox({
  src,
  wistiaId,
  poster,
  label,
  onClose,
}: {
  src: string | null;
  wistiaId?: string | null;
  poster: string | null;
  label: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const vidRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    document.documentElement.style.overflow = "hidden";
    vidRef.current?.play().catch(() => {});
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
      aria-label={label}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(1rem, 4vw, 3rem)",
        background: "rgba(4,5,8,0.9)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div style={{ position: "relative", width: "100%", maxWidth: "1000px" }} onClick={(e) => e.stopPropagation()}>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close video"
          className="sp-btn sp-btn--ghost sp-btn--sm"
          style={{ position: "absolute", top: "-3rem", right: 0 }}
        >
          Close
        </button>
        {src ? (
          <video
            ref={vidRef}
            src={src}
            poster={poster ?? undefined}
            controls
            playsInline
            style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.15)", background: "#000" }}
          />
        ) : wistiaId ? (
          <iframe
            src={`https://fast.wistia.net/embed/iframe/${wistiaId}?autoPlay=true`}
            title={label}
            allow="autoplay; fullscreen"
            allowFullScreen
            style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.15)", background: "#000" }}
          />
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
