import { Eyebrow } from "@/components/Eyebrow";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionGlow } from "@/components/SectionGlow";
import { home } from "@/lib/site";

/*
 * Head-to-head contrast in the hairline editorial style: no checkmark
 * table, no icons. Desktop puts the shared mono label down the middle,
 * everyone-else right-aligned and muted on the left, GHL Video in ink
 * on the right. Gold leads the section. Mobile stacks each row under
 * its label in two columns.
 */
export function Comparison() {
  const { comparison } = home;
  return (
    <section className="relative overflow-hidden section-pad border-t border-hair">
      <SectionGlow accent="gold" position="left" />
      <div className="shell relative">
        <Reveal>
          <RevealItem>
            <Eyebrow accent="gold">{comparison.eyebrow}</Eyebrow>
            <h2 className="mt-4 max-w-[22ch] font-display text-h2 text-ink">
              {comparison.headline}
            </h2>
            <p className="mt-4 max-w-[52ch] text-lede text-muted">
              {comparison.intro}
            </p>
          </RevealItem>
        </Reveal>

        <Reveal className="mt-14">
          {/* column headers */}
          <RevealItem>
            {/* desktop */}
            <div className="hidden grid-cols-[1fr_11rem_1fr] items-baseline gap-6 border-b border-hair pb-4 md:grid">
              <p className="text-right font-mono text-label uppercase text-dim">
                {comparison.othersLabel}
              </p>
              <span />
              <p className="font-mono text-label uppercase text-gold">
                {comparison.usLabel}
              </p>
            </div>
            {/* mobile */}
            <div className="grid grid-cols-2 gap-4 border-b border-hair pb-4 md:hidden">
              <p className="font-mono text-label uppercase text-dim">
                {comparison.othersLabel}
              </p>
              <p className="font-mono text-label uppercase text-gold">
                {comparison.usLabel}
              </p>
            </div>
          </RevealItem>

          {comparison.rows.map((row) => (
            <RevealItem key={row.label} className="border-b border-hair">
              {/* desktop: others / label / us */}
              <div className="hidden grid-cols-[1fr_11rem_1fr] items-baseline gap-6 py-5 md:grid">
                <p className="text-right text-[0.9375rem] text-muted">
                  {row.others}
                </p>
                <p className="text-center font-mono text-label uppercase text-dim">
                  {row.label}
                </p>
                <p className="text-[0.9375rem] font-medium text-ink">
                  {row.us}
                </p>
              </div>
              {/* mobile: label above, two columns under */}
              <div className="py-5 md:hidden">
                <p className="font-mono text-label uppercase text-dim">
                  {row.label}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-4">
                  <p className="text-sm text-muted">{row.others}</p>
                  <p className="text-sm font-medium text-ink">{row.us}</p>
                </div>
              </div>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
