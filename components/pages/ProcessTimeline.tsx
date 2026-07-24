"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { DrawnIcon, type IconName } from "@/components/DrawnIcon";

gsap.registerPlugin(ScrollTrigger);

/*
 * A connected process timeline. A hairline spine runs down the left rail;
 * its gold-to-green fill scrubs with the scrollbar, and each step's node
 * (with the step number inside it) lights up as it is passed. Each step is
 * a full-width two-column row: the copy on the left, a visual slot on the
 * right (placeholder now: the step's drawn icon over a soft glow + hatch;
 * swap in a real screenshot or clip per step later). SSR renders the whole
 * sequence, so it is crawlable and readable with no JS. Under
 * prefers-reduced-motion the spine is drawn full and every node lit.
 */
export function ProcessTimeline({
  steps,
  icons,
}: {
  steps: readonly { title: string; line: string }[];
  icons: readonly IconName[];
}) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const setNode = (el: Element, on: boolean) => {
        const ring = el.querySelector<HTMLElement>(".tl-ring");
        const num = el.querySelector<HTMLElement>(".tl-num");
        if (ring) {
          ring.style.borderColor = on ? "var(--gold)" : "var(--hair)";
          ring.style.boxShadow = on
            ? "0 0 18px -2px rgba(252,192,0,0.55)"
            : "none";
        }
        if (num) num.style.color = on ? "var(--gold)" : "var(--dim)";
      };

      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(".tl-fill", { scaleY: 1 });
        root.current
          ?.querySelectorAll(".tl-step")
          .forEach((el) => setNode(el, true));
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.set(".tl-fill", { scaleY: 0 });
        gsap.to(".tl-fill", {
          scaleY: 1,
          ease: "none",
          scrollTrigger: {
            trigger: ".tl-track",
            start: "top 60%",
            end: "bottom 60%",
            scrub: 0.6,
          },
        });
        gsap.utils.toArray<HTMLElement>(".tl-step").forEach((el) => {
          ScrollTrigger.create({
            trigger: el,
            start: "top 60%",
            end: "bottom 60%",
            onToggle: (self) => setNode(el, self.isActive),
          });
        });
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className="relative">
      {/* the spine: hairline track + a gold-to-green fill that grows on scroll */}
      <div className="tl-track pointer-events-none absolute left-[27px] top-8 bottom-8 w-px bg-hair md:left-[31px]">
        <span
          className="tl-fill absolute inset-x-0 top-0 h-full origin-top"
          style={{ background: "linear-gradient(180deg, var(--gold), var(--green))" }}
        />
      </div>
      <ol className="space-y-8 md:space-y-10">
        {steps.map((s, i) => (
          <li
            key={s.title}
            className="tl-step relative grid grid-cols-1 items-center gap-6 pl-[72px] md:grid-cols-2 md:gap-12 md:pl-[84px]"
          >
            {/* node with the step number inside it */}
            <span className="tl-ring absolute left-0 top-1 flex h-[54px] w-[54px] items-center justify-center rounded-full border border-hair bg-surface transition-all duration-300 md:h-16 md:w-16">
              <span className="tl-num font-mono text-label uppercase text-dim transition-colors duration-300">
                {String(i + 1).padStart(2, "0")}
              </span>
            </span>

            {/* copy */}
            <div>
              <h3 className="font-display text-h3 text-ink">{s.title}</h3>
              <p className="mt-2 max-w-[var(--measure-body)] text-body leading-relaxed text-muted">
                {s.line}
              </p>
            </div>

            {/* visual slot (placeholder) */}
            <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden rounded-card border border-hair bg-canvas">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-60"
                style={{
                  background:
                    "radial-gradient(120% 100% at 50% 135%, var(--glow-gold), transparent 62%)",
                }}
              />
              <span
                aria-hidden="true"
                className="hatch pointer-events-none absolute inset-0 opacity-[0.12]"
              />
              <span className="relative text-gold">
                <DrawnIcon name={icons[i]} size={46} />
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
