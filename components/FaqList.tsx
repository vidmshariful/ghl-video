/*
 * FAQ cards, matched to the reference: each item is a bordered card with a
 * mono number badge, the question, and a circular arrow that flips on open.
 * An open card takes a green edge and a hairline separator between the
 * question and the answer. Native details/summary keeps it keyboard
 * accessible with no JS. Shared by the homepage and every service page.
 */
export function FaqList({
  items,
}: {
  items: readonly { q: string; a: string }[];
}) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        <details
          key={item.q}
          name="faq"
          className="group overflow-hidden rounded-[10px] border border-hair bg-surface transition-colors duration-300 open:border-green/40"
        >
          <summary className="flex cursor-pointer list-none items-center gap-4 p-5 md:gap-5 md:p-6 [&::-webkit-details-marker]:hidden">
            {/* number badge */}
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] border border-hair font-mono text-label text-dim md:h-10 md:w-10">
              {String(i + 1).padStart(2, "0")}
            </span>
            {/* question */}
            <span className="flex-1 font-display text-h4 font-semibold text-ink [text-wrap:balance]">
              {item.q}
            </span>
            {/* circular arrow, down closed, up open */}
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hair text-muted transition-colors duration-300 group-open:border-green group-open:text-green md:h-10 md:w-10">
              <svg
                viewBox="0 0 14 14"
                aria-hidden="true"
                className="h-3.5 w-3.5 transition-transform duration-300 group-open:rotate-180"
              >
                <path
                  d="M7 2.5v9M3 7.5 7 11.5 11 7.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </summary>
          {/* separator between question and answer, then the answer */}
          <div className="px-5 pb-6 md:px-6">
            <div className="border-t border-hair pt-5">
              <p className="max-w-[var(--measure-body)] text-body leading-relaxed text-muted">
                {item.a}
              </p>
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
