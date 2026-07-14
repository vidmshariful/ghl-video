import Link from "next/link";
import type { ReactNode } from "react";

/*
 * Color discipline (see the color review):
 * - `primary` is SOLID GREEN. Green is the action color, so this is
 *   every repeat and utility CTA across the site. The button is always
 *   learnable because it always looks the same.
 * - `hero` is the gold-to-green GRADIENT. Rationed to one per page: the
 *   single most important conversion. That rarity keeps the gradient a
 *   signature instead of a default.
 * - `ghost` is the quiet secondary.
 */
type Variant = "primary" | "hero" | "ghost";
type Size = "md" | "lg";

const variants: Record<Variant, string> = {
  /* solid green: the everyday primary action */
  primary:
    "bg-green text-[#08090D] shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_0_24px_rgba(0,204,0,0.2)] hover:brightness-110",
  /* the signature gradient: one hero-tier conversion per page */
  hero: "bg-brand-gradient text-[#08090D] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-1px_0_rgba(0,0,0,0.15),0_0_28px_rgba(0,204,0,0.28)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(0,0,0,0.15),0_0_44px_rgba(0,204,0,0.45)] hover:brightness-[1.07]",
  ghost:
    "border border-hair text-ink hover:border-blue/60 hover:text-blue bg-transparent",
};

const sizes: Record<Size, string> = {
  md: "px-6 py-3 text-sm",
  lg: "px-10 py-[18px] text-[1rem]",
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

  /* the sheen sweep belongs to the gradient hero button only */
  const sheen =
    variant === "hero" ? (
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
