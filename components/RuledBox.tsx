import type { ReactNode } from "react";

/*
 * A square hairline box, the site's blueprint container: its top and bottom
 * rules run the full viewport width, and the blueprint hatch fills the narrow
 * gutters out to the page-frame rails. Sits inside a `shell`. Put gap-px
 * bg-hair grids of bg-canvas cells inside it, never floating cards.
 */
export function RuledBox({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative border border-hair ${className}`}>
      <span
        aria-hidden="true"
        className="absolute -top-px left-1/2 -z-10 h-px w-screen -translate-x-1/2 bg-hair"
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-px left-1/2 -z-10 h-px w-screen -translate-x-1/2 bg-hair"
      />
      <span
        aria-hidden="true"
        className="hatch pointer-events-none absolute inset-y-0 right-full mr-px w-[var(--rail-gutter)]"
      />
      <span
        aria-hidden="true"
        className="hatch pointer-events-none absolute inset-y-0 left-full ml-px w-[var(--rail-gutter)]"
      />
      {children}
    </div>
  );
}
