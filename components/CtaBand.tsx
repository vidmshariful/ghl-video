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
    >
      {/* the gradient fills the frame-rail box and nothing more: same
          geometry as PageFrame, so it stops exactly at the rails, top
          rule to bottom rule. The grain rides inside it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-1/2 w-[min(100%-1.5rem,80.5rem)] -translate-x-1/2"
        style={{
          background:
            "linear-gradient(135deg, rgba(252,192,0,0.09) 0%, rgba(252,192,0,0.025) 36%, rgba(8,9,13,0) 60%), linear-gradient(315deg, rgba(0,204,0,0.05) 0%, rgba(0,204,0,0.015) 30%, rgba(8,9,13,0) 52%), color-mix(in srgb, var(--surface) 55%, var(--canvas))",
        }}
      >
        {/* the grain runs stronger here than the hero's 0.06: the light
            shoulder of the gradient is where the texture should read */}
        <span
          aria-hidden="true"
          className="grunge absolute inset-0"
          style={{ opacity: 0.15 }}
        />
      </div>
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
