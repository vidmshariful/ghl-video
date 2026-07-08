import { Button } from "@/components/Button";
import { Reveal, RevealItem } from "@/components/Reveal";
import { home, cta } from "@/lib/site";

/*
 * Left-set closing band with a right-anchored strip of real frames as
 * the page's second deliberate counterweight (the hero's work stack is
 * the first). The accent word is solid gold, not gradient: the
 * gradient-word moment belongs to the hero alone. The numbered steps
 * are a real sequence, so numbering carries information.
 */
function Filmstrip() {
  const pieces = home.work.pieces;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -right-16 top-1/2 hidden w-[24rem] -translate-y-1/2 rotate-3 opacity-60 lg:block"
    >
      {pieces.map((p, i) => (
        <div
          key={p.src}
          className={`overflow-hidden rounded-media border border-hair ${i > 0 ? "mt-4" : ""} ${i === 1 ? "-translate-x-10" : ""}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
          <img
            src={p.poster ?? undefined}
            alt=""
            className="aspect-video w-full object-cover brightness-[0.5] saturate-[0.7]"
          />
        </div>
      ))}
      {/* fade the strip into the canvas so it reads ambient, not UI */}
      <div className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/40 to-transparent" />
    </div>
  );
}

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
      <Filmstrip />

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

          {/* what happens after you book */}
          <RevealItem className="mt-14 max-w-2xl border-t border-hair pt-8">
            <ol className="grid gap-6 sm:grid-cols-3">
              {home.closing.steps.map((step, i) => (
                <li key={step.title}>
                  <p className="font-mono text-label uppercase text-green">
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <p className="mt-2 font-display text-[1.0625rem] font-semibold text-ink">
                    {step.title}
                  </p>
                  <p className="mt-1 text-sm text-muted">{step.line}</p>
                </li>
              ))}
            </ol>
          </RevealItem>
        </Reveal>
      </div>

      {/* the brand moment before the footer */}
      <p
        aria-hidden="true"
        className="pointer-events-none select-none whitespace-nowrap text-center font-display text-[13vw] font-bold leading-[0.8] tracking-tight text-ink opacity-[0.04]"
      >
        GHL VIDEO
      </p>
    </section>
  );
}
