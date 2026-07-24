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

/* Body buttons are a deep, restful fill (client direction): the bright
 * gold-to-green gradient was too light on the eye across the page. The nav
 * "Book a Call" and the library / Order Now buttons keep the gradient
 * (they are hand-rolled, not this component). `ghost` stays transparent. */
const deep =
  "border border-hair text-ink bg-[linear-gradient(180deg,#181b23,#0f1116)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-gold/50 hover:text-gold hover:bg-[linear-gradient(180deg,#1c2029,#12141a)]";

const variants: Record<Variant, string> = {
  primary: deep,
  hero: deep,
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

  /* no sheen: the deep body button stays understated (the bright sweep
     belonged to the gradient) */
  const sheen = null;

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
