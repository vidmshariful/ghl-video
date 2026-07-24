import { MediaFrame } from "@/components/MediaFrame";
import { RuledSection } from "@/components/RuledSection";
import { Reveal, RevealItem } from "@/components/Reveal";
import { home } from "@/lib/site";

/*
 * Client stories, drawn into the page grid: a RuledSection frame with the
 * three founder clips as a connected cell mesh (gap-px on bg-hair). Each
 * clip is inset so the ruled lines read around it; below sits a very short
 * takeaway of what they said, then the name with the gold attribution bar.
 * Clicking a clip pops it up with sound.
 */
export function VideoTestimonials() {
  const vt = home.videoTestimonials;
  return (
    <RuledSection
      bpIdx={5}
      index={5}
      chip={vt.chip}
      headline={vt.headline}
      accent={vt.accent}
      intro={vt.intro}
    >
      <Reveal className="grid gap-px bg-hair md:grid-cols-3">
        {vt.items.map((item) => (
          <RevealItem key={item.company} className="h-full">
            <div className="flex h-full flex-col bg-canvas p-4">
              <MediaFrame
                src={item.src}
                poster={item.poster}
                label={`Testimonial from ${item.name}, ${item.company}`}
                tint
              />
              <div className="flex flex-1 flex-col px-2 pt-5">
                <p className="text-body leading-relaxed text-muted">
                  {item.summary}
                </p>
                <div className="mt-6 border-l-2 border-gold pl-4">
                  <p className="font-display text-h4 font-semibold text-ink">
                    {item.name}
                  </p>
                  <p className="mt-0.5 text-body text-muted">
                    CEO of {item.company}
                  </p>
                </div>
              </div>
            </div>
          </RevealItem>
        ))}
      </Reveal>
    </RuledSection>
  );
}
