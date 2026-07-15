/*
 * One ambient glow per section, behind the header, so transitions have
 * depth instead of hard black gaps. Intrinsic radial falloff (no blur
 * filter), so the gradient is already transparent wherever the parent
 * section clips it: no visible seams on the dark canvas. The parent
 * section must be `relative overflow-hidden`. Purely decorative.
 */

const positions = {
  left: "-left-56 -top-56",
  right: "-right-56 -top-56",
} as const;

export function SectionGlow({
  position = "left",
}: {
  position?: keyof typeof positions;
}) {
  return (
    <div
      aria-hidden="true"
      className={`section-glow pointer-events-none absolute h-[36rem] w-[56rem] ${positions[position]}`}
      style={{
        background: `radial-gradient(closest-side, var(--glow-gold), transparent 72%)`,
      }}
    />
  );
}
