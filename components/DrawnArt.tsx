"use client";

import { useEffect, useId, useRef, useState } from "react";

/*
 * DrawnArt: a richer, larger cousin of DrawnIcon. Where DrawnIcon is a
 * single stroked glyph, each art here is a small composed line-art SCENE
 * that self-draws on scroll (and redraws on cell hover), stroked with the
 * gold-to-green brand gradient so the upgraded cells read as a deliberate
 * graphic, not another icon. These are PLACEHOLDERS: swap the path sets
 * for final illustrations without touching the draw mechanism. Reduced
 * motion renders each scene fully drawn.
 */
const arts = {
  /* HOOK: the first frame catches the eye. A viewfinder + play + marks. */
  hook: (
    <>
      <rect x="10" y="16" width="44" height="30" rx="4" />
      <path d="M28 25 L39 32 L28 39 Z" />
      <path d="M10 11 L10 7 M54 11 L54 7" />
    </>
  ),
  /* STORY: one argument, start to finish. A path with three beats. */
  story: (
    <>
      <path d="M9 46 C22 46 24 21 34 21 C44 21 44 42 55 42" />
      <circle cx="9" cy="46" r="3" />
      <circle cx="34" cy="21" r="3" />
      <circle cx="55" cy="42" r="3" />
    </>
  ),
  /* CONVERSION: every cut ends on one action. An arrow into a bullseye. */
  conversion: (
    <>
      <circle cx="42" cy="32" r="15" />
      <circle cx="42" cy="32" r="6" />
      <path d="M8 32 L35 32" />
      <path d="M28 25 L35 32 L28 39" />
    </>
  ),
} as const;

export type ArtName = keyof typeof arts;

export function DrawnArt({ name, size = 60 }: { name: ArtName; size?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [drawn, setDrawn] = useState(false);
  const gid = `art-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.querySelectorAll("path, line, polyline, polygon, circle, rect").forEach(
      (shape) => shape.setAttribute("pathLength", "1"),
    );

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDrawn(true);
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setDrawn(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);

    const cell = el.closest("[data-cell]");
    const replay = () => {
      setDrawn(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    };
    cell?.addEventListener("mouseenter", replay);
    return () => {
      io.disconnect();
      cell?.removeEventListener("mouseenter", replay);
    };
  }, []);

  return (
    <span
      ref={ref}
      className="drawn-icon inline-flex"
      style={{ "--dash": drawn ? 0 : 1 } as React.CSSProperties}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        stroke={`url(#${gid})`}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--gold)" />
            <stop offset="1" stopColor="var(--green)" />
          </linearGradient>
        </defs>
        {arts[name]}
      </svg>
    </span>
  );
}
