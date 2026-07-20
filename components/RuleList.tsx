import { Reveal } from "@/components/Reveal";

/*
 * The list form for spec-sheet content: ruled rows, a gold tick, an
 * optional bold lead-in, one quiet frame instead of a card per item.
 * Exists because stacking CellGrids made some pages read as walls of
 * cards; when the content is a flat list of facts, it should look like
 * one. Rows are plain li under one ul (never wrap li in a div: it is
 * invalid inside ul and breaks first:/last: selectors).
 */
export function RuleList({
  items,
  columns = 1,
  framed = true,
}: {
  items: readonly { title?: string; line: string }[];
  columns?: 1 | 2;
  framed?: boolean;
}) {
  return (
    <Reveal
      className={
        framed ? "rounded-card border border-hair card-glass px-7 py-3 md:px-8" : ""
      }
    >
      <ul
        className={`grid gap-x-12 ${columns === 2 ? "md:grid-cols-2" : ""}`}
      >
        {items.map((item) => (
          <li
            key={item.line}
            className={`flex items-start gap-3.5 border-t border-hair py-4 first:border-t-0 ${
              columns === 2 ? "md:[&:nth-child(2)]:border-t-0" : ""
            }`}
          >
            <svg
              viewBox="0 0 12 12"
              className="mt-1.5 h-3 w-3 shrink-0"
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
            <p className="text-body leading-relaxed text-muted">
              {item.title && (
                <span className="font-semibold text-ink">{item.title}. </span>
              )}
              {item.line}
            </p>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}
