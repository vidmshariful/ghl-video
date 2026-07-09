import { Button } from "@/components/Button";
import { DrawnBorder } from "@/components/DrawnBorder";
import { FaqList } from "@/components/FaqList";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionChip } from "@/components/SectionChip";
import { home, cta } from "@/lib/site";

/*
 * Editorial FAQ: centered header, then wide flat rows with hairline
 * separators and a rotating chevron. Native details/summary keeps it
 * keyboard accessible; opens animate via CSS details transitions.
 */
export function Faq() {
  const { faq } = home;
  return (
    <section
      data-bp-idx="8"
      aria-labelledby="faq-heading"
      className="relative section-pad"
    >
      <DrawnBorder />
      <div className="shell">
        <Reveal className="text-center">
          <RevealItem>
            <SectionChip index={8} label={faq.chip} />
            <h2
              id="faq-heading"
              className="mx-auto mt-6 max-w-[18ch] font-display text-h2 text-ink"
            >
              {faq.headline} <span className="text-gold">{faq.accent}</span>
            </h2>
          </RevealItem>
        </Reveal>

        <Reveal className="mx-auto mt-14 max-w-4xl">
          <RevealItem>
            <FaqList items={faq.items} />
          </RevealItem>
        </Reveal>

        {/* the objection loop just closed; the action sits right here */}
        <Reveal className="mx-auto mt-14 max-w-3xl text-center">
          <RevealItem>
            <p className="text-lede text-muted">The call answers the rest.</p>
            <div className="mt-6 flex justify-center">
              <Button href={cta.bookACall.href} variant="primary">
                {cta.bookACall.label}
              </Button>
            </div>
          </RevealItem>
        </Reveal>
      </div>
    </section>
  );
}
