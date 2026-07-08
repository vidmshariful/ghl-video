import { Eyebrow } from "@/components/Eyebrow";
import { MediaFrame } from "@/components/MediaFrame";
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
    <section className="relative overflow-hidden section-pad pt-0">
      <SectionGlow accent="green" position="left" />
      <div className="shell relative">
        <Reveal>
          <RevealItem>
            <Eyebrow accent="green">{home.work.eyebrow}</Eyebrow>
          </RevealItem>
        </Reveal>

        <Reveal className="mt-6 grid items-start gap-5 lg:grid-cols-12">
          <RevealItem className="lg:col-span-8">
            <MediaFrame
              src={featured.src}
              poster={featured.poster}
              label={`${featured.client}, ${featured.format}`}
              caption={{ title: featured.client, sub: featured.format }}
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
      </div>
    </section>
  );
}
