import { Eyebrow } from "@/components/Eyebrow";
import { Reveal, RevealItem } from "@/components/Reveal";
import { home } from "@/lib/site";

/*
 * One lead pull-quote at display size, two supporting quotes below.
 * Uneven weight on purpose. Quote copy is DRAFT until real client
 * words are approved (flagged in lib/site.ts).
 */
export function Testimonials() {
  const lead = home.testimonials.find((t) => t.lead)!;
  const rest = home.testimonials.filter((t) => !t.lead);

  return (
    <section className="section-pad border-t border-hair">
      <div className="shell">
        <Reveal>
          <RevealItem>
            <Eyebrow accent="gold">Proof</Eyebrow>
          </RevealItem>

          <RevealItem className="mt-8">
            <blockquote>
              <p className="max-w-[30ch] font-display text-[clamp(1.5rem,3vw,2.375rem)] font-semibold leading-[1.25] tracking-tight text-ink">
                {lead.quote}
              </p>
              <footer className="mt-6 font-mono text-sm">
                <span className="text-ink">{lead.name}</span>
                <span className="text-dim">
                  {" "}
                  / {lead.role}, {lead.company}
                </span>
              </footer>
            </blockquote>
          </RevealItem>
        </Reveal>

        <Reveal className="mt-14 grid gap-4 md:grid-cols-2 lg:max-w-4xl">
          {rest.map((t) => (
            <RevealItem key={t.name}>
              <blockquote className="flex h-full flex-col rounded-card border border-hair bg-surface p-7">
                <p className="text-sm leading-relaxed text-muted">{t.quote}</p>
                <footer className="mt-5 pt-2 font-mono text-xs">
                  <span className="text-ink">{t.name}</span>
                  <span className="text-dim">
                    {" "}
                    / {t.role}, {t.company}
                  </span>
                </footer>
              </blockquote>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
