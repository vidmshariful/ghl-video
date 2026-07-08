import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionChip } from "@/components/SectionChip";
import { home } from "@/lib/site";

/*
 * Editorial FAQ: native details/summary accordions in bounded panels,
 * mono plus glyph, no icons, keyboard accessible for free.
 */
export function Faq() {
  const { faq } = home;
  return (
    <section className="section-pad border-t border-hair">
      <div className="shell">
        <Reveal className="text-center">
          <RevealItem>
            <SectionChip index={8} label={faq.chip} />
            <h2 className="mx-auto mt-6 max-w-[18ch] font-display text-h2 text-ink">
              {faq.headline}{" "}
              <span className="text-gold">{faq.accent}</span>
            </h2>
          </RevealItem>
        </Reveal>

        <Reveal className="mx-auto mt-12 flex max-w-3xl flex-col gap-3">
          {faq.items.map((item) => (
            <RevealItem key={item.q}>
              <details className="group rounded-card border border-hair card-glass">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 px-6 py-5 [&::-webkit-details-marker]:hidden">
                  <span className="font-display text-[1.0625rem] font-semibold text-ink">
                    {item.q}
                  </span>
                  <span
                    aria-hidden="true"
                    className="font-mono text-lg text-green transition-transform duration-200 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="max-w-[64ch] px-6 pb-6 text-sm leading-relaxed text-muted">
                  {item.a}
                </p>
              </details>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
