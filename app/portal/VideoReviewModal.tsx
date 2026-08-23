"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { VideoReview } from "./VideoReview";
import { ShareVideo } from "./ShareVideo";

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
  const [mounted, setMounted] = useState(false);
  const [sharing, setSharing] = useState(false);
  useEffect(() => setMounted(true), []);

  /* escape closes, and the page behind stops scrolling while it is open */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-canvas/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={video.title}
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
        <div className="w-full max-w-[1600px] rounded-[12px] border border-hair bg-surface p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <h2 className="min-w-0 font-display text-h3 leading-tight text-ink">{video.title}</h2>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSharing(true)}
                className="tap rounded-[8px] border border-hair px-3 py-1.5 font-mono text-label uppercase text-muted transition-colors hover:border-green/60 hover:text-green"
              >
                Share
              </button>
              {/* our own route: the download attribute is ignored across
                  origins, so a plain link just opens the file in a tab */}
              <a
                href={`/api/portal/videos/${video.id}/download`}
                className="tap rounded-[8px] border border-hair px-3 py-1.5 font-mono text-label uppercase text-muted transition-colors hover:border-blue/60 hover:text-blue"
              >
                Download
              </a>
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
