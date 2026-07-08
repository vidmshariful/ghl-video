/*
 * One ambient glow per section, behind the header, so transitions have
 * depth instead of hard black gaps. The parent section must be
 * `relative overflow-hidden`. Purely decorative.
 */

const accents = {
  gold: "bg-gold",
  green: "bg-green",
  blue: "bg-blue",
} as const;

const positions = {
  left: "-left-40 -top-48",
  right: "-right-40 -top-48",
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
      className={`pointer-events-none absolute h-[30rem] w-[42rem] rounded-full opacity-[0.055] blur-[130px] ${accents[accent]} ${positions[position]}`}
    />
  );
}
