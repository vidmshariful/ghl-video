"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Button } from "@/components/Button";
import { DrawnIcon, type IconName } from "@/components/DrawnIcon";
import { MediaFrame } from "@/components/MediaFrame";
import { ProcessArt, type ArtName } from "@/components/pages/ProcessArt";
import { SectionChip } from "@/components/SectionChip";
import { SectionGlow } from "@/components/SectionGlow";

gsap.registerPlugin(ScrollTrigger);

/*
 * The process, split like a working session: the pitch on the left (chip,
 * headline, one line of intro, the CTA, and the walkthrough video), the
 * steps on the right as a vertical rail. The rail's track is a dashed
 * hairline that gets inked in gold-to-green as the reader scrolls; each
 * step's icon node and card light up while the reader is on it. The left
 * column pins on large screens so the pitch and video stay in view while
 * the steps pass.
 *
 * SSR renders the whole sequence (crawlable, readable with no JS); GSAP
 * only enhances. Under prefers-reduced-motion the track is fully inked
 * and every step reads as active. Steps are numbered because the order
 * is real: this is the actual delivery sequence.
 */
export function ProcessSection({
  bpIdx,
  chip,
  headline,
  accent,
  intro,
  cta,
  video,
  steps,
  icons,
  arts,
  glow = "right",
}: {
  bpIdx: number;
  chip: string;
  headline: string;
  accent: string;
  intro: string;
  cta: { label: string; href: string };
  video: { src: string; poster: string | null; label: string };
  steps: readonly { title: string; line: string }[];
  icons: readonly IconName[];
  arts: readonly ArtName[];
  glow?: "left" | "right";
}) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const setStep = (el: Element, on: boolean) => {
        const node = el.querySelector<HTMLElement>(".ps-node");
        const card = el.querySelector<HTMLElement>(".ps-card");
        const label = el.querySelector<HTMLElement>(".ps-label");
        if (node) {
          node.style.borderColor = on ? "var(--gold)" : "var(--hair)";
          node.style.color = on ? "var(--gold)" : "var(--dim)";
          node.style.boxShadow = on
            ? "0 0 18px -2px rgba(252,192,0,0.55)"
            : "none";
        }
        if (card) {
          card.style.borderColor = on ? "rgba(252,192,0,0.35)" : "var(--hair)";
          card.style.opacity = on ? "1" : "0.72";
        }
        if (label) label.style.color = on ? "var(--gold)" : "var(--dim)";
      };

      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(".ps-fill", { scaleY: 1 });
        root.current
          ?.querySelectorAll(".ps-step")
          .forEach((el) => setStep(el, true));
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.set(".ps-fill", { scaleY: 0 });
        gsap.to(".ps-fill", {
          scaleY: 1,
          ease: "none",
          scrollTrigger: {
            trigger: ".ps-track",
            start: "top 60%",
            end: "bottom 60%",
            scrub: 0.6,
          },
        });
        gsap.utils.toArray<HTMLElement>(".ps-step").forEach((el) => {
          ScrollTrigger.create({
            trigger: el,
            start: "top 62%",
            end: "bottom 62%",
            onToggle: (self) => setStep(el, self.isActive),
          });
        });
      });
    },
    { scope: root },
  );

  return (
    <section data-bp-idx={bpIdx} className="relative overflow-x-clip section-pad">
      <SectionGlow position={glow} />
      <div className="shell relative">
        <div
          ref={root}
          className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.1fr)] lg:gap-0"
        >
          {/* the pitch: pinned beside the rail on large screens */}
          <div className="lg:sticky lg:top-28 lg:self-start lg:pr-12">
            <SectionChip label={chip} />
            <h2 className="mt-6 max-w-[16ch] font-display text-h2 text-ink">
              {headline}{" "}
              <span className="text-gradient">{accent}</span>
            </h2>
            <p className="mt-5 max-w-[var(--measure-body)] text-body leading-relaxed text-muted">
              {intro}
            </p>
            <div className="mt-8">
              <Button href={cta.href} size="md">
                {cta.label}
              </Button>
            </div>
            {/* the walkthrough, playing under the pitch */}
            <div className="mt-9">
              <MediaFrame
                src={video.src}
                poster={video.poster}
                label={video.label}
                caption={{ title: video.label }}
              />
            </div>
          </div>

          {/* hatched gutter: the same drafting-table seam as the hero */}
          <div
            aria-hidden="true"
            className="hatch hidden w-6 border-x border-hair lg:block"
          />

          {/* the rail: dashed track, inked by scroll, one node per step */}
          <div className="relative lg:pl-12">
            <div
              aria-hidden="true"
              className="ps-track pointer-events-none absolute bottom-10 left-[22px] top-10 w-px border-l border-dashed border-hair lg:left-[70px]"
            >
              <span
                className="ps-fill absolute inset-y-0 -left-px w-px origin-top"
                style={{
                  background:
                    "linear-gradient(180deg, var(--gold), var(--green))",
                }}
              />
            </div>
            <ol className="space-y-6 md:space-y-7">
              {steps.map((s, i) => (
                <li key={s.title} className="ps-step relative pl-16 md:pl-[72px]">
                  <span className="ps-node absolute left-0 top-6 flex h-11 w-11 items-center justify-center rounded-full border border-hair bg-surface text-dim transition-all duration-300">
                    <DrawnIcon name={icons[i]} size={20} />
                  </span>
                  <div className="ps-card rounded-card border border-hair card-glass p-6 transition-all duration-300 md:p-7">
                    <p className="ps-label font-mono text-label uppercase text-dim transition-colors duration-300">
                      Step / {String(i + 1).padStart(2, "0")}
                    </p>
                    <h3 className="mt-3 font-display text-h3 text-ink">
                      {s.title}
                    </h3>
                    <p className="mt-2 max-w-[var(--measure-body)] text-body leading-relaxed text-muted">
                      {s.line}
                    </p>
                    {/* the step drawn as a scene, in the blueprint voice;
                        capped small so the card stays tight */}
                    <div className="mt-5 overflow-hidden rounded-card border border-hair bg-canvas/50 px-2 py-1.5">
                      <ProcessArt name={arts[i]} className="mx-auto max-w-[300px]" />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
