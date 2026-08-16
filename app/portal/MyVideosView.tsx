"use client";

import { useCallback, useEffect, useState } from "react";
import { STATUS_LABEL, type DeliverableStatus } from "@/lib/deliverable-status";
import { VideoReview } from "./VideoReview";

/*
 * My Videos: what the client actually bought, video by video.
 *
 * Orders answer "what did I pay for". This answers "where is my video", which
 * is the question clients were asking in chat. Single video purchases sit under
 * Videos, multi video purchases under Packs, because a client thinks of a nine
 * video pack as one thing they bought, not nine line items.
 *
 * A card shows a still from the video with a play button over it, not a live
 * embed. Nine embedded players on one screen is nine media pipelines running
 * for a page nobody is watching yet. Pressing play opens the video large, with
 * everything that can be done to it in one place.
 */

type Video = {
  id: string;
  title: string;
  code: string | null;
  category: string | null;
  groupLabel: string | null;
  status: DeliverableStatus;
  revisionRound: number;
  canReview: boolean;
  canRequestChanges: boolean;
  revisionsIncluded: number;
  revisionsUsed: number;
  videoUrl: string | null;
  readyAt: string | null;
  approvedAt: string | null;
};

type Group = {
  orderId: string;
  invoiceNumber: string | null;
  orderedAt: string;
  productName: string;
  productCode: string | null;
  kind: "video" | "pack";
  videos: Video[];
};

const TONE: Record<DeliverableStatus, string> = {
  queued: "border-hair text-dim",
  in_production: "border-gold/50 text-gold",
  ready: "border-blue/50 text-blue",
  revisions: "border-error/50 text-error",
  approved: "border-green/50 text-green",
};

/* What the client should understand is happening, in their language. */
const EXPLAINER: Record<DeliverableStatus, string> = {
  queued: "In the queue. We start this once your brief is in.",
  in_production: "Our editors are building this one now.",
  ready: "Ready for you to watch.",
  revisions: "We are making the changes you asked for.",
  approved: "You approved this one. It is yours to use.",
};

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function MyVideosView({
  authedFetch,
  onMessageStudio,
}: {
  authedFetch: (path: string, init?: RequestInit) => Promise<unknown>;
  onMessageStudio?: () => void;
}) {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [tab, setTab] = useState<"video" | "pack">("video");
  const [playing, setPlaying] = useState<Video | null>(null);

  const load = useCallback(async () => {
    const j = (await authedFetch("/api/portal/videos").catch(() => null)) as {
      groups?: Group[];
    } | null;
    const g = j?.groups ?? [];
    setGroups(g);
    // keep an open popup in step with what the server now says
    setPlaying((p) =>
      p ? (g.flatMap((x) => x.videos).find((v) => v.id === p.id) ?? null) : null,
    );
  }, [authedFetch]);

  useEffect(() => {
    load();
  }, [load]);

  if (groups === null) return <p className="text-body text-muted">Loading your videos...</p>;

  const singles = groups.filter((g) => g.kind === "video");
  const packs = groups.filter((g) => g.kind === "pack");
  const shown = tab === "video" ? singles : packs;
  const tabs: { key: "video" | "pack"; label: string; n: number }[] = [
    { key: "video", label: "Videos", n: singles.length },
    { key: "pack", label: "Packs", n: packs.length },
  ];

  if (!groups.length) {
    return (
      <div className="rounded-[12px] border border-hair bg-surface p-8 text-center">
        <p className="text-body text-muted">
          Your videos will appear here as soon as your first order is under way.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-1 border-b border-hair">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`tap rounded-t-[8px] px-4 py-2.5 text-body-sm transition-colors ${
              tab === t.key
                ? "border border-b-0 border-hair bg-surface font-semibold text-gold"
                : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
            {t.n > 0 ? ` (${t.n})` : ""}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 text-body text-muted">
          {tab === "video"
            ? "You have not bought a single video on its own yet."
            : "You have not bought a pack yet."}
        </p>
      ) : (
        <div className="mt-6 grid gap-8">
          {shown.map((g) => (
            <GroupBlock key={g.orderId} group={g} onPlay={setPlaying} />
          ))}
        </div>
      )}

      {playing && (
        <VideoPopup
          video={playing}
          onClose={() => setPlaying(null)}
          onChanged={load}
          onMessageStudio={onMessageStudio}
          authedFetch={authedFetch}
        />
      )}
    </div>
  );
}

