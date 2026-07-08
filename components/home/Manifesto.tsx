import { Button } from "@/components/Button";
import { Reveal, RevealItem } from "@/components/Reveal";
import { home, cta } from "@/lib/site";

/*
 * The problem statement, centered, with the call to action right
 * after the sting. A band, not an indexed section.
 */
export function Manifesto() {
  const { manifesto } = home;
  return (
    <section className="border-t border-hair">
      <div className="shell py-20 text-center md:py-24">
        <Reveal>
          <RevealItem>
            <p className="mx-auto max-w-[38ch] font-display text-[clamp(1.5rem,2.8vw,2.25rem)] font-semibold leading-[1.25] tracking-tight text-ink">
              {manifesto.statement}
            </p>
          </RevealItem>
          <RevealItem className="mt-9">
            <Button href={cta.bookACall.href} variant="primary">
              {cta.bookACall.label}
            </Button>
          </RevealItem>
        </Reveal>
      </div>
    </section>
  );
}
