import Link from "next/link";
import { DrawnBorder } from "@/components/DrawnBorder";
import { Button } from "@/components/Button";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionChip } from "@/components/SectionChip";
import { SectionGlow } from "@/components/SectionGlow";
import { home, cta } from "@/lib/site";

/*
 * Closing band, now one bounded object on the grid. Pitch and primary
 * action left; the after-you-book sequence as a ruled 3-cell column on
 * the right. No empty quadrant, the CTA dominates. The accent word is
 * solid gold: the gradient-word moment belongs to the hero alone.
 */
export function ClosingCta() {
  return (
    <section
      data-bp-idx="10"
      aria-labelledby="closing-heading"
      className="relative overflow-x-clip section-pad"
    >
      <DrawnBorder />
      <SectionGlow accent="green" position="right" />
      <div className="shell relative">
        <Reveal>
          <RevealItem>
            <div className="grid overflow-hidden rounded-card border border-hair bg-canvas lg:grid-cols-[1.4fr_1fr]">
              {/* the pitch */}
              <div className="p-8 md:p-12 lg:p-14">
                <SectionChip index={10} label="Next step" accent="green" />
                <h2
                  id="closing-heading"
                  className="mt-6 max-w-[16ch] font-display text-h2 text-ink"
                >
                  {home.closing.headline}{" "}
                  <span className="text-gold">{home.closing.accent}</span>
                </h2>
                <p className="mt-5 max-w-[var(--measure-lede)] text-lede text-muted">
                  {home.closing.lede}
                </p>
                <div className="mt-9 flex flex-wrap gap-4">
                  <Button href={cta.bookACall.href} variant="primary">
                    {cta.bookACall.label}
                  </Button>
                  <Button href={cta.seePremade.href} variant="ghost">
                    {cta.seePremade.label}
                  </Button>
                </div>
                <p className="mt-8 border-t border-hair pt-6 text-body text-muted">
                  Publishing weekly?{" "}
                  <Link
                    href="/editing/"
                    className="group inline-flex items-center gap-1.5 font-semibold text-gold"
                  >
                    See video editing
                    <span
                      aria-hidden="true"
                      className="transition-transform duration-200 group-hover:translate-x-1"
                    >
                      &rarr;
                    </span>
                  </Link>
                </p>
              </div>

              {/* what happens after you book: a ruled sequence */}
              <ol className="flex flex-col gap-px bg-hair lg:border-l lg:border-hair">
                {home.closing.steps.map((step, i) => (
                  <li
                    key={step.title}
                    className="flex flex-1 items-start gap-4 bg-canvas p-6 md:p-8"
                  >
                    <span className="pt-0.5 font-mono text-label uppercase text-gold [font-variant-numeric:tabular-nums]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className="font-display text-h4 font-semibold text-ink">
                        {step.title}
                      </p>
                      <p className="mt-1 text-body text-muted">{step.line}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </RevealItem>
        </Reveal>
      </div>
    </section>
  );
}
