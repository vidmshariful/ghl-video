import type { ReactNode } from "react";

/* Corner registration tick, the blueprint detail on major panels. */
function Tick({ pos }: { pos: string }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute ${pos} font-mono text-[0.625rem] leading-none text-dim/70`}
    >
      +
    </span>
  );
}

/*
 * Bounded section panel: hairline border, glass ground, corner ticks.
 * The page is built from these so nothing floats on a void.
 */
export function Panel({
  children,
  className = "",
  ticks = true,
}: {
  children: ReactNode;
  className?: string;
  ticks?: boolean;
}) {
  return (
    <div
      className={`relative rounded-card border border-hair card-glass ${className}`}
    >
      {ticks && (
        <>
          <Tick pos="-left-1 -top-1.5" />
          <Tick pos="-right-1 -top-1.5" />
          <Tick pos="-left-1 -bottom-1.5" />
          <Tick pos="-right-1 -bottom-1.5" />
        </>
      )}
      {children}
    </div>
  );
}
