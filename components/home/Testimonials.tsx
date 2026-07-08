import { Avatar } from "@/components/Avatar";
import { MediaFrame } from "@/components/MediaFrame";
import { SectionChip } from "@/components/SectionChip";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionGlow } from "@/components/SectionGlow";
import { home } from "@/lib/site";

/*
 * One lead pull-quote at display size, two supporting quotes below.
 * Uneven weight on purpose. Quote copy is DRAFT until real client
 * words are approved (flagged in lib/site.ts).
 */
export function Testimonials() {
  const lead = home.testimonials.find((t) => t.lead)!;
  const rest = home.testimonials.filter((t) => !t.lead);
  /* the lead client's own piece beside their words, when we have it */
  const leadWork = home.work.pieces.find((p) => p.client === lead.company);

  return (
    <section className="relative overflow-hidden section-pad border-t border-hair">
      <SectionGlow accent="gold" position="left" />
      <div className="shell relative">
        <Reveal className="grid items-center gap-10 lg:grid-cols-12">
          <RevealItem className="lg:col-span-8">
            <SectionChip index={6} label="Proof" />
            <blockquote className="mt-8">
              <p className="max-w-[30ch] font-display text-[clamp(1.5rem,3vw,2.375rem)] font-semibold leading-[1.25] tracking-tight text-ink">
                {lead.quote}
              </p>
              <footer className="mt-7 flex items-center gap-4">
                <Avatar name={lead.name} photo={lead.photo} size="lg" />
                <p className="font-mono text-sm">
                  <span className="text-ink">{lead.name}</span>
                  <span className="text-dim">
                    {" "}
                    / {lead.role}, {lead.company}
                  </span>
                </p>
              </footer>
            </blockquote>
          </RevealItem>
          {leadWork && (
            <RevealItem className="hidden lg:col-span-4 lg:block">
              <MediaFrame
                src={leadWork.src}
                poster={leadWork.poster}
                label={`${leadWork.client}, ${leadWork.format}`}
                caption={{ title: leadWork.client, sub: leadWork.format }}
              />
            </RevealItem>
          )}
        </Reveal>

        <Reveal className="mt-14 grid gap-4 md:grid-cols-2 lg:max-w-4xl">
          {rest.map((t) => (
            <RevealItem key={t.name}>
              <blockquote className="flex h-full flex-col rounded-card border border-hair card-glass p-7">
                <p className="text-sm leading-relaxed text-muted">{t.quote}</p>
                <footer className="mt-5 flex items-center gap-3 pt-2">
                  <Avatar name={t.name} photo={t.photo} size="md" />
                  <p className="font-mono text-xs">
                    <span className="text-ink">{t.name}</span>
                    <span className="text-dim">
                      {" "}
                      / {t.role}, {t.company}
                    </span>
                  </p>
                </footer>
              </blockquote>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
