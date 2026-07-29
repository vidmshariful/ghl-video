"use client";

import { useCallback, useEffect, useState } from "react";
import { chatGet } from "@/components/chat/api";
import { ChatThread } from "@/components/chat/ChatThread";
import { useFillHeight } from "@/components/chat/useFillHeight";

/*
 * The studio inbox: every client conversation on the left, the open thread on
 * the right (stacked on mobile). Replies + attachments go through the shared
 * ChatThread with selfRole="studio". Polls the list so unread + previews stay
 * fresh while a thread is open.
 */
type Thread = {
  id: string;
  orderId: string | null;
  title: string;
  customerName: string;
  customerEmail: string;
  company: string | null;
  preview: string;
  lastMessageAt: string | null;
  unread: boolean;
};

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

export function MessagesScreen() {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const { ref: fillRef, height: fillHeight } = useFillHeight();

  const load = useCallback(async () => {
    const j = await chatGet<{ threads?: Thread[] }>("/api/admin/conversations");
    setThreads(j.threads ?? []);
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 15000);
    return () => window.clearInterval(t);
  }, [load]);

  const selected = selId ? (threads?.find((t) => t.id === selId) ?? null) : null;

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-h3 text-ink">Messages</h1>
      <p className="mt-2 text-body text-muted">Client conversations, newest activity first.</p>

      <div className="mt-6 grid gap-4 md:grid-cols-[20rem_1fr]">
        <div
          className={`${selId ? "hidden md:block" : ""} overflow-hidden rounded-card border border-hair`}
        >
          {threads === null ? (
            <p className="p-5 text-body-sm text-muted">Loading...</p>
          ) : threads.length === 0 ? (
            <p className="p-5 text-body-sm text-dim">No messages yet.</p>
          ) : (
            <ul className="max-h-[70vh] overflow-y-auto">
              {threads.map((t) => (
                <li key={t.id} className="border-t border-hair first:border-t-0">
                  <button
                    type="button"
                    onClick={() => setSelId(t.id)}
                    className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors ${
                      selId === t.id ? "bg-gold/[0.06]" : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-body font-semibold text-ink">
                        {t.customerName}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {t.lastMessageAt ? (
                          <span className="font-mono text-label uppercase text-dim">
                            {when(t.lastMessageAt)}
                          </span>
                        ) : null}
                        {t.unread ? <span className="h-2 w-2 rounded-full bg-gold" /> : null}
                      </span>
                    </span>
                    <span className="truncate font-mono text-label uppercase text-gold/70">
                      {t.title}
                    </span>
                    <span className="truncate text-body-sm text-muted">
                      {t.preview || "No messages yet."}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          className={`${selId ? "" : "hidden md:block"} rounded-card border border-hair p-4 md:p-5`}
        >
          {!selected ? (
            <div className="grid h-full min-h-[50vh] place-items-center">
              <p className="text-body-sm text-dim">Select a conversation.</p>
            </div>
          ) : (
            <div ref={fillRef} style={{ height: fillHeight }} className="flex flex-col">
              <button
                type="button"
                onClick={() => setSelId(null)}
                className="tap self-start font-mono text-label uppercase text-muted transition-colors hover:text-gold md:hidden"
              >
                &larr; All messages
              </button>
              <div className="mt-2 border-b border-hair pb-3 md:mt-0">
                <p className="text-body font-semibold text-ink">{selected.customerName}</p>
                <p className="font-mono text-label uppercase text-dim">
                  {selected.customerEmail}
                  {selected.company ? ` · ${selected.company}` : ""} · {selected.title}
                </p>
              </div>
              <div className="mt-3 min-h-0 flex-1">
                <ChatThread
                  key={selected.id}
                  base={`/api/admin/conversations/${selected.id}`}
                  selfRole="studio"
                  onActivity={load}
                  emptyLine="No messages yet. Say hello to your client."
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
