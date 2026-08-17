"use client";

import { useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Button } from "@/components/Button";
import { home, cta } from "@/lib/site";

gsap.registerPlugin(ScrollTrigger);

/* GSAP tweens concrete colours, not var(), so these used to be three hex
 * literals copied from globals.css. Copies go stale: a reskin moved --dim
 * and this animation kept the old grey. Read the resolved values instead,
 * lazily on first use so it happens in the browser with the tokens applied
 * (and inside whatever surface the component is mounted on). */
function tokens() {
  const s = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    s.getPropertyValue(name).trim() || fallback;
  return {
    DIM: read("--dim", "#7d8499"),
    INK: read("--text", "#EEF0F6"),
    GOLD: read("--gold", "#FCC000"),
  };
}

/*
 * About GHL Video: one large, centred positioning statement that colours
 * in word by word as it scrolls through view (the "built only for
 * HighLevel" phrase settling on gold), then a single CTA into the premade
 * library. No box, no counterweight. Reduced motion shows it fully lit.
 */
export function Manifesto() {
  const { manifesto } = home;
  const root = useRef<HTMLDivElement>(null);

  const emphStart = manifesto.statement.indexOf(manifesto.emphasis);
  const emphEnd =
    emphStart >= 0 ? emphStart + manifesto.emphasis.length : -1;

  /* Tokenise the WHOLE statement on spaces so punctuation stays welded to
     its word. A token is emphasised when it begins inside the emphasis
     character range, so its trailing punctuation rides along in gold. */
  const words: ReactNode[] = [];
  let key = 0;
  let cursor = 0;
  for (const w of manifesto.statement.split(" ")) {
    const emph = emphStart >= 0 && cursor >= emphStart && cursor < emphEnd;
    words.push(
      <span key={key++} className="mf-word" data-emph={emph ? "" : undefined}>
        {w}
      </span>,
    );
    words.push(<span key={key++}> </span>);
    cursor += w.length + 1;
  }

  useGSAP(
    () => {
      const els = gsap.utils.toArray<HTMLElement>(".mf-word");
      const { DIM, INK, GOLD } = tokens();
      const lit = (el: HTMLElement) =>
        el.dataset.emph !== undefined ? GOLD : INK;

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        els.forEach((el) => (el.style.color = lit(el)));
        return;
      }

      gsap.fromTo(
        els,
        { color: DIM },
        {
          color: (_i: number, el: HTMLElement) => lit(el),
          ease: "none",
          stagger: 0.4,
          scrollTrigger: {
            trigger: root.current,
            start: "top 80%",
            end: "bottom 66%",
            scrub: 0.4,
          },
        },
      );
    },
    { scope: root },
  );

  return (
    <section className="relative overflow-x-clip section-pad">
      <div
        ref={root}
        className="shell relative flex flex-col items-center text-center"
      >
        <p className="mx-auto max-w-[24ch] font-display text-[clamp(1.75rem,3.6vw,3rem)] font-semibold leading-[1.16] tracking-tight text-dim sm:max-w-[34ch] lg:max-w-[44ch]">
          {words}
        </p>
        <div className="mt-10">
          <Button href={cta.seePremade.href} variant="primary">
            {cta.seePremade.label}
          </Button>
        </div>
      </div>
    </section>
  );
}
