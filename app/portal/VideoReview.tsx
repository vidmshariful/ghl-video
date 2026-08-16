"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

/*
 * Reviewing one video: watch it, say what you want changed at the second it
 * happens, approve it when it is right.
 *
 * The client always sees the current cut. Older cuts stay in the system for
 * the studio, but showing a client three versions of the same video invites
 * them to review the wrong one (owner's decision). Their notes from an earlier
 * cut are still readable, grouped under that cut, so the history is there
 * without the confusion.
 *
 * One round of changes is included, and the client is told so before they use
 * it. That is the difference between a policy and a nasty surprise.
 */

type Comment = {
  id: string;
  side: "client" | "studio";
  name: string;
  body: string;
  atSeconds: number | null;
  atX: number | null;
  atY: number | null;
  stamp: string | null;
  version: number | null;
  parentId: string | null;
  resolved: boolean;
  createdAt: string;
};

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const fieldCls =
  "tap w-full rounded-[8px] border border-hair bg-canvas px-3 py-2 text-body-sm text-ink placeholder:text-dim";

export function VideoReview({
  videoId,
  title,
  videoUrl,
  status,
  canRequestChanges,
  revisionsIncluded,
  revisionsUsed,
  onChanged,
  onMessageStudio,
  authedFetch,
}: {
  videoId: string;
  title: string;
  videoUrl: string;
  status: string;
  canRequestChanges: boolean;
  revisionsIncluded: number;
  revisionsUsed: number;
  onChanged: () => void;
  onMessageStudio?: () => void;
  authedFetch: (path: string, init?: RequestInit) => Promise<unknown>;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");
  const [pin, setPin] = useState(true);
  const [at, setAt] = useState(0);
  const [duration, setDuration] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [currentVersion, setCurrentVersion] = useState<number | null>(null);
  const [pinAt, setPinAt] = useState<{ x: number; y: number } | null>(null);
  const [pinMode, setPinMode] = useState(false);
  const [ask, setAsk] = useState<null | "approve" | "changes">(null);

  const load = useCallback(async () => {
    const j = (await authedFetch(`/api/portal/videos/${videoId}/review`).catch(() => null)) as {
      comments?: Comment[];
      versions?: { version: number }[];
    } | null;
    setComments(j?.comments ?? []);
    setCurrentVersion(j?.versions?.[0]?.version ?? null);
  }, [authedFetch, videoId]);

  useEffect(() => {
    load();
  }, [load]);

  async function send(
    action: "comment" | "approve" | "changes",
    opts?: { parentId?: string; body?: string },
  ) {
    const message = opts?.body ?? text;
    if (action === "comment" && !message.trim()) return;

    setBusy(true);
    setErr("");
    const j = (await authedFetch(`/api/portal/videos/${videoId}/review`, {
      method: "POST",
      body: JSON.stringify(
        action === "comment"
          ? {
              action,
              body: message,
              atSeconds: opts?.parentId ? null : pin ? at : null,
              atX: opts?.parentId ? null : (pinAt?.x ?? null),
              atY: opts?.parentId ? null : (pinAt?.y ?? null),
              parentId: opts?.parentId ?? null,
            }
          : { action },
      ),
    }).catch(() => null)) as { ok?: boolean; error?: string } | null;
    setBusy(false);
    if (!j?.ok) return setErr(j?.error ?? "Could not send that.");
    if (opts?.parentId) {
      setReplyTo(null);
      setReplyText("");
    } else {
      setText("");
      setPinAt(null);
      setPinMode(false);
    }
    await load();
    onChanged();
  }

  /* Clicking into the note box pauses the video. Otherwise a client types
     while it plays on, and the timestamp they attach is wherever it drifted
     to rather than the thing they were looking at. */
  function pause() {
    ref.current?.pause();
  }

  /* A click on the frame in pin mode records where, as percentages so it
     survives any player size, and pauses on the exact frame. */
  function placePin(e: React.MouseEvent<HTMLVideoElement>) {
    if (!pinMode) return;
    const r = e.currentTarget.getBoundingClientRect();
    // Before the video reports its size the box can still be zero high, and
    // dividing by that produced a pin with an across but no down: it saved as
    // half a pin and drew at the top of the frame. Ignore the click instead.
    if (r.width <= 0 || r.height <= 0) return;
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    setPinAt({ x, y });
    pause();
  }

  function seek(s: number) {
    const v = ref.current;
    if (!v) return;
    v.currentTime = s;
    v.play().catch(() => {});
  }

  /* Enter sends, shift and enter makes a new line. */
  const enterSends = (fn: () => void) => (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      fn();
    }
  };

  const all = comments ?? [];
  const top = all.filter((c) => !c.parentId);
  const repliesOf = (id: string) => all.filter((c) => c.parentId === id);
  const open = top.filter((c) => !c.resolved && c.side === "client").length;

  /* Notes belong to the cut they were written about. Grouping them keeps an
     earlier round readable as history instead of muddled into this one. */
  const onCurrent = top.filter((c) => currentVersion == null || (c.version ?? currentVersion) === currentVersion);
  const earlier = top.filter((c) => currentVersion != null && (c.version ?? currentVersion) !== currentVersion);
  const byVersion = new Map<number, Comment[]>();
  for (const c of earlier) {
    const v = c.version ?? 0;
    byVersion.set(v, [...(byVersion.get(v) ?? []), c]);
  }

  const note = (c: Comment) => (
    <li
      key={c.id}
      className={`rounded-[8px] border p-3 ${
        c.side === "studio" ? "border-blue/30 bg-blue/5" : "border-hair bg-card"
      } ${c.resolved ? "opacity-60" : ""}`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-body-sm font-semibold text-ink">{c.name}</span>
        {c.stamp && (
          <button
            type="button"
            onClick={() => c.atSeconds != null && seek(c.atSeconds)}
            className="tap rounded-full border border-gold/40 px-2 py-0.5 font-mono text-label text-gold transition-colors hover:bg-gold hover:text-canvas"
          >
            {c.stamp}
          </button>
        )}
        {c.resolved && <span className="font-mono text-label uppercase text-green">Done</span>}
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-body-sm text-muted">{c.body}</p>
      <p className="mt-1 font-mono text-label uppercase tracking-[0.1em] text-dim">
        {when(c.createdAt)}
      </p>

      {repliesOf(c.id).map((r) => (
        <div key={r.id} className="mt-2 border-l-2 border-blue/40 pl-3">
          <span className="text-body-sm font-semibold text-ink">{r.name}</span>
          <p className="mt-0.5 whitespace-pre-wrap text-body-sm text-muted">{r.body}</p>
          <p className="mt-0.5 font-mono text-label uppercase tracking-[0.1em] text-dim">
            {when(r.createdAt)}
          </p>
        </div>
      ))}

      {replyTo === c.id ? (
        <div className="mt-2 grid gap-2">
          <textarea
            rows={2}
            autoFocus
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={enterSends(() => send("comment", { parentId: c.id, body: replyText }))}
            placeholder="Reply. Enter to send."
            className={fieldCls}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !replyText.trim()}
              onClick={() => send("comment", { parentId: c.id, body: replyText })}
              className="tap rounded-[8px] border border-hair px-3 py-1.5 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-40"
            >
              Send
            </button>
            <button
              type="button"
              onClick={() => {
                setReplyTo(null);
                setReplyText("");
              }}
              className="tap font-mono text-label uppercase text-dim transition-colors hover:text-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setReplyTo(c.id);
            setReplyText("");
          }}
          className="tap mt-2 font-mono text-label uppercase tracking-[0.1em] text-dim transition-colors hover:text-gold"
        >
          Reply
        </button>
      )}
    </li>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      {ask === "approve" && (
        <ConfirmDialog
          title={`Approve ${title}?`}
          body="This tells the studio the video is finished. You will still be able to watch and download it."
          confirmLabel="Yes, approve it"
          tone="green"
          onConfirm={() => {
            setAsk(null);
            send("approve");
          }}
          onCancel={() => setAsk(null)}
        />
      )}
      {ask === "changes" && (
        <ConfirmDialog
          title="Send your notes and ask for changes?"
          body={`This uses your ${revisionsIncluded === 1 ? "one included revision round" : `${revisionsIncluded} included revision rounds`}, so make sure every note is in first.`}
          confirmLabel="Yes, send them"
          onConfirm={() => {
            setAsk(null);
            send("changes");
          }}
          onCancel={() => setAsk(null)}
        />
      )}
      <div>
        <div className="relative">
          <video
            ref={ref}
            controls
            autoPlay
            preload="metadata"
            playsInline
            src={videoUrl}
            onClick={placePin}
            onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
            className={`max-h-[65vh] w-full rounded-[8px] bg-canvas ${pinMode ? "cursor-crosshair" : ""}`}
          />

          {/* Pins for notes about roughly this moment, so the frame shows what
              the client was pointing at without them hunting the list. */}
          {onCurrent
            .filter(
              (c) =>
                c.atX != null &&
                c.atY != null &&
                c.atSeconds != null &&
                Math.abs(c.atSeconds - at) < 2,
            )
            .map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => c.atSeconds != null && seek(c.atSeconds)}
                title={c.body.slice(0, 80)}
                style={{ left: `${c.atX}%`, top: `${c.atY}%` }}
                className="tap absolute z-10 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-canvas bg-gold font-mono text-label font-bold text-canvas shadow-lg"
              >
                {i + 1}
              </button>
            ))}

          {/* where the note being written is pointing */}
          {pinAt && (
            <span
              style={{ left: `${pinAt.x}%`, top: `${pinAt.y}%` }}
              className="pointer-events-none absolute z-10 h-7 w-7 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full border-2 border-canvas bg-blue shadow-lg"
              aria-hidden="true"
            />
          )}

          {pinMode && !pinAt && (
            <span className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-full bg-canvas/90 px-3 py-1 font-mono text-label uppercase tracking-[0.1em] text-gold">
              Click the spot you mean
            </span>
          )}
        </div>

        {duration > 0 && (
          <div className="relative mt-2 h-6" aria-hidden="true">
            <div className="absolute inset-x-0 top-2.5 h-px bg-hair" />
            {onCurrent
              .filter((c) => c.atSeconds != null)
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => seek(c.atSeconds!)}
                  title={`${c.stamp} ${c.body.slice(0, 60)}`}
                  style={{ left: `${Math.min(100, (c.atSeconds! / duration) * 100)}%` }}
                  className={`tap absolute top-1 h-4 w-1.5 -translate-x-1/2 rounded-full transition-transform hover:scale-y-150 ${
                    c.resolved ? "bg-hair" : c.side === "client" ? "bg-gold" : "bg-blue"
                  }`}
                />
              ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setAsk("approve")}
            className="tap rounded-[8px] bg-brand-gradient px-4 py-2 font-mono text-label font-bold uppercase text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Approve this video
          </button>
          {canRequestChanges ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setAsk("changes")}
              className="tap rounded-[8px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-40"
            >
              Request changes
            </button>
          ) : onMessageStudio ? (
            <button
              type="button"
              onClick={onMessageStudio}
              className="tap rounded-[8px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
            >
              Message the studio
            </button>
          ) : null}
        </div>

        {/* the policy, said before they use it rather than after */}
        <p className="mt-2 text-body-sm text-dim">
          {status === "revisions"
            ? "We are working on your changes. You can still add notes below, and we will pick them up."
            : canRequestChanges
              ? `${revisionsIncluded} round of revisions is included. Please add all of your notes first, then request changes in one go. Further rounds may be charged.`
              : `You have used your ${revisionsUsed} included revision round. Send us a message about anything else and we will sort it out with you.`}
        </p>
      </div>

      <div className="min-w-0">
        <p className="font-mono text-label uppercase tracking-[0.1em] text-dim">
          Notes{open > 0 ? ` (${open} open)` : ""}
        </p>

        <p className="mt-2 text-body-sm text-dim">
          Writing pauses the video. Stop on the exact frame you mean, and pin
          the spot if it helps.
        </p>

        <div className="mt-2 grid gap-2">
          <textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={pause}
            onKeyDown={enterSends(() => send("comment"))}
            placeholder="What would you like changed? Enter to send."
            className={fieldCls}
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-2 text-body-sm text-muted">
              <input
                type="checkbox"
                checked={pin}
                onChange={(e) => setPin(e.target.checked)}
                className="h-4 w-4 accent-[#FCC000]"
              />
              Pin this to {mmss(at)}
            </label>
            <button
              type="button"
              onClick={() => {
                if (pinAt) return setPinAt(null);
                setPinMode((m) => !m);
                pause();
              }}
              className={`tap rounded-[8px] border px-2.5 py-1 font-mono text-label uppercase transition-colors ${
                pinAt || pinMode
                  ? "border-gold text-gold"
                  : "border-hair text-muted hover:border-gold/60 hover:text-gold"
              }`}
            >
              {pinAt ? "Spot pinned, clear" : pinMode ? "Pinning, cancel" : "Point at a spot"}
            </button>
          </div>
          <button
            type="button"
            disabled={busy || !text.trim()}
            onClick={() => send("comment")}
            className="tap justify-self-start rounded-[8px] border border-hair px-3.5 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-40"
          >
            Add note
          </button>
        </div>

        {err && <p className="mt-2 text-body-sm text-error">{err}</p>}

        <div className="mt-4 max-h-[52vh] overflow-y-auto pr-1">
          {comments === null ? (
            <p className="text-body-sm text-muted">Loading notes...</p>
          ) : top.length === 0 ? (
            <p className="text-body-sm text-dim">
              No notes yet. Play the video and add one at the moment you mean.
            </p>
          ) : (
            <>
              <ul className="grid gap-3">{onCurrent.map(note)}</ul>
              {[...byVersion.entries()]
                .sort((a, b) => b[0] - a[0])
                .map(([v, list]) => (
                  <div key={v} className="mt-5">
                    <p className="font-mono text-label uppercase tracking-[0.1em] text-dim">
                      Earlier cut{v ? ` (v${v})` : ""}
                    </p>
                    <ul className="mt-2 grid gap-3 opacity-70">{list.map(note)}</ul>
                  </div>
                ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
