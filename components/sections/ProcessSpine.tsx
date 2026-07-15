import { Reveal, RevealItem } from "@/components/Reveal";

/*
 * A process is a path, so it is drawn as one: a single spine with each
 * step hanging off it. The grid version numbered six identical boxes,
 * which made the order an annotation instead of a shape, and made a
 * sequence look exactly like a capability list.
 *
 * Asymmetric on purpose: narrow numbered rail, wide content.
 */
export function ProcessSpine({
  steps,
}: {
  steps: readonly { title: string; line: string }[];
}) {
  return (
    <Reveal className="relative">
      {/* the spine: one rule the whole run hangs from. Inset to the node
          centre, and stopped at the first and last node so it does not
          dangle past either end. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-8 left-[1.4375rem] top-8 w-px bg-hair"
      />
      <ol className="relative">
        {steps.map((step, i) => (
          /* `as="li"` so last:pb-0 means the last STEP, not every step:
             wrapped in a div each item is its own last child, and the
             run collapses to no spacing at all */
          <RevealItem
            as="li"
            key={step.title}
            className="flex gap-6 pb-10 last:pb-0 md:gap-8"
          >
            {/* node: sits on the spine and covers it */}
            <span
              aria-hidden="true"
              className="relative z-10 mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-hair bg-surface font-mono text-label font-semibold text-gold [font-variant-numeric:tabular-nums]"
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 pt-2.5">
              <h3 className="font-display text-h3 text-ink">{step.title}</h3>
              <p className="mt-2 max-w-[var(--measure-body)] text-body leading-relaxed text-muted">
                {step.line}
              </p>
            </div>
          </RevealItem>
        ))}
      </ol>
    </Reveal>
  );
}
