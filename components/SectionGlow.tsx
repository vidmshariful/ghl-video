/*
 * One ambient glow per section, behind the header, so transitions have
 * depth instead of hard black gaps. Intrinsic radial falloff (no blur
 * filter), so the gradient is already transparent wherever the parent
 * section clips it: no visible seams on the dark canvas. The parent
 * section must be `relative overflow-hidden`. Purely decorative.
 */

const accents = {
  gold: "rgba(252, 192, 0, 0.10)",
  green: "rgba(0, 204, 0, 0.10)",
  blue: "rgba(0, 144, 252, 0.08)",
} as const;

const positions = {
  left: "-left-56 -top-56",
  right: "-right-56 -top-56",
} as const;

export function SectionGlow({
  accent = "gold",
  position = "left",
}: {
  accent?: keyof typeof accents;
  position?: keyof typeof positions;
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute h-[36rem] w-[56rem] ${positions[position]}`}
      style={{
        background: `radial-gradient(closest-side, ${accents[accent]}, transparent 72%)`,
      }}
    />
  );
}
