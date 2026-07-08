import { Panel } from "@/components/Panel";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionChip } from "@/components/SectionChip";
import { SectionGlow } from "@/components/SectionGlow";
import { home } from "@/lib/site";

/*
 * Head-to-head inside one bounded panel: label spine on the left,
 * Everyone-else column muted, the GHL Video column carried on a faint
 * gold wash so the winner reads at a glance. The whole table reveals
 * as ONE group so fast scrollers and print never see missing rows.
 */
export function Comparison() {
  const { comparison } = home;
  return (
    <section aria-labelledby="comparison-heading" className="relative overflow-hidden section-pad border-t border-hair">
      <SectionGlow accent="gold" position="left" />
      <div className="shell relative">
        <Reveal>
          <RevealItem>
            <SectionChip index={4} label={comparison.eyebrow} />
            <h2 id="comparison-heading" className="mt-6 max-w-[22ch] font-display text-h2 text-ink">
              {comparison.headline}
            </h2>
            <p className="mt-4 max-w-[52ch] text-lede text-muted">
              {comparison.intro}
            </p>
          </RevealItem>

          <RevealItem className="mt-12">
            <Panel className="overflow-hidden">
              {/* mobile header row so the two columns stay labeled */}
              <div className="grid grid-cols-2 gap-4 border-b border-hair px-5 py-4 md:hidden">
                <p className="font-mono text-label uppercase text-dim">
                  {comparison.othersLabel}
                </p>
                <p className="font-mono text-label uppercase text-gold">
                  {comparison.usLabel}
                </p>
              </div>
              {/* header row */}
              <div className="hidden grid-cols-[9rem_1fr_1fr] border-b border-hair md:grid">
                <span />
                <p className="px-6 py-4 font-mono text-label uppercase text-dim">
                  {comparison.othersLabel}
                </p>
                <p className="border-l border-hair bg-gold/[0.04] px-6 py-4 font-mono text-label uppercase text-gold">
                  {comparison.usLabel}
                </p>
              </div>

              {comparison.rows.map((row, i) => (
                <div key={row.label}>
                  {/* desktop */}
                  <div
                    className={`hidden grid-cols-[9rem_1fr_1fr] md:grid ${
                      i > 0 ? "border-t border-hair" : ""
                    }`}
                  >
                    <p className="px-5 py-5 font-mono text-label uppercase text-dim">
                      {row.label}
                    </p>
                    <p className="px-6 py-5 text-[0.9375rem] text-muted">
                      {row.others}
                    </p>
                    <p className="border-l border-hair bg-gold/[0.04] px-6 py-5 text-[0.9375rem] font-medium text-ink">
                      {row.us}
                    </p>
                  </div>
                  {/* mobile */}
                  <div
                    className={`px-5 py-5 md:hidden ${i > 0 ? "border-t border-hair" : ""}`}
                  >
                    <p className="font-mono text-label uppercase text-dim">
                      {row.label}
                    </p>
                    <div className="mt-2.5 grid grid-cols-2 gap-4">
                      <p className="text-sm text-muted">{row.others}</p>
                      <p className="-mx-2 -my-1 rounded-[4px] bg-gold/[0.05] px-2 py-1 text-sm font-medium text-ink">
                        {row.us}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </Panel>
          </RevealItem>
        </Reveal>
      </div>
    </section>
  );
}
