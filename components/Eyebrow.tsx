import type { ReactNode } from "react";

export type Accent = "gold" | "green" | "blue" | "muted";

const accentText: Record<Accent, string> = {
  gold: "text-gold",
  green: "text-green",
  blue: "text-blue",
  muted: "text-muted",
};

/* Mono spec-sheet label. The accent follows the section's lead accent. */
export function Eyebrow({
  children,
  accent = "muted",
  className = "",
}: {
  children: ReactNode;
  accent?: Accent;
  className?: string;
}) {
  return (
    <span
      className={`font-mono text-label uppercase ${accentText[accent]} ${className}`}
    >
      {children}
    </span>
  );
}
