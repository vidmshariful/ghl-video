import Link from "next/link";
import { Button } from "@/components/Button";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionChip } from "@/components/SectionChip";
import { home, cta } from "@/lib/site";

/*
 * Closing band: pitch left, the after-you-book sequence as a bordered
 * column on the right. The accent word is solid gold, not gradient:
 * the gradient-word moment belongs to the hero alone.
 */
export function ClosingCta() {
  return (
    <section aria-labelledby="closing-heading" className="relative overflow-hidden border-t border-hair">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-[8%] h-[26rem] w-[36rem]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(252,192,0,0.07), transparent 72%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 right-[4%] h-[24rem] w-[32rem]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(0,204,0,0.08), transparent 72%)",
        }}
      />

      <div className="shell section-pad relative">
        <Reveal className="grid items-center gap-12 lg:grid-cols-12">
          <RevealItem className="lg:col-span-7">
            <SectionChip index={10} label="Next step" accent="green" />
            <h2 id="closing-heading" className="mt-6 max-w-[16ch] font-display text-h2 text-ink">
              {home.closing.headline}{" "}
              <span className="text-gold">{home.closing.accent}</span>
            </h2>
            <p className="mt-5 max-w-[44ch] text-lede text-muted">
              {home.closing.lede}
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Button href={cta.bookACall.href} variant="primary">
                {cta.bookACall.label}
              </Button>
              <Button href={cta.seePremade.href} variant="ghost">
                {cta.seePremade.label}
              </Button>
            </div>
          </RevealItem>

          {/* what happens after you book: the right-hand column */}
          <RevealItem className="lg:col-span-5">
            <ol className="border-l border-hair">
              {home.closing.steps.map((step, i) => (
                <li
                  key={step.title}
                  className={`flex gap-5 py-6 pl-8 ${i > 0 ? "border-t border-hair" : ""}`}
                >
                  <p className="pt-0.5 font-mono text-label uppercase text-green">
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <div>
                    <p className="font-display text-[1.0625rem] font-semibold text-ink">
                      {step.title}
                    </p>
                    <p className="mt-1 text-sm text-muted">{step.line}</p>
                  </div>
                </li>
              ))}
            </ol>
            {/* the second audience gets its own exit */}
            <p className="mt-6 border-t border-hair pt-5 pl-8 text-sm text-muted">
              Publishing weekly?{" "}
              <Link
                href="/editing/"
                className="group inline-flex items-center gap-1.5 font-semibold text-blue"
              >
                See video editing
                <span
                  aria-hidden="true"
                  className="transition-transform duration-200 group-hover:translate-x-1"
                >
                  &rarr;
                </span>
              </Link>
            </p>
          </RevealItem>
        </Reveal>
      </div>
    </section>
  );
}
