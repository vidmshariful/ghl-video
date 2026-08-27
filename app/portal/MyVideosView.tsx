"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  REVISIONS_INCLUDED,
  STATUS_LABEL,
  type DeliverableStatus,
} from "@/lib/deliverable-status";
import { PlayCircle, Search } from "lucide-react";
import { Card, Chip, EmptyState, Tabs } from "@/components/portal/ui";
import { DownloadAll } from "@/components/portal/DownloadAll";
import { DownloadButton } from "@/components/portal/download";
import { VideoReview } from "./VideoReview";

/*
 * My Videos: what the client actually bought, video by video.
 *
 * Videos lists everything they own, whether it came on its own or inside a
 * pack, because "where is my video" is a question about a video and not about
 * how it was sold. A video that came from a pack says so on its card.
 *
 * Packs only appears when they own one. A client who bought a single video was
 * being shown an empty Packs tab, which reads as something missing.
 *
 * Anything waiting on the client is pulled to the front and counted at the top,
 * because the whole point of this screen is that they never have to hunt for
 * the thing we need from them.
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
  /* set on editing plan videos, where every tier sells unlimited rounds */
  unlimitedRevisions?: boolean;
  videoUrl: string | null;
  readyAt: string | null;
  approvedAt: string | null;
  /* worded by the server so the portal and the studio board agree */
  due?: { text: string; tone: string } | null;
};

type Line = "premade" | "custom" | "editing";

type Group = {
  line?: Line;
  orderId: string;
  invoiceNumber: string | null;
  orderedAt: string;
  productName: string;
  productCode: string | null;
  kind: "video" | "pack";
  videos: Video[];
};

/** a video plus where it came from, which is what a flat list needs */
type Owned = Video & { packName: string | null; packId: string | null };

/* Which of the shared chip tones each video state wears. Mapped rather than
 * styled here, so a change to what "warn" looks like moves this screen too
 * instead of leaving it as the one place that still paints its own. */
const CHIP_TONE: Record<DeliverableStatus, "neutral" | "good" | "warn" | "bad" | "info"> = {
  queued: "neutral",
  in_production: "warn",
  ready: "info",
  revisions: "bad",
  approved: "good",
};

const EXPLAINER: Record<DeliverableStatus, string> = {
  queued: "In the queue. We start this once your brief is in.",
  in_production: "Our editors are building this one now.",
  ready: "Ready for you to watch.",
  revisions: "We are making the changes you asked for.",
  approved: "You approved this one. It is yours to use.",
};

