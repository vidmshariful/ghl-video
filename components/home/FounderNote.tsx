import { Panel } from "@/components/Panel";
import { DrawnBorder } from "@/components/DrawnBorder";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionChip } from "@/components/SectionChip";
import { home } from "@/lib/site";

/*
 * The founder, face and voice, in a bounded panel: photo left with a
 * gold crown line, statement at display scale right. The line is a
 * DRAFT until Shariful sends the final wording.
 */
export function FounderNote() {
  const { founder } = home;
  return (
    <section data-bp-idx="9" aria-label="Founder note" className="relative section-pad-sm">
      <DrawnBorder />
      <div className="shell">
        <Reveal>
          <RevealItem className="mb-8">
            <SectionChip index={9} label="Founder" />
          </RevealItem>
          <RevealItem>
            <Panel className="overflow-hidden">
              <div className="grid md:grid-cols-[16rem_1fr]">
                <div className="relative">
                  <div aria-hidden="true" className="grad-line absolute inset-x-0 top-0 z-10 h-px" />
                  {founder.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- static export
                    <img
                      src={founder.photo}
                      width={500}
                      height={600}
                      alt={founder.name}
                      className="h-56 w-full object-cover object-top md:h-full"
                    />
                  ) : (
                    <div className="h-56 w-full bg-card md:h-full" />
                  )}
                </div>
                <div className="flex flex-col justify-center p-8 md:p-12">
                  <p className="max-w-[44ch] font-display text-[clamp(1.25rem,2vw,1.625rem)] font-semibold leading-[1.35] tracking-tight text-ink">
                    {founder.line}
                  </p>
                  <p className="mt-6 font-mono text-label uppercase">
                    <span className="text-ink">{founder.name}</span>
                    <span className="text-dim"> / {founder.role}</span>
                  </p>
                </div>
              </div>
            </Panel>
          </RevealItem>
        </Reveal>
      </div>
    </section>
  );
}
