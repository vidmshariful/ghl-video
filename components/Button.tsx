import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "primary" | "solid" | "ghost";
type Size = "md" | "lg";

const variants: Record<Variant, string> = {
  /* gradient primary: near-black text on bright fill, inner top
     highlight for dimension, glow deepens on hover */
  primary:
    "bg-brand-gradient text-[#08090D] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-1px_0_rgba(0,0,0,0.15),0_0_28px_rgba(0,204,0,0.28)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(0,0,0,0.15),0_0_44px_rgba(0,204,0,0.45)] hover:brightness-[1.07]",
  solid: "bg-green text-[#08090D] hover:brightness-[1.08]",
  ghost:
    "border border-hair text-ink hover:border-blue/60 hover:text-blue bg-transparent",
};

const sizes: Record<Size, string> = {
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-[0.9375rem]",
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
  const cls = `inline-flex items-center justify-center gap-2 rounded-[3px] font-sans font-semibold transition-all duration-200 active:scale-[0.98] ${variants[variant]} ${sizes[size]} ${className}`;

  if (external) {
    return (
      <a href={href} className={cls} target="_blank" rel="noopener">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
