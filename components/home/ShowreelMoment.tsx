"use client";

import { useRef, useState } from "react";
import { Eyebrow } from "@/components/Eyebrow";
import { Reveal, RevealItem } from "@/components/Reveal";
import { ReelPlaceholder } from "@/components/ReelPlaceholder";
import { home } from "@/lib/site";

/*
 * One larger featured piece, off-center: media spans 8 columns, the
 * mono spec column sits right. Click to play once the real asset lands;
 * until then the panel holds the ambient placeholder.
 */
export function ShowreelMoment() {
  const { featuredWork } = home;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  return (
    <section className="section-pad pt-0">
      <div className="shell">
        <Reveal className="grid items-end gap-10 lg:grid-cols-12">
          <RevealItem className="lg:col-span-8">
            <Eyebrow accent="green">{featuredWork.eyebrow}</Eyebrow>
            <div className="relative mt-6 aspect-video overflow-hidden rounded-card border border-hair">
              {featuredWork.src ? (
                <>
                  <video
                    ref={videoRef}
                    className="absolute inset-0 h-full w-full object-cover"
                    src={featuredWork.src}
                    poster={featuredWork.poster ?? undefined}
                    playsInline
                    onEnded={() => setPlaying(false)}
                  />
                  <button
                    type="button"
                    onClick={toggle}
                    aria-label={playing ? "Pause showreel" : "Play showreel"}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    {!playing && (
                      <span className="flex h-16 w-16 items-center justify-center rounded-full border border-hair bg-canvas/70 backdrop-blur transition-transform duration-200 hover:scale-105">
                        <svg
                          viewBox="0 0 16 16"
                          className="ml-0.5 h-5 w-5"
                          aria-hidden="true"
                        >
                          <path d="M3 1.8v12.4L14 8 3 1.8Z" fill="#00CC00" />
                        </svg>
                      </span>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <ReelPlaceholder />
                  <span className="absolute bottom-4 left-5 font-mono text-label uppercase text-dim">
                    Showreel
                  </span>
                </>
              )}
            </div>
          </RevealItem>

          <RevealItem className="lg:col-span-4">
            <dl className="flex flex-col border-t border-hair">
              {[
                ["Client", featuredWork.client],
                ["Format", featuredWork.format],
                ["White label", featuredWork.whiteLabel],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-baseline justify-between gap-6 border-b border-hair py-4"
                >
                  <dt className="font-mono text-label uppercase text-dim">
                    {k}
                  </dt>
                  <dd className="text-right font-mono text-sm text-ink">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </RevealItem>
        </Reveal>
      </div>
    </section>
  );
}
