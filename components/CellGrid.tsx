import { DrawnIcon, type IconName } from "@/components/DrawnIcon";
import { Reveal, RevealItem } from "@/components/Reveal";
import type { ChipAccent } from "@/components/SectionChip";

const accentText: Record<ChipAccent, string> = {
  gold: "text-gold",
  green: "text-gold",
  blue: "text-gold",
};

/*
 * The ruled grid: one hairline mesh, solid canvas cells, no card
 * gradients. This is the blueprint answer to "three floating cards":
 * the structure is drawn with lines, each box is a cell. Cells carry a
 * stroke-drawn icon and, when the content is a real sequence, a mono
 * index.
 */
export function CellGrid({
  items,
  accent = "gold",
  columns = 3,
  numbered = false,
}: {
  items: readonly {
    icon?: IconName;
    title: string;
    line: string;
  }[];
  accent?: ChipAccent;
  columns?: 2 | 3;
  numbered?: boolean;
}) {
  return (
    <Reveal
      className={`grid gap-px overflow-hidden rounded-card border border-hair bg-hair sm:grid-cols-2 ${
        columns === 3 ? "lg:grid-cols-3" : ""
      }`}
    >
      {items.map((item, i) => (
        <RevealItem key={item.title} className="h-full">
          <div
            data-cell
            className="group/cell flex h-full flex-col bg-canvas p-7 transition-colors duration-300 hover:bg-surface md:p-8"
          >
            <div className="flex items-start justify-between">
              {item.icon && <DrawnIcon name={item.icon} accent={accent} />}
              {numbered && (
                <span
                  className={`font-mono text-label uppercase ${accentText[accent]}`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
              )}
            </div>
            <h3 className="mt-5 font-display text-[1.1875rem] font-semibold tracking-[-0.01em] text-ink">
              {item.title}
            </h3>
            <p className="mt-2 max-w-[38ch] text-[0.9375rem] leading-relaxed text-muted">
              {item.line}
            </p>
          </div>
        </RevealItem>
      ))}
    </Reveal>
  );
}

/*
 * Fit split: one ruled frame, two columns sharing a center hairline.
 * Left column ticks in the section accent, right column crosses in
 * dim. No card backgrounds; the line does the separating.
 */
export function FitSplit({
  forItems,
  notItems,
  accent = "green",
}: {
  forItems: readonly string[];
  notItems: readonly string[];
  accent?: ChipAccent;
}) {
  const tickColor = "#FCC000";
  void accent;
  return (
    <Reveal className="grid gap-px overflow-hidden rounded-card border border-hair bg-hair md:grid-cols-2">
      <RevealItem className="h-full">
        <div className="h-full bg-canvas p-7 md:p-8">
          <p className={`font-mono text-label uppercase ${accentText[accent]}`}>
            Built for
          </p>
          <ul className="mt-5">
            {forItems.map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 border-t border-hair py-3.5 first:border-t-0"
              >
                <svg
                  viewBox="0 0 12 12"
                  className="h-3 w-3 shrink-0"
                  aria-hidden="true"
                >
                  <path
                    d="M2 6.2 4.8 9 10 3.4"
                    fill="none"
                    stroke={tickColor}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-[0.9375rem] text-muted">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </RevealItem>
      <RevealItem className="h-full">
        <div className="h-full bg-canvas p-7 md:p-8">
          <p className="font-mono text-label uppercase text-dim">Not for</p>
          <ul className="mt-5">
            {notItems.map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 border-t border-hair py-3.5 first:border-t-0"
              >
                <span aria-hidden="true" className="font-mono text-dim">
                  &times;
                </span>
                <span className="text-[0.9375rem] text-muted">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </RevealItem>
    </Reveal>
  );
}
