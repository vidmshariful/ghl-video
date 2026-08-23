"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Textarea } from "@/components/portal/ui";
import { ShareVideo } from "./ShareVideo";
import { ConfirmDialog } from "./ConfirmDialog";

/*
 * Reviewing one production-line stage, whatever its medium.
 *
 * The script is a document, the voiceover is audio, the concept is a PDF, the
 * animation and the final cut are video. All of them open the same room: the
 * work on one side, a thread of notes on the other, and, for the two video
 * gates, Approve and Request changes. A note on audio or video pins to the
 * second it is about, exactly the way the animation review the client already
 * liked does. Feedback everywhere else is a plain note. Never inline; always
 * this full-screen room (owner rule).
 */

type Medium = "doc" | "audio" | "pdf" | "video";

type Note = {
  id: string;
  side: "client" | "studio";
  name: string;
  body: string;
  atSeconds: number | null;
  stamp: string | null;
  parentId: string | null;
  resolved: boolean;
  at: string;
};

type Data = {
  label: string;
  medium: Medium;
  url: string | null;
  state: string;
  canApprove: boolean;
  comments: Note[];
};

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/* a Google Doc share link embeds read-only through /preview */
const docEmbed = (url: string) => url.replace(/\/(edit|view)(\?[^#]*)?(#.*)?$/, "/preview");

export function StageReview({
  projectId,
  stageKey,
  videoId,
  authedFetch,
  onClose,
  onChanged,
}: {
  projectId: string;
  stageKey: string;
  /* the main carrier id, so the video Share link points at a real deliverable */
  videoId: string | null;
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  onClose: () => void;
  onChanged: () => void;
}) {
  const media = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const [d, setD] = useState<Data | null>(null);
  const [text, setText] = useState("");
  const [pin, setPin] = useState(true);
  const [at, setAt] = useState(0);
  const [duration, setDuration] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [ask, setAsk] = useState<null | "approve" | "changes">(null);
  const [sharing, setSharing] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const load = useCallback(async () => {
    const j = (await authedFetch(
      `/api/portal/projects/${projectId}/stage-review?stage=${stageKey}`,
    ).catch(() => null)) as Data | null;
    if (j && !("error" in j)) setD(j);
  }, [authedFetch, projectId, stageKey]);
  useEffect(() => {
    void load();
  }, [load]);

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

  const timed = d?.medium === "audio" || d?.medium === "video";

  async function send(action: "comment" | "approve" | "changes", opts?: { parentId?: string; body?: string }) {
    const body = opts?.body ?? text;
    if (action === "comment" && !body.trim()) return;
    setBusy(true);
    setErr("");
    const j = (await authedFetch(`/api/portal/projects/${projectId}/stage-review`, {
      method: "POST",
      body: JSON.stringify({
        stage: stageKey,
        action,
        body,
        atSeconds: action === "comment" && !opts?.parentId && timed && pin ? at : null,
        parentId: opts?.parentId ?? null,
      }),
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
    const v = media.current;
    if (!v) return;
    v.currentTime = s;
    v.play?.().catch(() => {});
  }
  const pause = () => media.current?.pause();
  const enterSends = (fn: () => void) => (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      fn();
    }
  };

  if (!mounted) return null;

  const top = (d?.comments ?? []).filter((c) => !c.parentId);
  const repliesOf = (id: string) => (d?.comments ?? []).filter((c) => c.parentId === id);
  const open = top.filter((c) => !c.resolved && c.side === "client").length;

  const viewer = () => {
    if (!d?.url) return <p className="text-body-sm text-dim">Nothing to review here yet.</p>;
    if (d.medium === "video")
      return (
        <video
          ref={media}
          controls
          autoPlay
          preload="metadata"
          playsInline
          src={d.url}
          onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          className="max-h-[62vh] w-full rounded-[8px] bg-black"
        />
      );
    if (d.medium === "audio")
      return (
        <div className="rounded-[8px] border border-hair bg-canvas p-5">
          <p className="mb-3 font-mono text-label uppercase tracking-[0.08em] text-dim">
            Listen, and pin a note to the moment you mean
          </p>
          <audio
            ref={media}
            controls
            preload="metadata"
            src={d.url}
            onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
            className="w-full"
          />
        </div>
      );
    if (d.medium === "pdf")
      return (
        <div className="overflow-hidden rounded-[8px] border border-hair bg-canvas">
          <iframe src={d.url} title={d.label} className="h-[62vh] w-full border-0" />
        </div>
      );
    /* doc */
    return (
      <div className="overflow-hidden rounded-[8px] border border-hair bg-white">
        <iframe src={docEmbed(d.url)} title={d.label} className="h-[62vh] w-full border-0" />
      </div>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-canvas/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={d?.label ?? "Review"}
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
          {ask && (
            <ConfirmDialog
              title={ask === "approve" ? `Approve ${d?.label}?` : "Send your notes and ask for changes?"}
              body={
                ask === "approve"
                  ? "This tells the studio it is finished. You will still be able to watch and download it."
                  : "Put every note in first, then we do them in one pass."
              }
              confirmLabel={ask === "approve" ? "Yes, approve it" : "Yes, send them"}
              tone={ask === "approve" ? "green" : "gold"}
              onConfirm={() => {
                const a = ask;
                setAsk(null);
                void send(a);
              }}
              onCancel={() => setAsk(null)}
            />
          )}

          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-h3 leading-tight text-ink">{d?.label ?? "Review"}</h2>
              <p className="mt-1 font-mono text-label uppercase tracking-[0.1em] text-dim">Your review</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {d?.medium === "video" && videoId && (
                <button
                  type="button"
                  onClick={() => setSharing(true)}
                  className="tap rounded-[8px] border border-hair px-3 py-1.5 font-mono text-label uppercase text-muted transition-colors hover:border-green/60 hover:text-green"
                >
                  Share
                </button>
              )}
              {d?.url && (
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tap rounded-[8px] border border-hair px-3 py-1.5 font-mono text-label uppercase text-muted transition-colors hover:border-blue/60 hover:text-blue"
                >
                  Open
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                className="tap rounded-[8px] border border-hair px-3 py-1.5 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
              >
                Close
              </button>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div>
              {viewer()}

              {timed && duration > 0 && (
                <div className="relative mt-2 h-6" aria-hidden="true">
                  <div className="absolute inset-x-0 top-2.5 h-px bg-hair" />
                  {top
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

              {d?.canApprove && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="brand" disabled={busy} onClick={() => setAsk("approve")}>
                    Approve {d.label}
                  </Button>
                  <Button variant="secondary" disabled={busy} onClick={() => setAsk("changes")}>
                    Request changes
                  </Button>
                </div>
              )}
            </div>

            <div className="min-w-0">
              <p className="font-mono text-label uppercase tracking-[0.1em] text-dim">
                Feedback{open > 0 ? ` (${open} open)` : ""}
              </p>
              <div className="mt-2 grid gap-2">
                <Textarea
                  rows={3}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onFocus={timed ? pause : undefined}
                  onKeyDown={enterSends(() => send("comment"))}
                  placeholder="What do you think, what would you change? Enter to send."
                />
                {timed && (
                  <label className="flex items-center gap-2 text-body-sm text-muted">
                    <input
                      type="checkbox"
                      checked={pin}
                      onChange={(e) => setPin(e.target.checked)}
                      className="h-4 w-4 accent-[var(--gold)]"
                    />
                    Pin this to {mmss(at)}
                  </label>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy || !text.trim()}
                  onClick={() => send("comment")}
                >
                  Add note
                </Button>
              </div>
              {err && <p className="mt-2 text-body-sm text-error">{err}</p>}

              <div className="mt-4 max-h-[52vh] overflow-y-auto pr-1">
                {top.length === 0 ? (
                  <p className="text-body-sm text-dim">
                    No notes yet. {timed ? "Play it and add one at the moment you mean." : "Add one below."}
                  </p>
                ) : (
                  <ul className="grid gap-3">
                    {top.map((c) => (
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
                        <p className="mt-1 font-mono text-label uppercase tracking-[0.1em] text-dim">{when(c.at)}</p>

                        {repliesOf(c.id).map((r) => (
                          <div key={r.id} className="mt-2 border-l-2 border-blue/40 pl-3">
                            <span className="text-body-sm font-semibold text-ink">{r.name}</span>
                            <p className="mt-0.5 whitespace-pre-wrap text-body-sm text-muted">{r.body}</p>
                          </div>
                        ))}

                        {replyTo === c.id ? (
                          <div className="mt-2 grid gap-2">
                            <Textarea
                              rows={2}
                              autoFocus
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              onKeyDown={enterSends(() => send("comment", { parentId: c.id, body: replyText }))}
                              placeholder="Reply. Enter to send."
                            />
                            <div className="flex gap-2">
                              <Button size="sm" disabled={busy || !replyText.trim()} onClick={() => send("comment", { parentId: c.id, body: replyText })}>
                                Send
                              </Button>
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
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {sharing && videoId && (
        <ShareVideo videoId={videoId} title={d?.label ?? "Video"} authedFetch={authedFetch} onClose={() => setSharing(false)} />
      )}
    </div>,
    document.body,
  );
}
