export type ChipAccent = "gold" | "green" | "blue";

const accents: Record<ChipAccent, string> = {
  gold: "text-gold",
  green: "text-green",
  blue: "text-blue",
};

/*
 * Bracketed section index chip: wayfinding through the page, a real
 * sequence, so the numbering carries information. Mono, quiet, always
 * paired with the section label.
 */
export function SectionChip({
  index,
  label,
  accent = "gold",
}: {
  index: number;
  label: string;
  accent?: ChipAccent;
}) {
  return (
    <p className="inline-flex items-center gap-3 rounded-full border border-hair bg-surface px-4 py-2 font-mono text-label uppercase">
      <span className="text-dim">
        [ <span className={accents[accent]}>{String(index).padStart(2, "0")}</span> ]
      </span>
      <span className="text-muted">{label}</span>
    </p>
  );
}
