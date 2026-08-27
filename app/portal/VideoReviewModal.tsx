"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { VideoReview } from "./VideoReview";
import { ShareVideo } from "./ShareVideo";
import { DownloadButton } from "@/components/portal/download";

/*
 * The one and only place a client reviews a video: full screen, over
 * everything, never inline (owner rule, final, 23 August 2026). It is the
 * pre-made review lifted into a component so every surface opens the same
 * thing, with the video and its timestamped notes side by side and a way out
 * in the corner.
 */

type ReviewTarget = {
  id: string;
  title: string;
  videoUrl: string;
  status: string;
  canRequestChanges: boolean;
  revisionsIncluded: number;
  revisionsUsed: number;
  unlimitedRevisions?: boolean;
};

export function VideoReviewModal({
  video,
  onClose,
  onChanged,
  authedFetch,
  onMessageStudio,
}: {
  video: ReviewTarget;
  onClose: () => void;
  onChanged: () => void;
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  onMessageStudio?: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [sharing, setSharing] = useState(false);
  useEffect(() => setMounted(true), []);

  /*
   * The latest onClose, in a ref so the effect below can depend on `mounted`
   * ALONE. Callers pass an inline arrow, so it is a new function on every
   * render; depending on it would re-run the effect on every keystroke and
   * re-fire the focus timeout, which throws you out of the note box after one
   * character. That exact bug shipped once from the portal Modal. Not twice.
   */
  const closeRef = useRef(onClose);
  /* Share opens on top of this. Kept in a ref for the same reason as above:
     the handler has to know, and re-running the effect to tell it would
     re-fire the focus timeout. */
  const sharingRef = useRef(sharing);
  useEffect(() => {
    closeRef.current = onClose;
    sharingRef.current = sharing;
  });

  /*
   * Escape closes, the page behind stops scrolling, and Tab stays in here.
   *
   * The trap is not decoration: this says aria-modal, and saying that without
   * holding focus is a promise to a screen reader that the rest of the page
   * is gone while it is still fully tabbable. It earns its keep when the
   * player is opened from another popup, which hands focus back to whatever
   * was behind this one on its way out.
   */
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      /* While Share is up, this is not the top dialog. Its controls sit after
         this panel in the document, so a trap here would make them
         unreachable by keyboard, which is worse than no trap at all. */
      if (sharingRef.current) return;
      if (!panelRef.current?.contains(document.activeElement)) return;
      const nodes = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])',
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    document.body.style.overflow = "hidden";
    /* the dialog itself, not its first button: a screen reader reads the
       title and no control shows an initial focus ring */
    const t = window.setTimeout(() => panelRef.current?.focus(), 30);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = "";
      window.clearTimeout(t);
    };
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-canvas/85 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex min-h-full items-start justify-center p-3 sm:p-6"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={video.title}
          tabIndex={-1}
          style={{ outline: "none" }}
          className="w-full max-w-[1600px] rounded-[12px] border border-hair bg-surface p-4 sm:p-6"
        >
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <h2 className="min-w-0 font-display text-h3 leading-tight text-ink">{video.title}</h2>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSharing(true)}
                className="tap rounded-[8px] border border-green/50 px-3 py-1.5 font-mono text-label uppercase text-green transition-colors hover:border-green hover:bg-green/10"
              >
                Share
              </button>
              <DownloadButton videoId={video.id} />
              <button
                type="button"
                onClick={onClose}
                className="tap rounded-[8px] border border-hair px-3 py-1.5 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
              >
                Close
              </button>
            </div>
          </div>

          <VideoReview
            videoId={video.id}
            title={video.title}
            videoUrl={video.videoUrl}
            status={video.status}
            canRequestChanges={video.canRequestChanges}
            revisionsIncluded={video.revisionsIncluded}
            revisionsUsed={video.revisionsUsed}
            unlimitedRevisions={video.unlimitedRevisions}
            onChanged={onChanged}
            onMessageStudio={onMessageStudio}
            authedFetch={authedFetch}
          />
        </div>
      </div>

      {sharing && (
        <ShareVideo videoId={video.id} title={video.title} authedFetch={authedFetch} onClose={() => setSharing(false)} />
      )}
    </div>,
    document.body,
  );
}
