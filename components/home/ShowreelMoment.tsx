"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MediaFrame } from "@/components/MediaFrame";
import { RuledSection } from "@/components/RuledSection";
import { Reveal, RevealItem } from "@/components/Reveal";
import { checkoutHref, cta, premadeVideos, type PremadeVideo } from "@/lib/site";

/* recent launches: the newest ready, sellable premade videos */
const launches = premadeVideos
  .filter((v) => !v.comingSoon && v.preview)
  .slice(0, 5);

/* the gradient buy button, matched to the library's Order Now */
function BuyNow({
  video,
  className = "",
}: {
  video: PremadeVideo;
  className?: string;
}) {
  return (
    <Link
      href={checkoutHref(video.slug)}
      className={`group/btn inline-flex items-center gap-1.5 whitespace-nowrap rounded-[3px] bg-brand-gradient px-6 py-3 text-body font-semibold text-canvas shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-all duration-200 hover:brightness-110 active:scale-[0.98] ${className}`}
    >
      {cta.orderPremade}
      <span
        aria-hidden="true"
        className="transition-transform duration-200 group-hover/btn:translate-x-0.5"
      >
        &rarr;
      </span>
    </Link>
  );
}

/* the library-style popup: the video, then title + price + buy now */
function LaunchLightbox({
  video,
  onClose,
}: {
  video: PremadeVideo;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    document.documentElement.style.overflow = "hidden";
    videoRef.current?.play().catch(() => {});
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

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={video.title}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-canvas/90 p-4 backdrop-blur-md md:p-12"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close video"
          className="absolute -top-12 right-0 flex h-10 w-10 items-center justify-center rounded-[3px] border border-hair bg-[#111219] text-ink transition-colors hover:border-gold"
        >
          <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" aria-hidden="true">
            <path
              d="M2 2l8 8M10 2l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <video
          key={video.slug}
          ref={videoRef}
          src={video.preview ?? undefined}
          poster={video.poster ?? undefined}
          controls
          autoPlay
          playsInline
          className="aspect-video w-full border border-hair bg-black"
        />
        {/* the buy bar: the preview closes with the action in reach */}
        <div className="flex flex-wrap items-center justify-between gap-4 border border-t-0 border-hair bg-[#111219] px-5 py-4">
          <div>
            <p className="font-display text-h4 font-semibold text-ink">
              {video.title}
            </p>
            <p className="mt-0.5 text-body text-muted">
              Make it yours, branded to you.{" "}
              <span className="font-mono font-semibold text-gold">
                ${video.price.toLocaleString("en-US")} one-time
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            {/* homepage popup: a way out to the full library beside buy */}
            <Link
              href="/premade/"
              className="group/lib inline-flex items-center gap-1.5 whitespace-nowrap text-body font-semibold text-gold"
            >
              See full library
              <span
                aria-hidden="true"
                className="transition-transform duration-200 group-hover/lib:translate-x-0.5"
              >
                &rarr;
              </span>
            </Link>
            <BuyNow video={video} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* a clip cell that opens the popup on click; MediaFrame supplies the
   graded, autoplaying thumbnail (its own click affordance dropped) */
function LaunchCell({
  video,
  onOpen,
  className = "",
}: {
  video: PremadeVideo;
  onOpen: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={`Preview ${video.title}`}
      className={`relative block w-full cursor-pointer bg-canvas p-3 text-left focus-visible:outline-offset-[-4px] ${className}`}
    >
      <MediaFrame
        src={video.preview ?? ""}
        poster={video.poster}
        label={video.title}
        caption={{ title: video.title, sub: video.format }}
        tint
        interactive={false}
        className="!absolute inset-3 h-auto !aspect-auto"
      />
    </button>
  );
}

/*
 * Recent launches, drawn into the page grid: a RuledSection frame with the
 * newest sellable premade videos as one connected bento (gap-px on bg-hair).
 * One clip fills the top-left, two stack top-right, and a 50/50 row sits
 * below. Clicking any clip opens the library-style popup: the video, its
 * title and price, and a buy-now button. "See the full library" is pinned
 * in the header.
 */
export function ShowreelMoment() {
  const [active, setActive] = useState<PremadeVideo | null>(null);
  const [featured, a, b, d, e] = launches;

  return (
    <RuledSection
      bpIdx={3}
      index={3}
      chip="The library"
      headline="Recent"
      accent="launches."
      intro="The newest premade videos in the library. Preview any one, then order it branded to your platform."
      action={
        <Link
          href="/premade/"
          className="group inline-flex items-center gap-2 text-body font-semibold text-gold"
        >
          See the full library
          <span
            aria-hidden="true"
            className="transition-transform duration-200 group-hover:translate-x-1"
          >
            &rarr;
          </span>
        </Link>
      }
    >
      <Reveal className="grid gap-px bg-hair lg:h-[47rem] lg:grid-cols-6 lg:grid-rows-[14rem_14rem_19rem]">
        <RevealItem className="h-full lg:col-span-4 lg:row-span-2">
          <LaunchCell
            video={featured}
            onOpen={() => setActive(featured)}
            className="h-full min-h-[18rem] lg:min-h-0"
          />
        </RevealItem>
        <RevealItem className="h-full lg:col-start-5 lg:col-span-2 lg:row-start-1">
          <LaunchCell
            video={a}
            onOpen={() => setActive(a)}
            className="h-full min-h-[13rem] lg:min-h-0"
          />
        </RevealItem>
        <RevealItem className="h-full lg:col-start-5 lg:col-span-2 lg:row-start-2">
          <LaunchCell
            video={b}
            onOpen={() => setActive(b)}
            className="h-full min-h-[13rem] lg:min-h-0"
          />
        </RevealItem>
        <RevealItem className="h-full lg:col-start-1 lg:col-span-3 lg:row-start-3">
          <LaunchCell
            video={d}
            onOpen={() => setActive(d)}
            className="h-full min-h-[13rem] lg:min-h-0"
          />
        </RevealItem>
        <RevealItem className="h-full lg:col-start-4 lg:col-span-3 lg:row-start-3">
          <LaunchCell
            video={e}
            onOpen={() => setActive(e)}
            className="h-full min-h-[13rem] lg:min-h-0"
          />
        </RevealItem>
      </Reveal>

      {active && (
        <LaunchLightbox video={active} onClose={() => setActive(null)} />
      )}
    </RuledSection>
  );
}
