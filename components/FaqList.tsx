/*
 * Flat FAQ rows: hairline separators, rotating chevron, native
 * details/summary for keyboard access. Shared by the homepage and
 * every service page.
 */
export function FaqList({
  items,
}: {
  items: readonly { q: string; a: string }[];
}) {
  return (
    <div>
      {items.map((item) => (
        <details
          key={item.q}
          className="group border-b border-hair first:border-t"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-7 [&::-webkit-details-marker]:hidden">
            <span className="font-display text-[1.1875rem] font-semibold text-ink [text-wrap:balance]">
              {item.q}
            </span>
            <svg
              viewBox="0 0 12 7"
              aria-hidden="true"
              className="h-2 w-3.5 shrink-0 transition-transform duration-300 group-open:rotate-180"
            >
              <path
                d="M1 1l5 5 5-5"
                fill="none"
                stroke="#9096A8"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </summary>
          <p className="max-w-[68ch] pb-7 text-[0.9375rem] leading-relaxed text-muted">
            {item.a}
          </p>
        </details>
      ))}
    </div>
  );
}
