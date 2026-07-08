import type { ReactNode } from "react";

/*
 * Slow logo marquee, pure CSS. Content is duplicated once for the loop;
 * the clone is aria-hidden. Pauses on hover, static under
 * prefers-reduced-motion (see globals.css).
 */
export function Marquee({ children }: { children: ReactNode }) {
  return (
    <div className="marquee relative overflow-hidden">
      <div className="marquee-track flex w-max items-center gap-14 pr-14">
        <div className="flex items-center gap-14">{children}</div>
        <div className="flex items-center gap-14" aria-hidden="true">
          {children}
        </div>
      </div>
      {/* edge fades so marks enter and exit softly */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-canvas to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-canvas to-transparent" />
    </div>
  );
}