/* Anything needing the client comes first, finished work last. */
const SORT: Record<DeliverableStatus, number> = {
  ready: 0,
  revisions: 1,
  in_production: 2,
  queued: 3,
  approved: 4,
};

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function MyVideosView({
  authedFetch,
  onMessageStudio,
  focusVideoId,
  onFocused,
}: {
  authedFetch: (path: string, init?: RequestInit) => Promise<unknown>;
  onMessageStudio?: () => void;
  /* a video to open on arrival, sent by the dashboard's Watch it */
  focusVideoId?: string | null;
  onFocused?: () => void;
}) {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [tab, setTab] = useState<"videos" | "packs">("videos");
  const [openPack, setOpenPack] = useState<string | null>(null);
  /* search over what they own. The Library has had this since day one, for
   * somebody shopping; the screen where they actually work had none, and it
   * matters more the longer somebody has been a client. */
  const [q, setQ] = useState("");
  const [playing, setPlaying] = useState<Owned | null>(null);

  const load = useCallback(async () => {
    const j = (await authedFetch("/api/portal/videos").catch(() => null)) as {
      groups?: Group[];
    } | null;
    /* Premade only. Custom work and editing plans have screens of their own,
     * because one mixed list answers "where is my video" by making somebody
     * read all of it. The route still returns all three so the dashboard can
     * count the lot. */
    const g = (j?.groups ?? []).filter((x) => (x.line ?? "premade") === "premade");
    setGroups(g);
    setPlaying((p) => {
      if (!p) return null;
      const fresh = g.flatMap((x) => x.videos).find((v) => v.id === p.id);
      return fresh ? { ...fresh, packName: p.packName, packId: p.packId } : null;
    });
  }, [authedFetch]);

  useEffect(() => {
    load();
  }, [load]);

  /* somebody pressed Watch it on the dashboard: open that video rather than
   * dropping them on the list to find it again */
  useEffect(() => {
    if (!focusVideoId || !groups) return;
    const g = groups.find((x) => x.videos.some((v) => v.id === focusVideoId));
    const v = g?.videos.find((x) => x.id === focusVideoId);
    if (v) setPlaying({ ...v, packName: g!.kind === "pack" ? g!.productName : null, packId: g!.orderId });
    onFocused?.();
  }, [focusVideoId, groups, onFocused]);

  if (groups === null) return <p className="text-body text-muted">Loading your videos...</p>;

  const packs = groups.filter((g) => g.kind === "pack");
  const all: Owned[] = groups
    .flatMap((g) =>
      g.videos.map((v) => ({
        ...v,
        packName: g.kind === "pack" ? g.productName : null,
        packId: g.kind === "pack" ? g.orderId : null,
      })),
    )
    .sort((a, b) => SORT[a.status] - SORT[b.status]);

  const waiting = all.filter((v) => v.status === "ready").length;

  /* what a search actually has to match: somebody remembers the name, the
     pack it came in, or the code on the invoice */
  const term = q.trim().toLowerCase();
  const shown = term
    ? all.filter((v) =>
        [v.title, v.packName, v.code, v.category, v.groupLabel]
          .filter(Boolean)
          .some((x) => String(x).toLowerCase().includes(term)),
      )
    : all;

  /* only finished videos can be taken away */
  const downloadable = all.filter((v) => v.videoUrl && v.status === "approved").map((v) => v.id);

  if (!all.length) {
    return (
      <EmptyState
        icon={<PlayCircle />}
        title="No videos yet"
        description="Your videos appear here as soon as your first order is under way, each one with the date it is promised for."
      />
    );
  }

  const pack = openPack ? packs.find((p) => p.orderId === openPack) : null;

  return (
    <div>
      {waiting > 0 && (
        <div className="mb-5">
          <Card
            tone="dark"
            title={
              waiting === 1
                ? "One video is ready for you"
                : `${waiting} videos are ready for you`
            }
            description="Watch it, leave notes on anything you want changed, then approve."
          >
            <p className="text-body-sm text-chrome-muted">
              {REVISIONS_INCLUDED === 1
                ? "One round of changes is included on every video."
                : `${REVISIONS_INCLUDED} rounds of changes are included on every video.`}{" "}
              Nothing is delivered until you say so.
            </p>
          </Card>
        </div>
      )}

      {/* Packs only exists for people who own one. */}
      {packs.length > 0 && (
        <Tabs
          tabs={[
            { key: "videos" as const, label: "Videos", count: all.length },
            { key: "packs" as const, label: "Packs", count: packs.length },
          ]}
          active={tab}
          onChange={(k) => {
            setTab(k);
            setOpenPack(null);
          }}
        />
      )}

      {tab === "videos" || packs.length === 0 ? (
        <div className={packs.length > 0 ? "mt-6" : ""}>
          {/* Search, and taking the lot away. Both only appear once there is
              enough here to want them: a control over four videos is
              furniture. */}
          {(all.length > 5 || downloadable.length > 1) && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {all.length > 5 && (
                <div className="relative min-w-[14rem] flex-1">
                  <Search
                    size={15}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim"
                  />
                  <input
                    type="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Find one of your videos"
                    aria-label="Search your videos"
                    className="tap w-full rounded-[8px] border border-hair bg-canvas py-2 pl-9 pr-3 text-body-sm text-ink placeholder:text-dim focus:border-gold focus:outline-none"
                  />
                </div>
              )}
              <DownloadAll videoIds={downloadable} />
            </div>
          )}

          {shown.length === 0 ? (
            <p className="py-6 text-body-sm text-muted">
              Nothing matches {`"${q}"`}. Try the video name, or the pack it came in.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((v) => (
                <VideoCard key={v.id} video={v} onPlay={setPlaying} showPack />
              ))}
            </div>
          )}
        </div>
      ) : pack ? (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setOpenPack(null)}
            className="tap font-mono text-label uppercase text-muted transition-colors hover:text-gold"
          >
            &larr; All packs
          </button>
          <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div>
              <h2 className="font-display text-h3 text-ink">{pack.productName}</h2>
              <p className="mt-1 font-mono text-label uppercase tracking-[0.1em] text-dim">
                {pack.productCode ? `${pack.productCode} / ` : ""}
                Ordered {day(pack.orderedAt)}
              </p>
            </div>
            <p className="font-mono text-label uppercase tracking-[0.1em] text-muted">
              {pack.videos.filter((v) => v.status === "ready" || v.status === "approved").length} of{" "}
              {pack.videos.length} ready
            </p>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[...pack.videos]
              .sort((a, b) => SORT[a.status] - SORT[b.status])
              .map((v) => (
                <VideoCard
                  key={v.id}
                  video={{ ...v, packName: pack.productName, packId: pack.orderId }}
                  onPlay={setPlaying}
                />
              ))}
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {packs.map((p) => (
            <PackCard key={p.orderId} pack={p} onOpen={() => setOpenPack(p.orderId)} />
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

/** A pack as one thing the client bought, with a peek at what is inside. */
function PackCard({ pack, onOpen }: { pack: Group; onOpen: () => void }) {
  const ready = pack.videos.filter((v) => v.status === "ready" || v.status === "approved").length;
  const cover = pack.videos.find((v) => v.videoUrl)?.videoUrl ?? null;
  const pct = Math.round((ready / Math.max(1, pack.videos.length)) * 100);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="tap group overflow-hidden rounded-[12px] border border-hair bg-surface text-left transition-colors hover:border-gold/50"
    >
      <div className="relative">
        {cover ? (
          <video
            src={`${cover}#t=1`}
            preload="metadata"
            muted
            playsInline
            tabIndex={-1}
            aria-hidden="true"
            className="pointer-events-none aspect-video w-full bg-canvas object-cover"
          />
        ) : (
          <div className="aspect-video w-full bg-canvas" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-canvas/55 font-mono text-label uppercase tracking-[0.1em] text-ink transition-colors group-hover:bg-canvas/35">
          {pack.videos.length} videos
        </span>
      </div>
      <div className="p-4">
        <h3 className="text-body font-semibold leading-snug text-ink">{pack.productName}</h3>
        <p className="mt-1 font-mono text-label uppercase tracking-[0.1em] text-dim">
          {pack.productCode ? `${pack.productCode} / ` : ""}
          Ordered {day(pack.orderedAt)}
        </p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-hair">
          <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1.5 font-mono text-label uppercase tracking-[0.1em] text-muted">
          {ready} of {pack.videos.length} ready
        </p>
      </div>
    </button>
  );
}

function VideoCard({
  video: v,
  onPlay,
  showPack = false,
}: {
  video: Owned;
  onPlay: (v: Owned) => void;
  showPack?: boolean;
}) {
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
          <Chip tone={CHIP_TONE[v.status]}>{STATUS_LABEL[v.status]}</Chip>
        </div>

        {/* When to expect it. Shown for anything not yet finished, including
            the ones we are late on: a card that goes quiet once it slips is
            exactly what makes somebody open a chat window to ask. */}
        {v.due?.text && (
          <p
            className={`mt-1.5 font-mono text-label uppercase tracking-[0.1em] ${
              v.due.tone === "late"
                ? "text-error"
                : v.due.tone === "today"
                  ? "text-gold"
                  : "text-muted"
            }`}
          >
            {v.due.text}
          </p>
        )}

        {/* where it came from, so a pack video is never a mystery */}
        {showPack && v.packName && (
          <p className="mt-1.5 inline-flex rounded-full border border-hair px-2 py-0.5 font-mono text-label uppercase tracking-[0.1em] text-muted">
            {v.packName}
          </p>
        )}
        {(v.code || v.groupLabel) && (
          <p className="mt-1.5 font-mono text-label uppercase tracking-[0.1em] text-dim">
            {v.code ? v.code.toUpperCase() : ""}
            {v.code && v.groupLabel ? " / " : ""}
            {v.groupLabel ?? ""}
          </p>
        )}

        {v.videoUrl && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onPlay(v)}
              className="tap rounded-[8px] border border-gold/50 px-3 py-1.5 font-mono text-label uppercase text-gold transition-colors hover:bg-gold hover:text-canvas"
            >
              {v.canReview ? "Watch and review" : "Watch"}
            </button>
            <DownloadButton videoId={v.id} variant="link" />
          </div>
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
  video: Owned;
  onClose: () => void;
  onChanged: () => void;
  onMessageStudio?: () => void;
  authedFetch: (path: string, init?: RequestInit) => Promise<unknown>;
}) {
  useEffect(() => {
    /* Escape always closes, even from the notes box. Trapping it there meant
       clicking into the textarea quietly disabled the escape hatch. */
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

  if (!v.videoUrl) return null;

  /* Rendered into <body> rather than in place.
   *
   * The portal's view wrapper animates, and an ancestor with a transform
   * becomes the containing block for position:fixed. The popup was therefore
   * being trapped inside the content column instead of covering the window,
   * which is why it looked small and why clicking beside it sometimes missed
   * the backdrop. Going through the body escapes that entirely. */
  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-canvas/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={v.title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* the padding lives on an inner shell so a click beside the panel still
          lands on the backdrop rather than on the padding of the panel itself */}
      <div
        className="flex min-h-full items-start justify-center p-3 sm:p-6"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="w-full max-w-[1600px] rounded-[12px] border border-hair bg-surface p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-h3 leading-tight text-ink">{v.title}</h2>
              <p className="mt-1 font-mono text-label uppercase tracking-[0.1em] text-dim">
                {v.code ? `${v.code.toUpperCase()} / ` : ""}
                {STATUS_LABEL[v.status]}
                {v.packName ? ` / ${v.packName}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <DownloadButton videoId={v.id} />
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
              unlimitedRevisions={v.unlimitedRevisions}
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
                className="max-h-[70vh] w-full rounded-[8px] bg-canvas"
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
    </div>,
    document.body,
  );
}
