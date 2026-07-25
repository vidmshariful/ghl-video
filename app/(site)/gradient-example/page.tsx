import type { Metadata } from "next";

/*
 * TEMPORARY internal page: 20 section-background gradients to pick from,
 * each in the frame-rail box (the boxed-layout rule), black fixed as the
 * base, one brand color as the second color, grain at the CTA band's
 * strength. Not in pages-list, not in the sitemap, noindex. Delete after
 * the pick is made.
 */
export const metadata: Metadata = {
  title: "Gradient Example",
  robots: { index: false, follow: false },
};

const GOLD = "252,192,0";
const GREEN = "0,204,0";
const BLUE = "0,144,252";

type Sample = { name: string; css: string };

const g = (rgb: string, a: number) => `rgba(${rgb},${a})`;
const OFF = "rgba(8,9,13,0)";
const BASE = "var(--canvas)";

const samples: Sample[] = [
  {
    name: "Gold corner, top left",
    css: `linear-gradient(135deg, ${g(GOLD, 0.14)} 0%, ${g(GOLD, 0.04)} 34%, ${OFF} 62%), ${BASE}`,
  },
  {
    name: "Gold corner, top left, dark",
    css: `linear-gradient(135deg, ${g(GOLD, 0.09)} 0%, ${g(GOLD, 0.025)} 36%, ${OFF} 60%), ${BASE}`,
  },
  {
    name: "Gold corner, top right",
    css: `linear-gradient(225deg, ${g(GOLD, 0.12)} 0%, ${g(GOLD, 0.03)} 35%, ${OFF} 60%), ${BASE}`,
  },
  {
    name: "Gold, both top corners",
    css: `linear-gradient(135deg, ${g(GOLD, 0.1)} 0%, ${OFF} 45%), linear-gradient(225deg, ${g(GOLD, 0.1)} 0%, ${OFF} 45%), ${BASE}`,
  },
  {
    name: "Gold wash from the top",
    css: `linear-gradient(180deg, ${g(GOLD, 0.11)} 0%, ${g(GOLD, 0.03)} 30%, ${OFF} 58%), ${BASE}`,
  },
  {
    name: "Gold under-glow, bottom",
    css: `linear-gradient(0deg, ${g(GOLD, 0.12)} 0%, ${g(GOLD, 0.03)} 28%, ${OFF} 55%), ${BASE}`,
  },
  {
    name: "Gold center bloom",
    css: `radial-gradient(60% 80% at 50% 45%, ${g(GOLD, 0.1)} 0%, ${g(GOLD, 0.03)} 45%, ${OFF} 75%), ${BASE}`,
  },
  {
    name: "Gold floor bloom",
    css: `radial-gradient(70% 90% at 50% 115%, ${g(GOLD, 0.14)} 0%, ${g(GOLD, 0.04)} 45%, ${OFF} 72%), ${BASE}`,
  },
  {
    name: "Gold full diagonal sweep",
    css: `linear-gradient(135deg, ${g(GOLD, 0.12)} 0%, ${g(GOLD, 0.05)} 45%, ${g(GOLD, 0.01)} 75%, ${OFF} 100%), ${BASE}`,
  },
  {
    name: "Gold spotlight, off-center",
    css: `radial-gradient(45% 65% at 30% 30%, ${g(GOLD, 0.13)} 0%, ${g(GOLD, 0.03)} 50%, ${OFF} 78%), ${BASE}`,
  },
  {
    name: "Gold edge vignette",
    css: `radial-gradient(120% 140% at 50% 50%, ${OFF} 55%, ${g(GOLD, 0.07)} 100%), ${BASE}`,
  },
  {
    name: "Gold conic corner sweep",
    css: `conic-gradient(from 200deg at 8% 0%, ${g(GOLD, 0.12)} 0deg, ${OFF} 110deg), ${BASE}`,
  },
  {
    name: "Green corner, top left",
    css: `linear-gradient(135deg, ${g(GREEN, 0.11)} 0%, ${g(GREEN, 0.03)} 34%, ${OFF} 60%), ${BASE}`,
  },
  {
    name: "Green under-glow, bottom",
    css: `linear-gradient(0deg, ${g(GREEN, 0.1)} 0%, ${g(GREEN, 0.025)} 28%, ${OFF} 52%), ${BASE}`,
  },
  {
    name: "Green floor bloom",
    css: `radial-gradient(70% 90% at 50% 115%, ${g(GREEN, 0.12)} 0%, ${g(GREEN, 0.03)} 45%, ${OFF} 70%), ${BASE}`,
  },
  {
    name: "Blue corner, top left",
    css: `linear-gradient(135deg, ${g(BLUE, 0.13)} 0%, ${g(BLUE, 0.035)} 34%, ${OFF} 60%), ${BASE}`,
  },
  {
    name: "Blue under-glow, bottom",
    css: `linear-gradient(0deg, ${g(BLUE, 0.12)} 0%, ${g(BLUE, 0.03)} 28%, ${OFF} 52%), ${BASE}`,
  },
  {
    name: "Signature: gold into green, diagonal",
    css: `linear-gradient(120deg, ${g(GOLD, 0.12)} 0%, ${g(GOLD, 0.04)} 30%, ${OFF} 55%, ${g(GREEN, 0.03)} 75%, ${g(GREEN, 0.09)} 100%), ${BASE}`,
  },
  {
    name: "Signature: gold top left, green bottom right (the CTA band)",
    css: `linear-gradient(135deg, ${g(GOLD, 0.09)} 0%, ${g(GOLD, 0.025)} 36%, ${OFF} 60%), linear-gradient(315deg, ${g(GREEN, 0.05)} 0%, ${g(GREEN, 0.015)} 30%, ${OFF} 52%), ${BASE}`,
  },
  {
    name: "Signature: gold wash top, green under-glow",
    css: `linear-gradient(180deg, ${g(GOLD, 0.1)} 0%, ${g(GOLD, 0.025)} 26%, ${OFF} 50%), linear-gradient(0deg, ${g(GREEN, 0.07)} 0%, ${OFF} 32%), ${BASE}`,
  },
];

