import Link from "next/link";
import { Eyebrow } from "@/components/Eyebrow";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionGlow } from "@/components/SectionGlow";
import { home } from "@/lib/site";

/*
 * The two ICPs see themselves. Asymmetric 7/5 split; the reseller panel
 * carries the gradient edge, the creator panel carries blue, matching
 * the accent ledger.
 */
export function AudienceSplit() {
  const { audiences } = home;
  return (
    <section className="relative overflow-hidden section-pad pt-0">
      <SectionGlow accent="blue" position="right" />
      <div className="shell relative">
        <Reveal>
          <RevealItem>
            <Eyebrow accent="muted">{audiences.eyebrow}</Eyebrow>
            <h2 className="mt-4 max-w-[16ch] font-display text-h2 text-ink">
              Which one are you?
            </h2>
          </RevealItem>
        </Reveal>

        <Reveal className="mt-10 grid gap-4 lg:grid-cols-12">
          <RevealItem className="lg:col-span-7">
            <div className="h-full overflow-hidden rounded-card border border-hair card-glass">
              <div className="h-[3px] bg-brand-gradient" />
              <div className="p-8 md:p-10">
                <Eyebrow accent="gold">{audiences.resellers.label}</Eyebrow>
                <h3 className="mt-4 max-w-[20ch] font-display text-h3 text-ink">
                  {audiences.resellers.title}
                </h3>
                <p className="mt-3 max-w-[var(--measure-body)] text-body leading-relaxed text-muted">
                  {audiences.resellers.body}
                </p>
                <div className="mt-8 flex flex-wrap gap-6">
                  {audiences.resellers.links.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="group inline-flex items-center gap-2 text-body font-semibold text-green"
                    >
                      {l.label}
                      <span
                        aria-hidden="true"
                        className="transition-transform duration-200 group-hover:translate-x-1"
                      >
                        &rarr;
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </RevealItem>

          <RevealItem className="lg:col-span-5">
            <div className="h-full overflow-hidden rounded-card border border-hair card-glass">
              <div className="h-[3px] bg-blue" />
              <div className="p-8 md:p-10">
                <Eyebrow accent="blue">{audiences.creators.label}</Eyebrow>
                <h3 className="mt-4 max-w-[16ch] font-display text-h3 text-ink">
                  {audiences.creators.title}
                </h3>
                <p className="mt-3 text-body leading-relaxed text-muted">
                  {audiences.creators.body}
                </p>
                <div className="mt-8">
                  {audiences.creators.links.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="group inline-flex items-center gap-2 text-body font-semibold text-blue"
                    >
                      {l.label}
                      <span
                        aria-hidden="true"
                        className="transition-transform duration-200 group-hover:translate-x-1"
                      >
                        &rarr;
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </RevealItem>
        </Reveal>
      </div>
    </section>
  );
}