function GroupBlock({ group, onPlay }: { group: Group; onPlay: (v: Video) => void }) {
  const ready = group.videos.filter(
    (v) => v.status === "ready" || v.status === "approved",
  ).length;

  return (
    <section>
      {group.kind === "pack" && (
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div>
            <h2 className="font-display text-h4 text-ink">{group.productName}</h2>
            <p className="mt-1 font-mono text-label uppercase tracking-[0.1em] text-dim">
              {group.productCode ? `${group.productCode} / ` : ""}
              Ordered {day(group.orderedAt)}
            </p>
          </div>
          <p className="font-mono text-label uppercase tracking-[0.1em] text-muted">
            {ready} of {group.videos.length} ready
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {group.videos.map((v) => (
          <VideoCard key={v.id} video={v} onPlay={onPlay} />
        ))}
      </div>
    </section>
  );
}

function VideoCard({ video: v, onPlay }: { video: Video; onPlay: (v: Video) => void }) {
  return (
    <article className="overflow-hidden rounded-[12px] border border-hair bg-surface">
      {v.videoUrl ? (
        <button
          type="button"
          onClick={() => onPlay(v)}
          aria-label={`Play ${v.title}`}
          className="tap group relative block w-full"
        >
          {/* A still rather than a player: #t=1 makes the browser paint the
              frame at one second without loading the whole file. */}
          <video
            src={`${v.videoUrl}#t=1`}
            preload="metadata"
            muted
            playsInline
            tabIndex={-1}
            aria-hidden="true"
            className="pointer-events-none aspect-video w-full bg-canvas object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-canvas/40 transition-colors group-hover:bg-canvas/20">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-gradient shadow-lg transition-transform group-hover:scale-110">
              <svg viewBox="0 0 24 24" className="ml-0.5 h-6 w-6 fill-canvas" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        </button>
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-canvas px-6 text-center">
          <p className="text-body-sm text-dim">{EXPLAINER[v.status]}</p>
        </div>
      )}

      <div className="p-4">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          <h3 className="min-w-[10rem] flex-1 text-body-sm font-semibold leading-snug text-ink">
            {v.title}
          </h3>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${TONE[v.status]}`}
          >
            {STATUS_LABEL[v.status]}
          </span>
        </div>
        {(v.code || v.groupLabel) && (
          <p className="mt-1.5 font-mono text-label uppercase tracking-[0.1em] text-dim">
            {v.code ? v.code.toUpperCase() : ""}
            {v.code && v.groupLabel ? " / " : ""}
            {v.groupLabel ?? ""}
          </p>
        )}
        {v.videoUrl && (
          <button
            type="button"
            onClick={() => onPlay(v)}
            className="tap mt-3 rounded-[8px] border border-gold/50 px-3 py-1.5 font-mono text-label uppercase text-gold transition-colors hover:bg-gold hover:text-canvas"
          >
            {v.canReview ? "Watch and review" : "Watch"}
          </button>
        )}
      </div>
    </article>
  );
}

/*
 * The video, large, with everything that can be done to it.
 *
 * An approved video shows the player and a download and nothing else: it is
 * finished, and re-opening it from the client's side would make "approved"
 * mean nothing. Anything after that is a conversation with us.
 */
function VideoPopup({
  video: v,
  onClose,
  onChanged,
  onMessageStudio,
  authedFetch,
}: {
  video: Video;
  onClose: () => void;
  onChanged: () => void;
  onMessageStudio?: () => void;
  authedFetch: (path: string, init?: RequestInit) => Promise<unknown>;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // not while typing a note
      const t = e.target as HTMLElement | null;
      if (e.key === "Escape" && t?.tagName !== "TEXTAREA") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!v.videoUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-canvas/85 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={v.title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-auto w-full max-w-[1100px] rounded-[12px] border border-hair bg-surface p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-h4 leading-tight text-ink">{v.title}</h2>
            <p className="mt-1 font-mono text-label uppercase tracking-[0.1em] text-dim">
              {v.code ? `${v.code.toUpperCase()} / ` : ""}
              {STATUS_LABEL[v.status]}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Through our own route, because the download attribute is
                ignored across origins and the file just opened in a tab. */}
            <a
              href={`/api/portal/videos/${v.id}/download`}
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

        {v.canReview ? (
          <VideoReview
            videoId={v.id}
            title={v.title}
            videoUrl={v.videoUrl}
            status={v.status}
            canRequestChanges={v.canRequestChanges}
            revisionsIncluded={v.revisionsIncluded}
            revisionsUsed={v.revisionsUsed}
            onChanged={onChanged}
            onMessageStudio={onMessageStudio}
            authedFetch={authedFetch}
          />
        ) : (
          <div>
            <video
              controls
              autoPlay
              preload="metadata"
              playsInline
              src={v.videoUrl}
              className="aspect-video w-full rounded-[8px] bg-canvas"
            />
            <p className="mt-3 text-body-sm text-dim">
              {v.status === "approved"
                ? "You approved this video, so it is finished and yours to use. If you need anything changed after this, send us a message and we will re-open it for you."
                : EXPLAINER[v.status]}
            </p>
            {v.status === "approved" && onMessageStudio && (
              <button
                type="button"
                onClick={onMessageStudio}
                className="tap mt-3 rounded-[8px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
              >
                Message the studio
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
