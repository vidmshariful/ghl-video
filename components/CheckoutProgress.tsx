/*
 * The three-step order journey shown in the checkout header: Order -> Intake
 * -> Delivery. `active` is the current step index (0 = Order). Steps before it
 * read as done, the current one is highlighted, the rest are upcoming.
 * `compact` is the tight, single-line variant that lives in the header bar.
 */
const STEPS = [
  { key: "order", label: "Order", note: "Pay securely" },
  { key: "intake", label: "Intake", note: "Brand your videos" },
  { key: "delivery", label: "Delivery", note: "In 5 to 7 days" },
] as const;

function Check({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path
        d="M3.5 8.5l3 3 6-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function circle(done: boolean, current: boolean, size: string) {
  const base = `flex ${size} shrink-0 items-center justify-center rounded-full font-mono font-bold [font-variant-numeric:tabular-nums]`;
  if (done) return `${base} bg-brand-gradient text-canvas`;
  if (current)
    return `${base} border border-gold bg-gold/15 text-gold shadow-[0_0_16px_rgba(252,192,0,0.18)]`;
  return `${base} border border-hair text-dim`;
}

export function CheckoutProgress({
  active,
  compact = false,
}: {
  active: number;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <nav aria-label="Order progress" className="w-full">
        <ol className="flex w-full items-center">
          {STEPS.map((step, i) => {
            const done = i < active;
            const current = i === active;
            const last = i === STEPS.length - 1;
            return (
              <li
                key={step.key}
                className={`flex items-center ${last ? "" : "flex-1"}`}
              >
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <span className={circle(done, current, "h-6 w-6 text-[0.7rem]")}>
                    {done ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  <span
                    className={`hidden font-mono text-label uppercase tracking-[0.1em] sm:inline ${
                      done || current ? "text-ink" : "text-dim"
                    }`}
                  >
                    {step.label}
                  </span>
                </span>
                {!last && (
                  <span
                    aria-hidden="true"
                    className={`relative mx-3 h-px flex-1 ${done ? "bg-gold/50" : "bg-hair"}`}
                  >
                    {/* one light, handed off from the first connector to the
                        second at the midpoint of the shared cycle */}
                    <span
                      className={`${i === 0 ? "progress-glow-a" : "progress-glow-b"} pointer-events-none absolute left-0 right-0 top-1/2 h-[5px] -translate-y-1/2 blur-[1.5px] motion-reduce:hidden`}
                    />
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

  return (
    <nav aria-label="Order progress" className="mx-auto w-full max-w-2xl">
      <ol className="flex items-start">
        {STEPS.map((step, i) => {
          const done = i < active;
          const current = i === active;
          const last = i === STEPS.length - 1;
          return (
            <li key={step.key} className={`flex items-start ${last ? "" : "flex-1"}`}>
              <div className="flex flex-col items-center gap-2 text-center">
                <span className={circle(done, current, "h-9 w-9 text-body-sm")}>
                  {done ? <Check /> : i + 1}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span
                    className={`font-mono text-label uppercase tracking-[0.14em] ${
                      done || current ? "text-ink" : "text-dim"
                    }`}
                  >
                    {step.label}
                  </span>
                  <span
                    className={`text-[0.72rem] leading-tight ${current ? "text-muted" : "text-dim"}`}
                  >
                    {step.note}
                  </span>
                </span>
              </div>
              {!last && (
                <span
                  aria-hidden="true"
                  className={`mt-[18px] h-px flex-1 ${done ? "bg-gold/50" : "bg-hair"}`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
