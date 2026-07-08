import Link from "next/link";
import { Checklist } from "@/components/Checklist";
import { MediaFrame } from "@/components/MediaFrame";
import { Panel } from "@/components/Panel";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionChip } from "@/components/SectionChip";
import { SectionGlow } from "@/components/SectionGlow";
import { home, clips, posters } from "@/lib/site";
import type { Accent } from "@/components/Eyebrow";

/*
 * The three services as named product panels, alternating direction,
 * each a bounded card: copy plus checklist one side, graded media the
 * other. Replaces the bento. No prices on the homepage; the panels
 * route to the service pages.
 */

const accentText: Record<Exclude<Accent, "muted">, string> = {
  gold: "text-gold",
  green: "text-green",
  blue: "text-blue",
};

export function ServicePanels() {
  const { services } = home;
  return (
    <section className="relative overflow-hidden section-pad">
      <SectionGlow accent="green" position="right" />
      <div className="shell relative">
        <Reveal className="text-center">
          <RevealItem>
            <SectionChip index={2} label={services.chip} accent="green" />
            <h2 className="mx-auto mt-6 max-w-[18ch] font-display text-h2 text-ink">
              {services.headline}{" "}
              <span className="text-green">{services.accent}</span>
            </h2>
            <p className="mx-auto mt-4 max-w-[52ch] text-lede text-muted">
              {services.intro}
            </p>
          </RevealItem>
        </Reveal>

        <div className="mt-14 flex flex-col gap-6">
          {services.panels.map((panel, i) => {
            const media = (
              <div className="relative min-h-[15rem] p-3 lg:min-h-0">
                <MediaFrame
                  src={clips[panel.mediaKey as keyof typeof clips]}
                  poster={posters[panel.mediaKey as keyof typeof posters]}
                  label={`${panel.name} sample`}
                  className="!absolute inset-3 h-auto !aspect-auto"
                />
              </div>
            );
            const copy = (
              <div className="p-8 md:p-12">
                <p
                  className={`font-mono text-label uppercase ${accentText[panel.accent as keyof typeof accentText]}`}
                >
                  {panel.name}
                </p>
                <h3 className="mt-4 max-w-[24ch] font-display text-[clamp(1.5rem,2.4vw,2rem)] font-semibold leading-tight tracking-tight text-ink">
                  {panel.title}
                </h3>
                <p className="mt-4 max-w-[52ch] text-sm leading-relaxed text-muted">
                  {panel.body}
                </p>
                <Checklist items={panel.checklist} className="mt-7 max-w-md" />
                <Link
                  href={panel.href}
                  className={`group mt-8 inline-flex items-center gap-2 text-sm font-semibold ${accentText[panel.accent as keyof typeof accentText]}`}
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
              <Reveal key={panel.name}>
                <RevealItem>
                  <Panel className="overflow-hidden">
                    <div className="grid lg:grid-cols-2">
                      {i % 2 === 0 ? (
                        <>
                          {copy}
                          {media}
                        </>
                      ) : (
                        <>
                          <div className="order-2 lg:order-1">{media}</div>
                          <div className="order-1 lg:order-2">{copy}</div>
                        </>
                      )}
                    </div>
                  </Panel>
                </RevealItem>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
