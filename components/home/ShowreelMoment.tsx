import { Eyebrow } from "@/components/Eyebrow";
import { HoverClip } from "@/components/HoverClip";
import { Reveal, RevealItem } from "@/components/Reveal";
import { home } from "@/lib/site";

/*
 * The work, off-center: one featured piece at 8 columns, two
 * supporting clips stacked at 4. All hover-play (the signature
 * interaction), mono captions like a spec sheet.
 */
function Caption({ client, format }: { client: string; format: string }) {
  return (
    <p className="mt-3 font-mono text-label uppercase">
      <span className="text-muted">{client}</span>
      <span className="text-dim"> / {format}</span>
    </p>
  );
}

export function ShowreelMoment() {
  const [featured, second, third] = home.work.pieces;
  return (
    <section className="section-pad pt-0">
      <div className="shell">
        <Reveal>
          <RevealItem>
            <Eyebrow accent="green">{home.work.eyebrow}</Eyebrow>
          </RevealItem>
        </Reveal>

        <Reveal className="mt-6 grid items-start gap-6 lg:grid-cols-12">
          <RevealItem className="lg:col-span-8">
            <HoverClip
              src={featured.src}
              poster={featured.poster}
              label={`${featured.client}, ${featured.format}`}
              rounded="rounded-card"
              className="aspect-video"
            />
            <Caption client={featured.client} format={featured.format} />
          </RevealItem>

          <RevealItem className="grid gap-6 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1">
            {[second, third].map((piece) => (
              <div key={piece.src}>
                <HoverClip
                  src={piece.src}
                  poster={piece.poster}
                  label={`${piece.client}, ${piece.format}`}
                  className="aspect-video"
                />
                <Caption client={piece.client} format={piece.format} />
              </div>
            ))}
          </RevealItem>
        </Reveal>
      </div>
    </section>
  );
}