function GradientBox({ sample, index }: { sample: Sample; index: number }) {
  const num = String(index + 1).padStart(2, "0");
  return (
    <section className="relative overflow-x-clip py-14">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-1/2 w-[min(100%-1.5rem,80.5rem)] -translate-x-1/2"
        style={{ background: sample.css }}
      >
        <span
          aria-hidden="true"
          className="grunge absolute inset-0"
          style={{ opacity: 0.15 }}
        />
      </div>
      <div className="shell relative flex min-h-[16rem] flex-col items-center justify-center text-center">
        <p className="font-mono text-label uppercase text-gold [font-variant-numeric:tabular-nums]">
          [ {num} ]
        </p>
        <h2 className="mt-4 font-display text-h3 text-ink">{sample.name}</h2>
        <p className="mx-auto mt-3 max-w-[70ch] font-mono text-label uppercase leading-relaxed text-dim">
          {sample.css.replaceAll("var(--canvas)", "black")}
        </p>
      </div>
    </section>
  );
}

export default function GradientExamplePage() {
  return (
    <>
      <section className="relative pt-32 pb-6 text-center">
        <div className="shell">
          <h1 className="font-display text-h2 text-ink">Gradient Example</h1>
          <p className="mx-auto mt-4 max-w-[var(--measure-body)] text-body text-muted">
            20 section-box backgrounds. Black is fixed; the second color is a
            brand color. Every box uses the frame-rail geometry and the CTA
            band grain. Pick by number.
          </p>
        </div>
      </section>
      {samples.map((s, i) => (
        <GradientBox key={s.name} sample={s} index={i} />
      ))}
    </>
  );
}
