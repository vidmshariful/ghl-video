"use client";

import { useCallback, useEffect, useState } from "react";
import { STATUS_LABEL, type DeliverableStatus } from "@/lib/deliverable-status";

/*
 * My Videos: what the client actually bought, video by video.
 *
 * Orders answer "what did I pay for". This answers "where is my video", which
 * is the question clients were asking in chat. Single video purchases sit under
 * Videos, multi video purchases under Packs, because a client thinks of a nine
 * video pack as one thing they bought, not nine line items.
 *
 * A finished video plays right here rather than behind a download link. The
 * server withholds the link until the video is genuinely ready, so a card
 * either plays or honestly says what stage it is at.
 */

type Video = {
  id: string;
  title: string;
  code: string | null;
  category: string | null;
  groupLabel: string | null;
  status: DeliverableStatus;
  revisionRound: number;
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
}: {
  authedFetch: (path: string, init?: RequestInit) => Promise<unknown>;
}) {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [tab, setTab] = useState<"video" | "pack">("video");

  const load = useCallback(async () => {
    const j = (await authedFetch("/api/portal/videos").catch(() => null)) as {
      groups?: Group[];
    } | null;
    setGroups(j?.groups ?? []);
  }, [authedFetch]);

  useEffect(() => {
    load();
  }, [load]);

  if (groups === null) {
    return <p className="text-body text-muted">Loading your videos...</p>;
  }

  const singles = groups.filter((g) => g.kind === "video");
  const packs = groups.filter((g) => g.kind === "pack");

  // Land on whichever tab actually has something, so a pack-only client does
  // not open to an empty screen.
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
            <GroupBlock key={g.orderId} group={g} />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupBlock({ group }: { group: Group }) {
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
          <VideoCard key={v.id} video={v} />
        ))}
      </div>
    </section>
  );
}

function VideoCard({ video: v }: { video: Video }) {
  return (
    <article className="overflow-hidden rounded-[12px] border border-hair bg-surface">
      {v.videoUrl ? (
        /* The video is the point of the card, so it leads. preload metadata
           keeps a nine card pack from pulling nine files on open. */
        <video
          controls
          preload="metadata"
          playsInline
          className="aspect-video w-full bg-canvas"
          src={v.videoUrl}
        >
          Your browser cannot play this video.{" "}
          <a href={v.videoUrl}>Download it instead.</a>
        </video>
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
          <a
            href={v.videoUrl}
            download
            className="mt-3 inline-block font-mono text-label uppercase tracking-[0.1em] text-blue hover:underline"
          >
            Download
          </a>
        )}
      </div>
    </article>
  );
}
