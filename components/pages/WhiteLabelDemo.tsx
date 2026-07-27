"use client";

import { useState } from "react";
import { MediaFrame } from "@/components/MediaFrame";

/*
 * The white-label proof: the same video, two states. A segmented toggle
 * (the bundle-tab control) flips the frame between the HighLevel
 * default cut and the branded cut, so "your logo on every frame" is
 * something the buyer does, not something they read. The frame remounts
 * per cut (keyed) so playback starts clean on every flip.
 */
type Cut = { src: string; poster: string | null };

export function WhiteLabelDemo({
  defaultCut,
  brandedCut,
}: {
  defaultCut: Cut;
  brandedCut: Cut;
}) {
  const [state, setState] = useState<"default" | "branded">("default");
  const cut = state === "default" ? defaultCut : brandedCut;
  const opts = [
    ["default", "HighLevel default"],
    ["branded", "Branded to you"],
  ] as const;

  return (
    <div>
      <div
        role="tablist"
        aria-label="White-label state"
        className="mx-auto flex w-fit flex-wrap justify-center gap-1 rounded-[4px] border border-hair bg-surface/60 p-1"
      >
        {opts.map(([key, label]) => {
          const active = state === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setState(key)}
              className={`tap rounded-[3px] px-4 py-2 font-mono text-label uppercase transition-colors ${
                active
                  ? "bg-gold/15 font-semibold text-gold"
                  : "text-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="mt-6">
        <MediaFrame
          key={state}
          src={cut.src}
          poster={cut.poster}
          label={
            state === "default"
              ? "The video as HighLevel ships it"
              : "The same video, branded to your SaaS"
          }
          caption={{
            title:
              state === "default" ? "HighLevel default" : "Branded to you",
          }}
        />
      </div>
    </div>
  );
}
