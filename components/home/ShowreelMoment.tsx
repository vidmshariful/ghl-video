import Link from "next/link";
import { MediaCard } from "@/components/MediaCard";
import { SectionChip } from "@/components/SectionChip";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionGlow } from "@/components/SectionGlow";
import { home } from "@/lib/site";

/*
 * The signature moment: one featured piece at 8 columns, two
 * supporting clips stacked at 4. Each is a MediaCard, so the client
 * and format read below the frame, not over the footage.
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
            <MediaCard
              src={featured.src}
              poster={featured.poster}
              title={featured.client}
              meta={featured.format}
              startAt={"startAt" in featured ? featured.startAt : undefined}
              endAt={"endAt" in featured ? featured.endAt : undefined}
            />
          </RevealItem>

          <RevealItem className="grid gap-5 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1">
            {[second, third].map((piece) => (
              <MediaCard
                key={piece.src}
                src={piece.src}
                poster={piece.poster}
                title={piece.client}
                meta={piece.format}
                {...("startAt" in piece
                  ? { startAt: piece.startAt, endAt: piece.endAt }
                  : {})}
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
