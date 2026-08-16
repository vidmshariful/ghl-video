"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/*
 * Reviewing one video: watch it, say what you want changed at the second it
 * happens, approve it when it is right.
 *
 * The timestamp is the point. "The logo at 0:12 is stretched" saves an email
 * thread and a guess. It is offered, never forced: a note about the whole
 * video is just as real, so the pin is a toggle and defaults to wherever the
 * player is paused.
 *
 * Notes are labelled by which CUT they were written about, never by an
 * internal round number. "Round 2" told a client nothing; "on v1" points at
 * something they can actually go and watch.
 */

type Comment = {
  id: string;
  side: "client" | "studio";
  name: string;
  body: string;
  atSeconds: number | null;
  stamp: string | null;
  round: number;
  version: number | null;
  parentId: string | null;
  resolved: boolean;
  createdAt: string;
};

type Version = {
  id: string;
  version: number;
  videoUrl: string;
  note: string | null;
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
  onChanged,
  authedFetch,
}: {
  videoId: string;
  title: string;
  videoUrl: string;
  status: string;
  onChanged: () => void;
  authedFetch: (path: string, init?: RequestInit) => Promise<unknown>;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [showing, setShowing] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [pin, setPin] = useState(true);
  const [at, setAt] = useState(0);
  const [duration, setDuration] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const load = useCallback(async () => {
    const j = (await authedFetch(`/api/portal/videos/${videoId}/review`).catch(() => null)) as {
      comments?: Comment[];
      versions?: Version[];
    } | null;
    setComments(j?.comments ?? []);
    setVersions(j?.versions ?? []);
  }, [authedFetch, videoId]);

  useEffect(() => {
    load();
  }, [load]);

  const latest = versions[0]?.version ?? null;
  const viewing = showing ?? latest;
  const src = versions.find((v) => v.version === viewing)?.videoUrl ?? videoUrl;
  const onOldCut = latest != null && viewing != null && viewing !== latest;

  async function send(action: "comment" | "approve" | "changes", opts?: { parentId?: string; body?: string }) {
    const message = opts?.body ?? text;
    if (action === "comment" && !message.trim()) return;
    if (action === "approve" && !confirm(`Approve ${title}? This tells the studio it is finished.`))
      return;
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
    }
    await load();
    onChanged();
  }

  function seek(s: number) {
    const v = ref.current;
    if (!v) return;
    v.currentTime = s;
    v.play().catch(() => {});
  }

  /* Enter sends, shift and enter makes a new line. Typing a sentence and
     pressing enter is what everyone expects from a comment box. */
  const enterSends =
    (fn: () => void) => (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        fn();
      }
    };

  const top = (comments ?? []).filter((c) => !c.parentId);
  const repliesOf = (id: string) => (comments ?? []).filter((c) => c.parentId === id);
  const open = top.filter((c) => !c.resolved && c.side === "client").length;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div>
        {versions.length > 1 && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-label uppercase tracking-[0.1em] text-dim">Cut</span>
            {versions.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setShowing(v.version)}
                className={`tap rounded-full border px-2.5 py-0.5 font-mono text-label transition-colors ${
                  viewing === v.version
                    ? "border-gold bg-gold text-canvas"
                    : "border-hair text-muted hover:border-gold/60 hover:text-gold"
                }`}
              >
                v{v.version}
                {v.version === latest ? " (latest)" : ""}
              </button>
            ))}
          </div>
        )}

        <video
          ref={ref}
          key={src}
          controls
          preload="metadata"
          playsInline
          src={src}
          onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          className="aspect-video w-full rounded-[8px] bg-canvas"
        />

        {onOldCut && (
          <p className="mt-2 text-body-sm text-gold">
            You are watching an older cut. Switch to v{latest} for the newest one.
          </p>
        )}

        {duration > 0 && (
          <div className="relative mt-2 h-6" aria-hidden="true">
            <div className="absolute inset-x-0 top-2.5 h-px bg-hair" />
            {top
              .filter((c) => c.atSeconds != null && (c.version ?? latest) === viewing)
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
            disabled={busy || status === "approved"}
            onClick={() => send("approve")}
            className="tap rounded-[8px] bg-brand-gradient px-4 py-2 font-mono text-label font-bold uppercase text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {status === "approved" ? "Approved" : "Approve this video"}
          </button>
          <button
            type="button"
            disabled={busy || status === "revisions"}
            onClick={() => send("changes")}
            className="tap rounded-[8px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-40"
          >
            {status === "revisions" ? "Changes requested" : "Request changes"}
          </button>
        </div>
        {status === "revisions" && (
          <p className="mt-2 text-body-sm text-dim">
            We are working on your changes. Add any more notes below.
          </p>
        )}
      </div>

      <div className="min-w-0">
        <p className="font-mono text-label uppercase tracking-[0.1em] text-dim">
          Notes{open > 0 ? ` (${open} open)` : ""}
        </p>

        <div className="mt-2 grid gap-2">
          <textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={enterSends(() => send("comment"))}
            placeholder="What would you like changed? Enter to send."
            className={fieldCls}
          />
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
            disabled={busy || !text.trim()}
            onClick={() => send("comment")}
            className="tap justify-self-start rounded-[8px] border border-hair px-3.5 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-40"
          >
            Add note
          </button>
        </div>

        {err && <p className="mt-2 text-body-sm text-error">{err}</p>}

        <ul className="mt-4 grid max-h-[26rem] gap-3 overflow-y-auto pr-1">
          {comments === null ? (
            <li className="text-body-sm text-muted">Loading notes...</li>
          ) : top.length === 0 ? (
            <li className="text-body-sm text-dim">
              No notes yet. Play the video and add one at the moment you mean.
            </li>
          ) : (
            top.map((c) => (
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
                  {c.resolved && (
                    <span className="font-mono text-label uppercase text-green">Done</span>
                  )}
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-body-sm text-muted">{c.body}</p>
                <p className="mt-1 font-mono text-label uppercase tracking-[0.1em] text-dim">
                  {when(c.createdAt)}
                  {c.version && versions.length > 1 ? ` / on v${c.version}` : ""}
                </p>

                {repliesOf(c.id).map((r) => (
                  <div
                    key={r.id}
                    className="mt-2 border-l-2 border-blue/40 pl-3"
                  >
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
                      onKeyDown={enterSends(() =>
                        send("comment", { parentId: c.id, body: replyText }),
                      )}
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
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
