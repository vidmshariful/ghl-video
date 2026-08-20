"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { chatGet, chatPostJson } from "@/components/chat/api";
import { PageHeader } from "@/components/portal/ui";
import { ChatThread } from "@/components/chat/ChatThread";
import { useFillHeight } from "@/components/chat/useFillHeight";

/*
 * The portal Messages tab: one conversation, full stop.
 *
 * It used to be a General thread plus one per project, which put the same
 * three-tab question in front of the client that the studio's screen had:
 * which inbox is my conversation in. One inbox per client now (owner
 * decision, August 2026); the thread is ensured on open and everything
 * lands in it. pendingOrderId is still accepted so an order's "Message the
 * studio" button keeps working; it simply opens the one inbox.
 */
export function MessagesView({
  pendingOrderId,
  onConsumePending,
  onUnread,
}: {
  pendingOrderId?: string | null;
  onConsumePending?: () => void;
  onUnread?: (n: number) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const { ref: fillRef, height: fillHeight } = useFillHeight();
  const onUnreadRef = useRef(onUnread);
  useEffect(() => {
    onUnreadRef.current = onUnread;
  });

  const open = useCallback(async () => {
    const j = await chatPostJson<{ id?: string }>("/api/portal/conversations/ensure", {});
    if (j.id) setOpenId(j.id);
  }, []);

  useEffect(() => {
    void open();
  }, [open]);

  /* the unread badge in the shell still needs feeding */
  useEffect(() => {
    const load = async () => {
      const j = await chatGet<{ unreadCount?: number }>("/api/portal/conversations");
      onUnreadRef.current?.(j.unreadCount ?? 0);
    };
    void load();
    const t = window.setInterval(load, 15000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!pendingOrderId) return;
    onConsumePending?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOrderId]);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Messages"
        description="Talk to the studio. Everything about your work lands in one place."
      />
      <div ref={fillRef} className="min-h-0 flex-1" style={{ height: fillHeight ?? undefined }}>
        {openId ? (
          <ChatThread
            base={`/api/portal/conversations/${openId}`}
            selfRole="customer"
            emptyLine="Say hello. A real person answers, usually within the hour."
          />
        ) : (
          <p className="text-body-sm text-muted">Opening your conversation...</p>
        )}
      </div>
    </div>
  );
}
