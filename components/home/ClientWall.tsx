import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionGlow } from "@/components/SectionGlow";
import { Stat } from "@/components/Stat";
import { clients } from "@/lib/site";

/*
 * The client wall owns the 800+ figure and nothing else: one big collage
 * of real client logos arranged around the HighLevel mark. The 5.0 lives
 * with the reviews further down. The collage PNG is built for the dark
 * ground, so it drops straight in.
 */
export function ClientWall() {
  return (
    <section
      aria-labelledby="clients-heading"
      className="relative overflow-hidden section-pad"
    >
      <SectionGlow position="right" />
      <div className="shell relative text-center">
        <Reveal>
          <RevealItem>
            <p className="font-mono text-label uppercase text-gold">
              [ Trusted by ]
            </p>
            <h2
              id="clients-heading"
              className="mx-auto mt-6 max-w-[22ch] font-display text-h2 text-ink"
            >
              <span className="text-gradient">
                <Stat value={clients} suffix="+" />
              </span>{" "}
              HighLevel founders, and counting.
            </h2>
            <p className="mx-auto mt-5 max-w-[var(--measure-lede)] text-lede text-muted">
              The teams that build on HighLevel trust GHL Video with the
              videos that sell their platform.
            </p>
          </RevealItem>
        </Reveal>

        <Reveal className="mt-14">
          <RevealItem>
            {/* eslint-disable-next-line @next/next/no-img-element -- static export, local asset */}
            <img
              src="/clients-collage.png"
              alt="A wall of client logos arranged around the HighLevel mark"
              width={1200}
              height={588}
              loading="lazy"
              className="mx-auto w-full max-w-5xl"
            />
          </RevealItem>
        </Reveal>

      </div>
    </section>
  );
}
