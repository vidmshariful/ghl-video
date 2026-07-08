import { Button } from "@/components/Button";
import { Reveal, RevealItem } from "@/components/Reveal";
import { home, cta } from "@/lib/site";

/*
 * Left-set closing band. The accent word is solid gold, not gradient:
 * the gradient-word moment belongs to the hero alone. Ambient glow
 * behind, one per page bottom.
 */
export function ClosingCta() {
  return (
    <section className="relative overflow-hidden border-t border-hair">
      <div
        aria-hidden="true"
        className="absolute -top-24 left-[8%] h-[26rem] w-[36rem] rounded-full bg-gold opacity-[0.06] blur-[130px]"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-32 right-[4%] h-[24rem] w-[32rem] rounded-full bg-green opacity-[0.07] blur-[130px]"
      />

      <div className="shell section-pad relative">
        <Reveal>
          <RevealItem>
            <h2 className="max-w-[16ch] font-display text-h2 text-ink">
              {home.closing.headline}{" "}
              <span className="text-gold">{home.closing.accent}</span>
            </h2>
            <p className="mt-5 max-w-[44ch] text-lede text-muted">
              {home.closing.lede}
            </p>
          </RevealItem>
          <RevealItem className="mt-9 flex flex-wrap gap-4">
            <Button href={cta.bookACall.href} variant="primary">
              {cta.bookACall.label}
            </Button>
            <Button href={cta.seePremade.href} variant="ghost">
              {cta.seePremade.label}
            </Button>
          </RevealItem>
        </Reveal>
      </div>
    </section>
  );
}
