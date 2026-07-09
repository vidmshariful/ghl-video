import { Reveal, RevealItem } from "@/components/Reveal";
import type { ChipAccent } from "@/components/SectionChip";

const accentText: Record<ChipAccent, string> = {
  gold: "text-gold",
  green: "text-green",
  blue: "text-blue",
};

/*
 * Numbered step rail for real sequences (a process the buyer walks
 * through in order, so the numbers carry information). Hairline-topped
 * columns, mono index in the section accent.
 */
export function StepFlow({
  steps,
  accent = "gold",
  columns = 3,
}: {
  steps: readonly { title: string; line: string }[];
  accent?: ChipAccent;
  columns?: 2 | 3;
}) {
  return (
    <Reveal
      className={`grid gap-x-8 gap-y-10 sm:grid-cols-2 ${
        columns === 3 ? "lg:grid-cols-3" : ""
      }`}
    >
      {steps.map((s, i) => (
        <RevealItem key={s.title} className="border-t border-hair pt-5">
          <span
            className={`font-mono text-label uppercase ${accentText[accent]}`}
          >
            {String(i + 1).padStart(2, "0")}
          </span>
          <h3 className="mt-3 font-display text-h3 text-ink">{s.title}</h3>
          <p className="mt-2 max-w-[36ch] text-[0.9375rem] leading-relaxed text-muted">
            {s.line}
          </p>
        </RevealItem>
      ))}
    </Reveal>
  );
}
