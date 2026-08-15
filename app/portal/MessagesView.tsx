"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { chatGet, chatPostJson } from "@/components/chat/api";
import { ChatThread } from "@/components/chat/ChatThread";
import { useFillHeight } from "@/components/chat/useFillHeight";

/*
 * The portal Messages tab: a General thread plus one per project. Opening a
 * thread ensures it exists server-side, then hands off to the shared
 * ChatThread. pendingOrderId lets an order's "Message the studio" button deep
 * link straight into that project's thread.
 */
type Thread = {
  id: string;
  orderId: string | null;
  title: string;
  preview: string;
  lastMessageAt: string | null;
  unread: boolean;
};

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

export function MessagesView({
  pendingOrderId,
  onConsumePending,
  onUnread,
}: {
  pendingOrderId?: string | null;
  onConsumePending?: () => void;
  onUnread?: (n: number) => void;
}) {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const { ref: fillRef, height: fillHeight } = useFillHeight();
  const onUnreadRef = useRef(onUnread);
  useEffect(() => {
    onUnreadRef.current = onUnread;
  });

  const loadList = useCallback(async () => {
    const j = await chatGet<{ threads?: Thread[]; unreadCount?: number }>(
      "/api/portal/conversations",
    );
    setThreads(j.threads ?? []);
    onUnreadRef.current?.(j.unreadCount ?? 0);
  }, []);

  useEffect(() => {
    loadList();
    const t = window.setInterval(loadList, 15000);
    return () => window.clearInterval(t);
  }, [loadList]);

  const openByOrder = useCallback(
    async (orderId: string | null) => {
      const j = await chatPostJson<{ id?: string }>("/api/portal/conversations/ensure", {
        orderId,
      });
      if (j.id) {
        setOpenId(j.id);
        loadList();
      }
    },
    [loadList],
  );

  useEffect(() => {
    if (!pendingOrderId) return;
    openByOrder(pendingOrderId);
    onConsumePending?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOrderId]);

  if (openId) {
    const title = threads?.find((t) => t.id === openId)?.title ?? "Conversation";
    return (
      <div ref={fillRef} style={{ height: fillHeight }} className="flex flex-col">
        <button
          type="button"
          onClick={() => {
            setOpenId(null);
            loadList();
          }}
          className="tap self-start font-mono text-label uppercase text-muted transition-colors hover:text-gold"
        >
          &larr; All messages
        </button>
        <h2 className="mt-3 font-display text-h4 text-ink">{title}</h2>
        <div className="mt-3 min-h-0 flex-1">
          <ChatThread
            base={`/api/portal/conversations/${openId}`}
            selfRole="customer"
            onActivity={loadList}
            emptyLine="Start the conversation with your producer."
          />
        </div>
      </div>
    );
  }

  const general = threads?.find((t) => t.orderId === null) ?? null;
  const projectThreads = (threads ?? []).filter((t) => t.orderId !== null);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-h2 text-ink">Messages</h1>
        <p className="mt-2 text-body text-muted">Talk to your producer about anything.</p>
      </div>
      <button
        type="button"
        onClick={() => (general ? setOpenId(general.id) : openByOrder(null))}
        className="tap flex w-full items-center justify-between gap-4 rounded-[12px] border border-hair bg-surface px-5 py-4 text-left transition-colors hover:border-gold/40"
      >
        <div className="min-w-0">
          <p className="text-body font-semibold text-ink">General</p>
          <p className="mt-0.5 truncate text-body-sm text-muted">
            {general?.preview || "Message the studio about anything."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {general?.lastMessageAt ? (
            <span className="font-mono text-label uppercase text-dim">
              {day(general.lastMessageAt)}
            </span>
          ) : null}
          {general?.unread ? <span className="h-2.5 w-2.5 rounded-full bg-gold" /> : null}
        </div>
      </button>

      {projectThreads.length > 0 ? (
        <>
          <p className="mt-8 font-mono text-label uppercase text-dim">By project</p>
          <ul className="mt-3 overflow-hidden rounded-[12px] border border-hair">
            {projectThreads.map((t) => (
              <li key={t.id} className="border-t border-hair first:border-t-0">
                <button
                  type="button"
                  onClick={() => setOpenId(t.id)}
                  className="flex w-full items-center justify-between gap-4 bg-surface px-5 py-4 text-left transition-colors hover:bg-hair/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-body font-semibold text-ink">{t.title}</p>
                    <p className="mt-0.5 truncate text-body-sm text-muted">
                      {t.preview || "No messages yet."}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {t.lastMessageAt ? (
                      <span className="font-mono text-label uppercase text-dim">
                        {day(t.lastMessageAt)}
                      </span>
                    ) : null}
                    {t.unread ? <span className="h-2.5 w-2.5 rounded-full bg-gold" /> : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <p className="mt-6 text-body-sm text-dim">
        To message us about a specific project, open it under Orders and use Message the studio.
      </p>
    </div>
  );
}
