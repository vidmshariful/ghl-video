import { Eyebrow } from "@/components/Eyebrow";
import { Reveal, RevealItem } from "@/components/Reveal";
import { home } from "@/lib/site";

/*
 * Editorial split: heavy left headline (sticky on tall screens), five
 * hairline rows on the right. One sentence each, no icons, no fake
 * numbering. The type does the work.
 */
export function WhyPoints() {
  const { why } = home;
  return (
    <section className="section-pad border-t border-hair">
      <div className="shell grid gap-12 lg:grid-cols-12">
        <Reveal className="lg:col-span-5">
          <RevealItem className="lg:sticky lg:top-32">
            <Eyebrow accent="gold">{why.eyebrow}</Eyebrow>
            <h2 className="mt-4 max-w-[13ch] font-display text-h2 text-ink">
              {why.headline}
            </h2>
          </RevealItem>
        </Reveal>

        <Reveal className="lg:col-span-7">
          <div className="border-t border-hair">
            {why.points.map((point) => (
              <RevealItem
                key={point.lead}
                className="border-b border-hair py-6"
              >
                <p className="max-w-[56ch] text-[0.9375rem] leading-relaxed text-muted">
                  <strong className="font-display text-[1.0625rem] font-semibold text-ink">
                    {point.lead}
                  </strong>{" "}
                  {point.rest}
                </p>
              </RevealItem>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
