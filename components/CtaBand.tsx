import { Button } from "@/components/Button";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionGradient } from "@/components/SectionGradient";

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
    >
      {/* the shared section-box surface: rails-boxed gradient + grain */}
      <SectionGradient />
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
