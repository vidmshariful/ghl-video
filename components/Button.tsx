import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "primary" | "solid" | "ghost";
type Size = "md" | "lg";

const variants: Record<Variant, string> = {
  /* gradient primary: near-black text on bright fill, per the brief */
  primary:
    "bg-brand-gradient text-[#08090D] shadow-[0_0_28px_rgba(0,204,0,0.28)] hover:shadow-[0_0_40px_rgba(0,204,0,0.42)] hover:brightness-[1.06]",
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
  const cls = `inline-flex items-center justify-center gap-2 rounded-full font-sans font-semibold transition-all duration-200 active:scale-[0.98] ${variants[variant]} ${sizes[size]} ${className}`;

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
