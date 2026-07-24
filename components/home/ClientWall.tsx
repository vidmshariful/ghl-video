import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionChip } from "@/components/SectionChip";
import { Stat } from "@/components/Stat";
import { clients, trustLogos } from "@/lib/site";

/*
 * The client wall, drawn into the page grid: one ruled frame (edge-to-edge
 * rules, hatched rail gutters) filled with a hairline mesh of small logo
 * cells, the title box sitting in the dead centre. On the wide grid the
 * logos wrap the title on every side (7 columns, the centre 3x3 is the
 * title, the 26 real marks fill the ring around it exactly). Logos ride as
 * uniform light silhouettes, full colour on hover.
 */

/*
 * Chessboard tone for each ring cell, in the row-major order the logos
 * auto-fill the 8x6 grid around the 4x2 centre (cols 3-6, rows 3-4). Its
 * length (40) must match the ring cell count and the logo count.
 */
const WALL_TONES: number[] = (() => {
  const tones: number[] = [];
  for (let r = 1; r <= 6; r++) {
    for (let c = 1; c <= 8; c++) {
      const inCentre = r >= 3 && r <= 4 && c >= 3 && c <= 6;
      if (!inCentre) tones.push((r + c) % 2);
    }
  }
  return tones;
})();

function LogoCell({ src, tone }: { src: string; tone: number }) {
  return (
    <RevealItem className="h-full">
      <div
        className={`group/logo flex h-full min-h-[6rem] items-center justify-center p-4 lg:min-h-0 ${
          tone === 0 ? "bg-surface" : "bg-card"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static export, local asset */}
        <img
          src={src}
          alt=""
          loading="lazy"
          className="h-8 w-auto max-w-[7.5rem] object-contain transition-transform duration-300 group-hover/logo:scale-105"
        />
      </div>
    </RevealItem>
  );
}

export function ClientWall() {
  return (
    <section
      aria-labelledby="clients-heading"
      className="relative overflow-x-clip section-pad"
    >
      <div className="shell">
        <div className="relative border border-hair">
          {/* the box's rules extend edge to edge */}
          <span
            aria-hidden="true"
            className="absolute -top-px left-1/2 -z-10 h-px w-screen -translate-x-1/2 bg-hair"
          />
          <span
            aria-hidden="true"
            className="absolute -bottom-px left-1/2 -z-10 h-px w-screen -translate-x-1/2 bg-hair"
          />
          {/* the blueprint hatch fills the gutters out to the frame rails */}
          <span
            aria-hidden="true"
            className="hatch pointer-events-none absolute inset-y-0 right-full mr-px w-[var(--rail-gutter)]"
          />
          <span
            aria-hidden="true"
            className="hatch pointer-events-none absolute inset-y-0 left-full ml-px w-[var(--rail-gutter)]"
          />

          {/* the logo mesh with the title box in the centre */}
          <Reveal className="grid grid-cols-2 gap-px bg-hair sm:grid-cols-3 md:grid-cols-4 lg:h-[38rem] lg:grid-cols-8 lg:grid-rows-6">
            {/* centre title box: full width until the wide grid, then the
                4x2 core with logos wrapping every side */}
            <RevealItem className="col-span-2 sm:col-span-3 md:col-span-4 lg:col-start-3 lg:col-span-4 lg:row-start-3 lg:row-span-2">
              <div className="flex h-full flex-col items-center justify-center bg-canvas px-6 py-12 text-center md:px-10">
                <SectionChip label="Trusted by" />
                <h2
                  id="clients-heading"
                  className="mt-6 max-w-[18ch] font-display text-h2 text-ink"
                >
                  <span className="text-gradient">
                    <Stat value={clients} suffix="+" />
                  </span>{" "}
                  HighLevel founders, and counting.
                </h2>
              </div>
            </RevealItem>

            {trustLogos.map((src, i) => (
              <LogoCell key={src} src={src} tone={WALL_TONES[i]} />
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
