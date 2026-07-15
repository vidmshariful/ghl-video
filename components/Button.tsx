import Link from "next/link";
import type { ReactNode } from "react";

/*
 * One button system (client direction, July 2026):
 * - `primary` is the gold-to-green GRADIENT. The gradient is the
 *   signature, so it is the one and only primary button style. `hero`
 *   is kept as an alias so existing call sites still work.
 * - `ghost` is the quiet secondary.
 */
type Variant = "primary" | "hero" | "ghost";
type Size = "md" | "lg";

const gradient =
  "bg-brand-gradient text-[#08090D] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-1px_0_rgba(0,0,0,0.15),0_0_28px_rgba(0,204,0,0.28)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(0,0,0,0.15),0_0_44px_rgba(0,204,0,0.45)] hover:brightness-[1.07]";

const variants: Record<Variant, string> = {
  primary: gradient,
  hero: gradient,
  ghost:
    "border border-hair text-ink hover:border-gold/60 hover:text-gold bg-transparent",
};

const sizes: Record<Size, string> = {
  md: "px-6 py-3 text-body",
  lg: "px-10 py-[18px] text-body",
};

export function Button({
  href,
  variant = "primary",
  size = "lg",
  children,
  external = false,
  className = "",
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  external?: boolean;
  className?: string;
}) {
  /* 3px corners: buttons sit square in the blueprint grid */
  const cls = `group relative inline-flex items-center justify-center gap-2.5 overflow-hidden whitespace-nowrap max-sm:w-full rounded-[3px] font-sans font-semibold transition-all duration-200 active:scale-[0.98] ${variants[variant]} ${sizes[size]} ${className}`;

  /* every button carries the arrow */
  const arrow = (
    <span
      aria-hidden="true"
      className="transition-transform duration-200 group-hover:translate-x-0.5"
    >
      &rarr;
    </span>
  );

  /* the sheen sweep rides the gradient (every non-ghost button) */
  const sheen =
    variant !== "ghost" ? (
      <span
        aria-hidden="true"
        className="btn-sheen pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
    ) : null;

  if (external) {
    return (
      <a href={href} className={cls} target="_blank" rel="noopener">
        {sheen}
        {children}
        {arrow}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {sheen}
      {children}
      {arrow}
    </Link>
  );
}
