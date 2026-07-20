import { DrawnIcon, type IconName } from "@/components/DrawnIcon";
import { Reveal, RevealItem } from "@/components/Reveal";
/*
 * The ruled grid: one hairline mesh, solid canvas cells, no card
 * gradients. This is the blueprint answer to "three floating cards":
 * the structure is drawn with lines, each box is a cell. Cells carry a
 * stroke-drawn icon and, when the content is a real sequence, a mono
 * index.
 */
export function CellGrid({
  items,
  columns = 3,
  numbered = false,
  framed = true,
}: {
  items: readonly {
    icon?: IconName;
    title: string;
    line: string;
  }[];
  columns?: 2 | 3;
  numbered?: boolean;
  /* drop the own frame when the grid sits inside a RuledSection box */
  framed?: boolean;
}) {
  return (
    <Reveal
      className={`grid gap-px bg-hair sm:grid-cols-2 ${
        framed ? "overflow-hidden rounded-card border border-hair" : ""
      } ${columns === 3 ? "lg:grid-cols-3" : ""}`}
    >
      {items.map((item, i) => (
        <RevealItem key={item.title} className="h-full">
          <div
            data-cell
            className="group/cell flex h-full flex-col bg-canvas p-7 transition-colors duration-300 hover:bg-surface md:p-8"
          >
            <div className="flex items-start justify-between">
              {item.icon && <DrawnIcon name={item.icon} />}
              {numbered && (
                /* the index recedes to dim: the gold icon is the one
                   accent per cell, so the number no longer competes */
                <span className="font-mono text-label uppercase text-dim">
                  {String(i + 1).padStart(2, "0")}
                </span>
              )}
            </div>
            <h3 className="mt-5 font-display text-h4 font-semibold tracking-[-0.01em] text-ink">
              {item.title}
            </h3>
            <p className="mt-2 max-w-[var(--measure-body)] text-body leading-relaxed text-muted">
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
 * Left column ticks in gold, right column crosses in
 * dim. No card backgrounds; the line does the separating.
 */
export function FitSplit({
  forItems,
  notItems,
  framed = true,
}: {
  forItems: readonly string[];
  notItems: readonly string[];
  /* drop the own frame when the split sits inside a RuledSection box */
  framed?: boolean;
}) {
  return (
    <Reveal
      className={`grid gap-px bg-hair md:grid-cols-2 ${
        framed ? "overflow-hidden rounded-card border border-hair" : ""
      }`}
    >
      <RevealItem className="h-full">
        <div className="h-full bg-canvas p-7 md:p-8">
          <p className="font-mono text-label uppercase text-gold">Built for</p>
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
                    stroke="var(--gold)"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-body text-muted">{item}</span>
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
                <span className="text-body text-muted">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </RevealItem>
    </Reveal>
  );
}
