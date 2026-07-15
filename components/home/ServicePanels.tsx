import Link from "next/link";
import { Checklist } from "@/components/Checklist";
import { MediaFrame } from "@/components/MediaFrame";
import { Panel } from "@/components/Panel";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionChip } from "@/components/SectionChip";
import { SectionGlow } from "@/components/SectionGlow";
import { home, clips, posters, clipWindows } from "@/lib/site";
import type { Accent } from "@/components/Eyebrow";

/*
 * The three services as named product panels, alternating direction,
 * each a bounded card: copy plus checklist one side, graded media the
 * other. Replaces the bento. No prices on the homepage; the panels
 * route to the service pages.
 */

export function ServicePanels() {
  const { services } = home;
  return (
    <section data-bp-idx="2" aria-labelledby="services-heading" className="relative overflow-x-clip section-pad">
      <SectionGlow position="right" />
      <div className="shell relative">
        <Reveal className="text-center">
          <RevealItem>
            <SectionChip index={2} label={services.chip} />
            <h2 id="services-heading" className="mx-auto mt-6 max-w-[18ch] font-display text-h2 text-ink">
              {services.headline}{" "}
              <span className="text-gradient">{services.accent}</span>
            </h2>
            <p className="mx-auto mt-4 max-w-[var(--measure-lede)] text-lede text-muted">
              {services.intro}
            </p>
          </RevealItem>
        </Reveal>

        {/* the cards stack: each pins below the header and the next
            slides over it, previous crowns peeking above */}
        <div className="mt-14 flex flex-col gap-6">
          {services.panels.map((panel, i) => {
            /* media and copy are DIRECT grid children so both stretch
               to the row height; sides alternate via order utilities */
            const flip = i % 2 === 1;
            const media = (
              <div
                className={`relative min-h-[15rem] p-3 lg:min-h-0 ${flip ? "lg:order-1" : ""}`}
              >
                <MediaFrame
                  src={clips[panel.mediaKey as keyof typeof clips]}
                  poster={posters[panel.mediaKey as keyof typeof posters]}
                  label={`${panel.name} sample`}
                  tint
                  groupEase
                  {...(clipWindows[panel.mediaKey as keyof typeof clips] ?? {})}
                  className="!absolute inset-3 h-auto !aspect-auto"
                />
              </div>
            );
            const copy = (
              <div className={`p-8 md:p-12 ${flip ? "lg:order-2" : ""}`}>
                <p
                  className={"font-mono text-label uppercase text-gold"}
                >
                  {panel.name}
                </p>
                <h3 className="mt-4 max-w-[24ch] font-display text-[clamp(1.5rem,2.4vw,2rem)] font-semibold leading-tight tracking-tight text-ink">
                  {panel.title}
                </h3>
                <p className="mt-4 max-w-[var(--measure-body)] text-body leading-relaxed text-muted">
                  {panel.body}
                </p>
                <Checklist
                  items={panel.checklist}
                  className="mt-7 max-w-md"
                />
                <Link
                  href={panel.href}
                  className={`group mt-8 inline-flex items-center gap-2 text-body font-semibold text-gold`}
                >
                  {panel.linkLabel}
                  <span
                    aria-hidden="true"
                    className="transition-transform duration-200 group-hover:translate-x-1"
                  >
                    &rarr;
                  </span>
                </Link>
              </div>
            );
            return (
              <div
                key={panel.name}
                className="lg:sticky"
                style={{ top: `${88 + i * 28}px` }}
              >
                <Reveal>
                  <RevealItem>
                    <Panel
                      solid
                      className={`group/svc overflow-hidden transition-colors duration-300 hover:border-gold/40`}
                    >
                      {/* the signature, moving: animated gradient hairline */}
                      <div
                        aria-hidden="true"
                        className="grad-line absolute inset-x-0 top-0 z-10 h-px"
                      />
                      {/* service index within the numbered section */}
                      <span
                        aria-hidden="true"
                        className="absolute right-5 top-4 z-10 font-mono text-label uppercase text-dim"
                      >
                        S/{String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="grid lg:grid-cols-2">
                        {copy}
                        {media}
                      </div>
                    </Panel>
                  </RevealItem>
                </Reveal>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
