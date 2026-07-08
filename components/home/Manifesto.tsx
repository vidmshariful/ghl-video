import { Reveal, RevealItem } from "@/components/Reveal";
import { home } from "@/lib/site";

/*
 * The category statement as a two-column editorial band: gold rule and
 * statement left, supporting argument right. No chip; this is a band,
 * not an indexed section.
 */
export function Manifesto() {
  const { manifesto } = home;
  return (
    <section className="border-t border-hair">
      <div className="shell py-16 md:py-20">
        <Reveal className="grid gap-8 border-l-[3px] border-gold pl-8 md:grid-cols-2 md:gap-14 md:pl-10">
          <RevealItem>
            <p className="max-w-[18ch] font-display text-[clamp(1.5rem,2.8vw,2.25rem)] font-semibold leading-[1.15] tracking-tight text-ink">
              {manifesto.statement}
            </p>
          </RevealItem>
          <RevealItem className="self-center">
            <p className="max-w-[54ch] text-[0.9375rem] leading-relaxed text-muted">
              {manifesto.body}
            </p>
          </RevealItem>
        </Reveal>
      </div>
    </section>
  );
}
