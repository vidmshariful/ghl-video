"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { checkoutHref, collab, cta, type CollabVersion } from "@/lib/site";

/* ---------------------------------------------------------------- */
/* HighLevel x Vidiosa: collaborations, played version by version      */
/* ---------------------------------------------------------------- */

/* A version's own preview, in a popup, with its buy-or-download CTA. */
export function VersionLightbox({
  version,
  onClose,
}: {
  version: CollabVersion;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
      prev?.focus();
    };
  }, [onClose]);

  const free = version.price === 0;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={version.name}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-canvas/90 p-4 backdrop-blur-md md:p-12"
      onClick={onClose}
    >
      <div className="relative w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="absolute -top-12 right-0 flex h-10 w-10 items-center justify-center rounded-[3px] border border-hair bg-[#111219] text-ink transition-colors hover:border-gold"
        >
          <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        {version.wistiaId ? (
          <div className="aspect-video w-full border border-hair bg-black">
            <iframe
              src={`https://fast.wistia.net/embed/iframe/${version.wistiaId}?autoPlay=true&playerColor=FCC000`}
              title={version.name}
              allow="autoplay; fullscreen"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        ) : (
          <div className="relative flex aspect-video w-full flex-col items-center justify-center border border-hair bg-surface text-center">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 hatch opacity-30" />
            <span className="relative rounded-full border border-hair bg-canvas px-4 py-1.5 font-mono text-label uppercase text-dim">
              Example coming soon
            </span>
            <p className="relative mt-3 max-w-[var(--measure-body)] px-6 text-body text-muted">
              We are producing a {version.name} sample. Order now and we brand
              it for you.
            </p>
          </div>
        )}
        {/* buy or download, in reach */}
        <div className="flex flex-wrap items-center justify-between gap-4 border border-t-0 border-hair bg-[#111219] px-5 py-4">
          <div>
            <p className="font-display text-h4 font-semibold text-ink">
              {version.name}
            </p>
            <p className="mt-0.5 text-body text-muted">
              {version.note}{" "}
              <span className="font-mono font-semibold text-gold">
                {free ? "Free" : `$${version.price.toLocaleString("en-US")}`}
              </span>
            </p>
          </div>
          {version.cta === "download" && version.url ? (
            <a
              href={version.url}
              target="_blank"
              rel="noopener"
              download=""
              className="group inline-flex items-center gap-2 whitespace-nowrap rounded-[3px] bg-brand-gradient px-6 py-3 text-body font-semibold text-canvas shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
            >
              Download free
              <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
                &rarr;
              </span>
            </a>
          ) : (
            <Link
              href={checkoutHref(version.checkoutSlug ?? version.slug)}
              className="group inline-flex items-center gap-2 whitespace-nowrap rounded-[3px] bg-brand-gradient px-6 py-3 text-body font-semibold text-canvas shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
            >
              {cta.orderPremade}
              <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
                &rarr;
              </span>
            </Link>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function CollabView() {
  const project = collab.projects[0];
  const [open, setOpen] = useState<CollabVersion | null>(null);
  return (
    <div>
      {/* header band */}
      <div className="border-b border-hair px-5 py-6 md:px-7">
        <p className="font-display text-h3 text-ink">{project.name}</p>
        <p className="mt-1.5 max-w-[var(--measure-body)] text-body leading-relaxed text-muted">
          {project.tagline}
        </p>
      </div>

      {/* body: the HighLevel original on the left, the versions on the right */}
      <div className="grid lg:grid-cols-[1.35fr_1fr]">
        <div className="min-w-0 border-b border-hair lg:border-b-0 lg:border-r">
          <p className="flex min-h-[3rem] items-center border-b border-hair bg-surface px-5 font-mono text-label uppercase text-dim">
            [ The HighLevel original ]
          </p>
          <div className="p-5 md:p-7">
            <video
              src={project.mainPreview}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full border border-hair bg-black"
            />
            <p className="mt-3 text-body text-muted">
              The exact video we produced for HighLevel. Pick a version on the
              right to see it branded and grab it.
            </p>
          </div>
        </div>

        <div className="min-w-0">
          <p className="flex min-h-[3rem] items-center border-b border-hair bg-surface px-5 font-mono text-label uppercase text-dim">
            [ {project.versions.length} versions ]
          </p>
          <ul>
            {project.versions.map((v) => (
              <li key={v.slug}>
                <button
                  type="button"
                  onClick={() => setOpen(v)}
                  aria-haspopup="dialog"
                  className="group/v flex w-full items-center gap-4 border-b border-hair px-5 py-4 text-left transition-colors last:border-b-0 hover:bg-surface"
                >
                  {/* play affordance */}
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hair bg-canvas transition-colors group-hover/v:border-gold">
                    <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4 text-gold" aria-hidden="true">
                      <path d="M8 5v14l11-7z" fill="currentColor" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-body font-semibold text-ink">
                      {v.name}
                    </span>
                    <span className="mt-0.5 block text-body-sm leading-snug text-muted">
                      {v.note}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-body font-bold text-gold [font-variant-numeric:tabular-nums]">
                    {v.price === 0 ? "Free" : `$${v.price.toLocaleString("en-US")}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {open && <VersionLightbox version={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
