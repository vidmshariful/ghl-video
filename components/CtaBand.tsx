import { Button } from "@/components/Button";
import { Reveal, RevealItem } from "@/components/Reveal";

/*
 * The one closing band, identical on every page that sells (client
 * model, July 2026): heading, subtext, one gradient button. No card,
 * no inner panel, no border of its own: the SECTION is the surface,
 * carrying the brand gradient and the hero's grain edge to edge, from
 * the section's top rule to the footer's. The accent word stays solid
 * gold; the gradient-word moment belongs to the hero alone.
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
      style={{
        background:
          "linear-gradient(135deg, rgba(252,192,0,0.14) 0%, rgba(252,192,0,0.04) 34%, rgba(8,9,13,0) 62%), linear-gradient(315deg, rgba(0,204,0,0.09) 0%, rgba(0,204,0,0.02) 30%, rgba(8,9,13,0) 55%), var(--surface)",
      }}
    >
      {/* the hero's film grain, over the gradient */}
      <span
        aria-hidden="true"
        className="grunge pointer-events-none absolute inset-0"
      />
      <div className="shell relative text-center">
        <Reveal>
          <RevealItem>
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
          </RevealItem>
        </Reveal>
      </div>
    </section>
  );
}
