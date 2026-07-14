import { Button } from "@/components/Button";
import { DrawnBorder } from "@/components/DrawnBorder";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionGlow } from "@/components/SectionGlow";
import { home, cta } from "@/lib/site";

/*
 * The problem statement, now a bounded panel on the grid instead of a
 * paragraph adrift in a void. Left: eyebrow, the sting with its key
 * phrase in gold, the CTA. Right: a quiet Loom-vs-branded contrast so
 * the claim carries proof, not just volume.
 */
export function Manifesto() {
  const { manifesto } = home;
  const idx = manifesto.statement.indexOf(manifesto.emphasis);
  const before = idx >= 0 ? manifesto.statement.slice(0, idx) : manifesto.statement;
  const after = idx >= 0 ? manifesto.statement.slice(idx + manifesto.emphasis.length) : "";

  return (
    <section className="relative overflow-x-clip">
      <DrawnBorder />
      <SectionGlow accent="gold" position="right" />
      <div className="shell relative py-16 md:py-20">
        <Reveal>
          <RevealItem>
            <div className="grid overflow-hidden rounded-card border border-hair bg-canvas lg:grid-cols-[1.6fr_1fr]">
              {/* the sting */}
              <div className="p-8 md:p-12 lg:p-14">
                <p className="font-mono text-label uppercase text-gold">
                  [ {manifesto.eyebrow} ]
                </p>
                <p className="mt-6 max-w-[26ch] font-display text-[clamp(1.5rem,2.9vw,2.375rem)] font-semibold leading-[1.18] tracking-tight text-ink">
                  {before}
                  {idx >= 0 && (
                    <span className="text-gold">{manifesto.emphasis}</span>
                  )}
                  {after}
                </p>
                <div className="mt-9">
                  <Button href={cta.bookACall.href} variant="primary">
                    {cta.bookACall.label}
                  </Button>
                </div>
              </div>

              {/* the quiet contrast: two cells split the column height */}
              <div className="flex flex-col gap-px bg-hair lg:border-l lg:border-hair">
                <div className="flex flex-1 flex-col justify-center bg-canvas p-8 md:p-10">
                  <p className="font-mono text-label uppercase text-dim">
                    What they see now
                  </p>
                  <p className="mt-3 flex items-baseline gap-2.5 text-[0.9375rem] text-muted">
                    <span aria-hidden="true" className="font-mono text-dim">
                      &times;
                    </span>
                    {manifesto.contrast.bad}
                  </p>
                </div>
                <div className="flex flex-1 flex-col justify-center bg-canvas p-8 md:p-10">
                  <p className="font-mono text-label uppercase text-green">
                    What they could see
                  </p>
                  <p className="mt-3 flex items-baseline gap-2.5 text-[0.9375rem] font-medium text-ink">
                    <svg
                      viewBox="0 0 12 12"
                      className="h-3 w-3 shrink-0 translate-y-[0.15em]"
                      aria-hidden="true"
                    >
                      <path
                        d="M2 6.2 4.8 9 10 3.4"
                        fill="none"
                        stroke="#00CC00"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {manifesto.contrast.good}
                  </p>
                </div>
              </div>
            </div>
          </RevealItem>
        </Reveal>
      </div>
    </section>
  );
}
