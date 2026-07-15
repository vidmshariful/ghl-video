import { Reveal, RevealItem } from "@/components/Reveal";

/*
 * For the beats that are an argument, not a spec sheet. A cost the
 * reader is already paying does not land as three tidy boxes of body
 * copy; it lands as type.
 *
 * The spacing is the whole trick, and it is easy to get backwards. The
 * gap inside a point (headline to its own line) must be clearly smaller
 * than the gap between points, or proximity groups each line with the
 * NEXT headline and the reader cannot tell which line explains which.
 * Display type at line-height 1 makes this worse than it reads in the
 * markup, because the ascenders eat the visual gap.
 *
 * This is the page's one deliberate break from the grid, so it should
 * appear once per page at most. Two of these and it is a pattern again.
 */
export function EditorialPoints({
  items,
}: {
  items: readonly { title: string; line: string }[];
}) {
  return (
    <Reveal as="ul">
      {items.map((item, i) => (
        /* `as="li"` so the item is a real child of the list: wrapped in a
           div, every item is its own first AND last child, and
           first:/last: would zero the padding on all of them */
        <RevealItem
          as="li"
          key={item.title}
          className="grid gap-x-8 gap-y-4 border-t border-hair py-12 first:border-t-0 first:pt-0 last:pb-0 md:grid-cols-[5rem_1fr] md:gap-x-12 md:py-16"
        >
          <span
            aria-hidden="true"
            className="font-mono text-label uppercase text-dim [font-variant-numeric:tabular-nums] md:pt-3"
          >
            [ {String(i + 1).padStart(2, "0")} ]
          </span>
          <div>
            <h3 className="max-w-[18ch] font-display text-h2 text-ink">
              {item.title}
            </h3>
            {/* aligned to its headline, not indented away from it */}
            <p className="mt-4 max-w-[52ch] text-lede leading-relaxed text-muted">
              {item.line}
            </p>
          </div>
        </RevealItem>
      ))}
    </Reveal>
  );
}
