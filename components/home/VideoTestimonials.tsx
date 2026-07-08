import { MediaFrame } from "@/components/MediaFrame";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionChip } from "@/components/SectionChip";
import { SectionGlow } from "@/components/SectionGlow";
import { home } from "@/lib/site";

/*
 * Three clients on camera. Click pops the video up with sound.
 * PLACEHOLDER clips until the real testimonial videos land; names and
 * companies are the locked real clients.
 */
export function VideoTestimonials() {
  const vt = home.videoTestimonials;
  return (
    <section className="relative overflow-hidden section-pad border-t border-hair">
      <SectionGlow accent="green" position="left" />
      <div className="shell relative">
        <Reveal>
          <RevealItem>
            <SectionChip index={6} label={vt.chip} accent="green" />
            <h2 className="mt-6 max-w-[18ch] font-display text-h2 text-ink">
              {vt.headline}{" "}
              <span className="text-green">{vt.accent}</span>
            </h2>
          </RevealItem>
        </Reveal>

        <Reveal className="mt-12 grid gap-5 md:grid-cols-3">
          {vt.items.map((item) => (
            <RevealItem key={item.company}>
              <MediaFrame
                src={item.src}
                poster={item.poster}
                label={`Testimonial from ${item.name}, ${item.company}`}
                caption={{ title: item.name, sub: item.company }}
              />
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
