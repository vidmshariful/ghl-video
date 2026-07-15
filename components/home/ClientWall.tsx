import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionGlow } from "@/components/SectionGlow";
import { Stat } from "@/components/Stat";
import { clients, googleReviewsUrl, rating } from "@/lib/site";

/*
 * The client wall: one big collage of real client logos arranged around
 * the HighLevel mark. The social-proof moment. The collage PNG is built
 * for the dark ground, so it drops straight in.
 */
export function ClientWall() {
  return (
    <section
      aria-labelledby="clients-heading"
      className="relative overflow-hidden section-pad"
    >
      <SectionGlow accent="gold" position="right" />
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
            <p className="mx-auto mt-5 max-w-[54ch] text-lede text-muted">
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

        <Reveal className="mt-12">
          <RevealItem>
            <a
              href={googleReviewsUrl}
              target="_blank"
              rel="noopener"
              className="group inline-flex items-center gap-2.5 font-mono text-label uppercase text-muted transition-colors hover:text-gold"
            >
              <span className="font-mono text-[1.25rem] font-bold leading-none text-gold [font-variant-numeric:tabular-nums]">
                {rating}
              </span>
              rating on Google
              <span
                aria-hidden="true"
                className="transition-transform duration-200 group-hover:translate-x-0.5"
              >
                &rarr;
              </span>
            </a>
          </RevealItem>
        </Reveal>
      </div>
    </section>
  );
}
