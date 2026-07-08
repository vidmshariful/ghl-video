const tickColors = {
  gold: "#FCC000",
  green: "#00CC00",
  blue: "#0090FC",
} as const;

/* Checklist rows: the check is functional (a claim ticked off), not
 * icon decoration. Tick color follows the section's accent. */
export function Checklist({
  items,
  accent = "green",
  className = "",
}: {
  items: readonly string[];
  accent?: keyof typeof tickColors;
  className?: string;
}) {
  return (
    <ul className={className}>
      {items.map((item) => (
        <li
          key={item}
          className="flex items-center gap-3 border-t border-hair py-3 first:border-t-0"
        >
          <svg
            viewBox="0 0 12 12"
            className="h-3 w-3 shrink-0"
            aria-hidden="true"
          >
            <path
              d="M2 6.2 4.8 9 10 3.4"
              fill="none"
              stroke={tickColors[accent]}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-sm text-muted">{item}</span>
        </li>
      ))}
    </ul>
  );
}
