"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { chatGet, chatPostForm, type ChatMessage } from "./api";

/*
 * One conversation: a scrolling message list plus a composer with file
 * attachments. Reused by the portal (selfRole="customer") and the admin inbox
 * (selfRole="studio"); `base` is the conversation's route root, e.g.
 * /api/portal/conversations/<id> or /api/admin/conversations/<id>. Polls every
 * few seconds (no websockets), and only swaps the list when the tail actually
 * changes so re-signed attachment URLs don't reload images mid-read.
 */
const timeLabel = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
const isImage = (t: string) => t.startsWith("image/") && t !== "image/svg+xml";
const fileSize = (n: number) =>
  n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`;

export function ChatThread({
  base,
  selfRole,
  onActivity,
  emptyLine = "No messages yet.",
}: {
  base: string;
  selfRole: "customer" | "studio";
  onActivity?: () => void;
  emptyLine?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const countRef = useRef(0);
  const onActivityRef = useRef(onActivity);
  useEffect(() => {
    onActivityRef.current = onActivity;
  });

  const load = useCallback(async () => {
    const j = await chatGet<{ messages?: ChatMessage[] }>(`${base}/messages`);
    const next = j.messages ?? [];
    setMessages((prev) => {
      if (
        prev &&
        prev.length === next.length &&
        prev[prev.length - 1]?.id === next[next.length - 1]?.id
      ) {
        return prev; // unchanged; keep current so signed image URLs don't reload
      }
      return next;
    });
  }, [base]);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 5000);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!messages || messages.length === countRef.current) return;
    countRef.current = messages.length;
    onActivityRef.current?.();
    const el = scrollRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [messages]);

  function pick(list: FileList | null) {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, 6));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function doSend() {
    if (busy) return;
    const body = text.trim();
    if (!body && files.length === 0) return;
    setBusy(true);
    setErr("");
    const form = new FormData();
    form.set("body", body);
    files.forEach((f) => form.append("files", f));
    const j = await chatPostForm<{ message?: ChatMessage; error?: string }>(
      `${base}/messages`,
      form,
    );
    setBusy(false);
    if (j.error) {
      setErr(j.error);
      return;
    }
    setText("");
    setFiles([]);
    const msg = j.message;
    if (msg) setMessages((m) => [...(m ?? []), msg]);
    onActivityRef.current?.();
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-1 py-2">
        {messages === null ? (
          <p className="text-body-sm text-muted">Loading...</p>
        ) : messages.length === 0 ? (
          <p className="text-body-sm text-dim">{emptyLine}</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderRole === selfRole;
            const studio = m.senderRole === "studio";
            return (
              <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <span className="mb-1 font-mono text-label uppercase text-dim">
                  {studio ? "GHL Video" : m.senderName || "Client"} · {timeLabel(m.createdAt)}
                </span>
                <div
                  className={`max-w-[85%] rounded-[10px] border px-3.5 py-2.5 ${
                    studio ? "border-gold/20 bg-gold/[0.08]" : "border-hair bg-surface"
                  }`}
                >
                  {m.body ? (
                    <p className="whitespace-pre-wrap break-words text-body text-ink">{m.body}</p>
                  ) : null}
                  {m.attachments.length > 0 ? (
                    <div className={`flex flex-wrap gap-2 ${m.body ? "mt-2" : ""}`}>
                      {m.attachments.map((a, i) =>
                        a.url && isImage(a.type) ? (
                          <a key={i} href={a.url} target="_blank" rel="noopener">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={a.url}
                              alt={a.name}
                              className="max-h-44 rounded-[6px] border border-hair object-cover"
                            />
                          </a>
                        ) : (
                          <a
                            key={i}
                            href={a.url ?? "#"}
                            target="_blank"
                            rel="noopener"
                            className="flex items-center gap-2 rounded-[6px] border border-hair bg-canvas px-3 py-2 text-body-sm text-ink transition-colors hover:border-gold/60"
                          >
                            <span className="font-mono text-label uppercase text-gold">File</span>
                            <span className="max-w-[12rem] truncate">{a.name}</span>
                            <span className="shrink-0 text-dim">{fileSize(a.size)}</span>
                          </a>
                        ),
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); doSend(); }} className="mt-3 border-t border-hair pt-3">
        {files.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {files.map((f, i) => (
              <span
                key={i}
                className="flex items-center gap-2 rounded-[4px] border border-hair bg-surface px-2.5 py-1 text-body-sm text-muted"
              >
                <span className="max-w-[10rem] truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  className="tap text-dim hover:text-error"
                  aria-label={`Remove ${f.name}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
        {err ? <p className="mb-2 text-body-sm text-error">{err}</p> : null}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="tap shrink-0 rounded-[3px] border border-hair px-3 py-2.5 text-muted transition-colors hover:border-gold/60 hover:text-gold"
            aria-label="Attach a file"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            onChange={(e) => pick(e.target.files)}
            className="hidden"
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            placeholder="Write a message..."
            className="max-h-40 min-h-[44px] flex-1 resize-y rounded-[3px] border border-hair bg-surface px-3 py-2.5 text-body text-ink placeholder:text-dim focus:border-gold focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || (!text.trim() && files.length === 0)}
            className="tap shrink-0 rounded-[3px] bg-brand-gradient px-5 py-2.5 text-body-sm font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Sending..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
