import Link from "next/link";
import { MediaFrame } from "@/components/MediaFrame";
import { SectionChip } from "@/components/SectionChip";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionGlow } from "@/components/SectionGlow";
import { home } from "@/lib/site";

/*
 * The signature moment: one featured piece at 8 columns, two
 * supporting clips stacked at 4, every frame through MediaFrame so
 * the set reads as one curated wall. Captions live inside the frames.
 */
export function ShowreelMoment() {
  const [featured, second, third] = home.work.pieces;
  return (
    <section data-bp-idx="3" aria-labelledby="recent-work-heading" className="relative overflow-hidden section-pad">
      <SectionGlow accent="green" position="left" />
      <div className="shell relative">
        <Reveal>
          <RevealItem>
            <SectionChip index={3} label={home.work.eyebrow} accent="green" />
            <h2 id="recent-work-heading" className="mt-6 max-w-[14ch] font-display text-h2 text-ink">
              Recent work.
            </h2>
          </RevealItem>
        </Reveal>

        <Reveal className="mt-10 grid items-start gap-5 lg:grid-cols-12">
          <RevealItem className="lg:col-span-8">
            <MediaFrame
              src={featured.src}
              poster={featured.poster}
              label={`${featured.client}, ${featured.format}`}
              caption={{ title: featured.client, sub: featured.format }}
              startAt={"startAt" in featured ? featured.startAt : 0}
              endAt={"endAt" in featured ? featured.endAt : undefined}
              rounded="rounded-card"
            />
          </RevealItem>

          <RevealItem className="grid gap-5 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1">
            {[second, third].map((piece) => (
              <MediaFrame
                key={piece.src}
                src={piece.src}
                poster={piece.poster}
                label={`${piece.client}, ${piece.format}`}
                caption={{ title: piece.client, sub: piece.format }}
              />
            ))}
          </RevealItem>
        </Reveal>

        <Reveal className="mt-8">
          <RevealItem>
            <Link
              href="/work/"
              className="group inline-flex items-center gap-2 text-sm font-semibold text-green"
            >
              See all work
              <span
                aria-hidden="true"
                className="transition-transform duration-200 group-hover:translate-x-1"
              >
                &rarr;
              </span>
            </Link>
          </RevealItem>
        </Reveal>
      </div>
    </section>
  );
}
