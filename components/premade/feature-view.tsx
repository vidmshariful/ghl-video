"use client";

import Link from "next/link";
import { useState } from "react";
import { cta, featureAnimations, skuFor } from "@/lib/site";
import { type Version } from "./catalog";
import { featurePacks } from "./catalog";
import { VersionToggle } from "./cards";

/* ---------------------------------------------------------------- */
/* Feature animations: a two-cut playlist over the pack pricing        */
/* ---------------------------------------------------------------- */

export function FeatureAnimationView() {
  const [idx, setIdx] = useState(0);
  const [version, setVersion] = useState<Version>("simplified");
  const feat = featureAnimations[idx];
  const hasReal = Boolean(feat.real);
  const src = version === "real" && feat.real ? feat.real : feat.simplified;
  const poster =
    version === "real" && feat.real ? feat.thumbReal : feat.thumbSimplified;

  return (
    <div>
      {/* what this is */}
      <div className="border-b border-hair px-5 py-6 md:px-7">
        <p className="font-display text-h3 text-ink">Feature Animations</p>
        <p className="mt-1.5 max-w-[var(--measure-body)] text-body leading-relaxed text-muted">
          Every HighLevel feature as a short animation, in two cuts: a clean
          Simplified UI and the Real UI on the live dashboard. Sold in bundles,
          branded to your platform.
        </p>
      </div>

      {/* playlist: preview left, list right */}
      <div className="grid lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 border-b border-hair lg:border-b-0 lg:border-r">
          <div className="flex min-h-[3rem] flex-wrap items-center justify-between gap-3 border-b border-hair bg-surface px-5 py-2">
            <p className="font-mono text-label uppercase text-dim">
              [ {feat.name} ]
            </p>
            {hasReal ? (
              <VersionToggle version={version} onChange={setVersion} />
            ) : (
              <span className="font-mono text-label uppercase text-dim">
                Simplified UI only
              </span>
            )}
          </div>
          <div className="p-5 md:p-7">
            <video
              key={src}
              src={src}
              poster={poster}
              controls
              autoPlay
              muted
              playsInline
              className="aspect-video w-full border border-hair bg-black"
            />
          </div>
        </div>

        <div
          role="listbox"
          aria-label="Feature animations"
          aria-activedescendant={`fa-opt-${idx}`}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIdx((i) => Math.min(i + 1, featureAnimations.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIdx((i) => Math.max(i - 1, 0));
            }
          }}
          className="lg:relative focus-visible:outline-2"
        >
          {/* absolute-fill on desktop so the player sets the height and
              the list scrolls inside it, not the other way around */}
          <div className="flex h-full flex-col lg:absolute lg:inset-0">
          <p className="flex min-h-[3rem] shrink-0 items-center border-b border-hair bg-surface px-5 py-2 font-mono text-label uppercase text-dim">
            <span>
              {featureAnimations.length} animations{" "}
              <span className="hidden lg:inline">/ use &uarr; &darr; keys</span>
            </span>
          </p>
          <div className="max-h-[26rem] flex-1 overflow-y-auto min-h-0 lg:max-h-none">
            {featureAnimations.map((f, i) => (
              <button
                key={f.slug}
                id={`fa-opt-${i}`}
                type="button"
                role="option"
                aria-selected={i === idx}
                onClick={() => setIdx(i)}
                className={`flex w-full items-baseline gap-3 border-b border-hair px-5 py-3.5 text-left transition-colors last:border-b-0 ${
                  i === idx
                    ? "border-l-2 border-l-gold bg-surface"
                    : "border-l-2 border-l-transparent hover:bg-surface/60"
                }`}
              >
                <span
                  className={`font-mono text-label [font-variant-numeric:tabular-nums] ${
                    i === idx ? "text-gold" : "text-dim"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-body font-medium leading-snug ${
                      i === idx ? "text-ink" : "text-muted"
                    }`}
                  >
                    {f.name}
                  </span>
                  <span className="mt-0.5 block font-mono text-label uppercase tracking-[0.14em] text-dim">
                    {f.real ? "Simplified + Real UI" : "Simplified UI"}
                  </span>
                </span>
              </button>
            ))}
          </div>
          </div>
        </div>
      </div>

      {/* pricing: sold in bundles, never one at a time */}
      <div className="border-t border-hair px-5 py-6 md:px-7">
        <p className="font-mono text-label uppercase text-dim">[ Pricing ]</p>
        <p className="mt-1 max-w-[var(--measure-body)] text-body text-muted">
          Feature animations are ordered in bundles, not one at a time. Pick the
          pack that covers the features you need.
        </p>
        <div className="mt-5 grid items-start gap-4 sm:grid-cols-3">
          {featurePacks.map((pack) => (
            <FeaturePriceCard key={pack.slug} pack={pack} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* what every feature-animation order ships with, identical across the
 * three bundles. Verbatim from the live pricing accordion. */
export const featureIncludes: { text: string; ok: boolean; highlight?: boolean }[] = [
  { text: "Same video with your logo and brand color", ok: true },
  { text: "Both realistic and simplified version", ok: true },
  { text: "Keep or remove the default caption", ok: true },
  { text: "Add background music, on demand", ok: true },
  { text: "Delivery in 5 to 7 days", ok: true },
  {
    text: "Both old and new UI, released at LevelUp Summit",
    ok: true,
    highlight: true,
  },
  { text: "No voiceover", ok: false },
];

export function FeaturePriceCard({ pack }: { pack: (typeof featurePacks)[number] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col rounded-[3px] border border-hair bg-canvas p-5">
      <p className="font-mono text-label uppercase text-dim">
        {pack.packCount} animations
      </p>
      <p className="mt-2 font-mono text-price font-bold leading-none text-gold [font-variant-numeric:tabular-nums]">
        ${pack.price.toLocaleString("en-US")}
      </p>
      <p className="mt-2 text-body-sm leading-relaxed text-muted">
        {pack.subtitle}
      </p>
      <Link
        href={`/checkout/${skuFor(pack.slug)}`}
        className="group/btn mt-4 inline-flex items-center justify-center gap-1.5 rounded-[3px] bg-brand-gradient px-4 py-2.5 text-body-sm font-semibold text-canvas shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
      >
        {cta.orderPremade}
        <span
          aria-hidden="true"
          className="transition-transform duration-200 group-hover/btn:translate-x-0.5"
        >
          &rarr;
        </span>
      </Link>

      {/* what's included: closed by default, opens on click */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-4 flex items-center justify-between gap-2 border-t border-hair pt-4 font-mono text-label uppercase text-muted transition-colors hover:text-gold"
      >
        What is included
        <span
          aria-hidden="true"
          className={`text-gold transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        >
          &darr;
        </span>
      </button>
      {open && (
        <ul className="mt-3 grid gap-2">
          {featureIncludes.map((it) => (
            <li key={it.text} className="flex items-start gap-2.5 text-body-sm">
              <span
                aria-hidden="true"
                className={`mt-0.5 shrink-0 ${it.ok ? "text-green" : "text-error"}`}
              >
                {it.ok ? (
                  <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none">
                    <path
                      d="M2.5 7.5l3 3 6-7"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none">
                    <path
                      d="M3.5 3.5l7 7M10.5 3.5l-7 7"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </span>
              <span
                className={
                  it.highlight
                    ? "font-medium text-gold"
                    : it.ok
                      ? "text-muted"
                      : "text-dim"
                }
              >
                {it.text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
