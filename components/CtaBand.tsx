import { Button } from "@/components/Button";
import { Reveal, RevealItem } from "@/components/Reveal";

/*
 * The one closing band, identical on every page that sells (client
 * model, July 2026): heading, subtext, one gradient button, inside a
 * bounded panel that carries the brand gradient and the hero's grain.
 * Nothing else lives here: no chips, no step lists, no second button.
 * The accent word stays solid gold; the gradient-word moment belongs
 * to the hero alone.
 */
export function CtaBand({
  bpIdx,
  headline,
  accent,
  sub,
  cta,
}: {
  bpIdx: number;
  headline: string;
  accent: string;
  sub: string;
  cta: { label: string; href: string };
}) {
  return (
    <section
      data-bp-idx={bpIdx}
      aria-labelledby="cta-band-heading"
      className="relative overflow-x-clip section-pad"
    >
      <div className="shell">
        <Reveal>
          <RevealItem>
            <div
              className="relative overflow-hidden rounded-card border border-hair px-6 py-16 text-center md:px-10 md:py-24"
              style={{
                background:
                  "linear-gradient(135deg, rgba(252,192,0,0.16) 0%, rgba(252,192,0,0.04) 32%, rgba(8,9,13,0) 60%), linear-gradient(315deg, rgba(0,204,0,0.10) 0%, rgba(0,204,0,0.02) 30%, rgba(8,9,13,0) 55%), var(--surface)",
              }}
            >
              {/* the hero's film grain, over the gradient */}
              <span
                aria-hidden="true"
                className="grunge pointer-events-none absolute inset-0"
              />
              <div className="relative">
                <h2
                  id="cta-band-heading"
                  className="mx-auto max-w-[22ch] font-display text-h2 text-ink"
                >
                  {headline} <span className="text-gold">{accent}</span>
                </h2>
                <p className="mx-auto mt-5 max-w-[var(--measure-lede)] text-lede text-muted">
                  {sub}
                </p>
                <div className="mt-9">
                  <Button href={cta.href} variant="gradient">
                    {cta.label}
                  </Button>
                </div>
              </div>
            </div>
          </RevealItem>
        </Reveal>
      </div>
    </section>
  );
}
