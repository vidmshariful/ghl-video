import { Reveal, RevealItem } from "@/components/Reveal";

/*
 * Hook, story, conversion are not three features, they are three
 * positions on one timeline. So the section is a scrubber: the beats sit
 * on a track and the reader sees the arc, which is the argument.
 *
 * The gradient earns its fourth and last use here, because left-to-right
 * IS the thing being described. Anywhere it does not mean progression it
 * stays off.
 */
export function Filmstrip({
  items,
}: {
  items: readonly { title: string; line: string }[];
}) {
  return (
    <Reveal className="relative">
      {/* the track: desktop only. Stacked on mobile there is no
          left-to-right to describe, so the metaphor is dropped rather
          than rotated into something it is not. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 right-0 top-[0.4375rem] hidden h-px bg-brand-gradient opacity-60 md:block"
      />
      <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
        {items.map((item, i) => (
          /* `as="li"` so the beat is a real child of the list and a real
             grid item, rather than a div smuggled between <ol> and <li> */
          <RevealItem as="li" key={item.title} className="relative">
            <div className="flex items-center gap-3 md:block">
                {/* playhead */}
                <span
                  aria-hidden="true"
                  className="relative z-10 block h-3.5 w-3.5 shrink-0 rounded-full border-2 border-gold bg-canvas"
                />
                <span className="font-mono text-label uppercase text-dim md:mt-5 md:block">
                  Beat {String(i + 1).padStart(2, "0")}
                </span>
              </div>
            <h3 className="mt-4 font-display text-h3 text-ink md:mt-2">
              {item.title}
            </h3>
            <p className="mt-2 max-w-[var(--measure-body)] text-body leading-relaxed text-muted">
              {item.line}
            </p>
          </RevealItem>
        ))}
      </ol>
    </Reveal>
  );
}
