"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { chatGet } from "@/components/chat/api";
import { ChatThread } from "@/components/chat/ChatThread";
import { useFillHeight } from "@/components/chat/useFillHeight";
import { Button, Chip, PageHeader } from "@/components/portal/ui";
import { authHeader, money, when as whenFull } from "./client";

/*
 * The studio inbox, three panes: who, the conversation, and everything we
 * know about them.
 *
 * The list carries search and an unread filter because those are the two
 * ways anybody actually enters an inbox: looking for a person, or working
 * the pile. The right rail exists so answering never means leaving: the
 * contact, what they are worth, their plan, their last emails with sent or
 * failed on each, and the internal notes, all beside the reply box. The
 * rail reads the same customer record and email log the rest of admin
 * reads, so it can never tell a different story.
 */

type Thread = {
  id: string;
  customerId: string | null;
  customerName: string;
  customerEmail: string;
  company: string | null;
  preview: string;
  lastMessageAt: string | null;
  unread: boolean;
};

type RecordLite = {
  customer: { id: string; name: string | null; company: string | null; phone: string | null };
  value: { totalCents: number };
  orders: { id: string }[];
  subscriptions: { planName: string | null; status: string }[];
  videos: unknown[];
  notes: { id: string; body: string; author: string; createdAt: string }[];
};

type MailRow = { id: string; subject: string; status: string; at: string };

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

const initials = (name: string) =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full border border-chrome-line bg-chrome-2 font-mono font-bold text-chrome-text ${
        size === "lg" ? "h-10 w-10 text-body-sm" : "h-9 w-9 text-label"
      }`}
    >
      {initials(name)}
    </span>
  );
}

export function MessagesScreen({
  onOpenCustomer,
}: {
  onOpenCustomer?: (id: string) => void;
}) {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const { ref: fillRef, height: fillHeight } = useFillHeight();

  /* the rail's data, loaded when a thread opens */
  const [record, setRecord] = useState<RecordLite | null>(null);
  const [mails, setMails] = useState<MailRow[] | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);

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

  /* the rail follows the selection */
  useEffect(() => {
    setRecord(null);
    setMails(null);
    setNoteDraft("");
    if (!selected) return;
    let live = true;
    (async () => {
      if (selected.customerId) {
        const r = await fetch(`/api/admin/customers/${selected.customerId}`, {
          headers: await authHeader(),
        });
        const j = await r.json();
        if (live && r.ok) setRecord(j as RecordLite);
      }
      const r2 = await fetch(
        `/api/admin/email-log?q=${encodeURIComponent(selected.customerEmail)}`,
        { headers: await authHeader() },
      );
      const j2 = await r2.json();
      if (live && r2.ok) setMails((j2.entries ?? []).slice(0, 3));
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId]);

  async function addNote() {
    if (!selected?.customerId || !noteDraft.trim()) return;
    setNoteBusy(true);
    try {
      await fetch(`/api/admin/customers/${selected.customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ note: noteDraft }),
      });
      setNoteDraft("");
      const r = await fetch(`/api/admin/customers/${selected.customerId}`, {
        headers: await authHeader(),
      });
      const j = await r.json();
      if (r.ok) setRecord(j as RecordLite);
    } finally {
      setNoteBusy(false);
    }
  }

  const term = q.trim().toLowerCase();
  const shown = useMemo(
    () =>
      (threads ?? []).filter((t) => {
        if (onlyUnread && !t.unread) return false;
        if (!term) return true;
        return [t.customerName, t.customerEmail, t.company, t.preview]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(term));
      }),
    [threads, term, onlyUnread],
  );

  const unreadCount = (threads ?? []).filter((t) => t.unread).length;
  const plan = record?.subscriptions.find((s) => s.status === "active");

  return (
    <div className="w-full">
      <PageHeader
        title="Messages"
        description="Client conversations, newest activity first."
      />

      <div className="grid gap-4 md:grid-cols-[19rem_1fr] xl:grid-cols-[19rem_1fr_18rem]">
        {/* ---- the list ---- */}
        <div
          className={`${selId ? "hidden md:flex" : "flex"} flex-col overflow-hidden rounded-[12px] border border-hair`}
        >
          <div className="grid gap-2 border-b border-hair p-3">
            <div className="relative">
              <Search
                size={14}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim"
              />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Find a client or a message"
                aria-label="Search conversations"
                className="tap w-full rounded-[8px] border border-hair bg-canvas py-2 pl-8 pr-3 text-body-sm text-ink placeholder:text-dim focus:border-gold focus:outline-none"
              />
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" variant={onlyUnread ? "secondary" : "primary"} onClick={() => setOnlyUnread(false)}>
                All
              </Button>
              <Button size="sm" variant={onlyUnread ? "primary" : "secondary"} onClick={() => setOnlyUnread(true)}>
                Unread{unreadCount ? ` ${unreadCount}` : ""}
              </Button>
            </div>
          </div>

          {threads === null ? (
            <p className="p-5 text-body-sm text-muted">Loading...</p>
          ) : shown.length === 0 ? (
            <p className="p-5 text-body-sm text-dim">
              {term || onlyUnread ? "Nothing matches." : "No messages yet."}
            </p>
          ) : (
            <ul className="max-h-[68vh] flex-1 overflow-y-auto">
              {shown.map((t) => (
                <li key={t.id} className="border-t border-hair first:border-t-0">
                  <button
                    type="button"
                    onClick={() => setSelId(t.id)}
                    className={`flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors ${
                      selId === t.id ? "bg-gold/[0.06]" : "hover:bg-hair/40"
                    }`}
                  >
                    <Avatar name={t.customerName} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-body-sm font-semibold text-ink">
                          {t.customerName}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <span className="font-mono text-label uppercase text-dim">
                            {day(t.lastMessageAt)}
                          </span>
                          {t.unread && <span className="h-2 w-2 rounded-full bg-gold" />}
                        </span>
                      </span>
                      <span
                        className={`mt-0.5 block truncate text-body-sm ${t.unread ? "text-ink" : "text-muted"}`}
                      >
                        {t.preview || "No messages yet."}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ---- the conversation ---- */}
        <div
          className={`${selId ? "" : "hidden md:block"} rounded-[12px] border border-hair p-4 md:p-5`}
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
              <div className="mt-2 flex items-center justify-between gap-3 border-b border-hair pb-3 md:mt-0">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={selected.customerName} size="lg" />
                  <div className="min-w-0">
                    <p className="truncate text-body font-semibold text-ink">
                      {selected.customerName}
                    </p>
                    <p className="truncate font-mono text-label uppercase text-dim">
                      {selected.customerEmail}
                      {selected.company ? ` / ${selected.company}` : ""}
                    </p>
                  </div>
                </div>
                {selected.customerId && onOpenCustomer && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<ExternalLink />}
                    onClick={() => onOpenCustomer(selected.customerId!)}
                  >
                    Open record
                  </Button>
                )}
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

        {/* ---- the rail: everything about them, beside the reply box ---- */}
        <div className="hidden xl:block">
          {!selected ? (
            <div className="rounded-[12px] border border-hair p-5">
              <p className="text-body-sm text-dim">
                Open a conversation and the client&apos;s record sits here.
              </p>
            </div>
          ) : (
            <div className="grid max-h-[80vh] gap-3 overflow-y-auto pr-0.5">
              <div className="rounded-[12px] border border-hair bg-surface p-4">
                <p className="font-mono text-label uppercase text-dim">Contact</p>
                <dl className="mt-2 grid gap-1.5 text-body-sm">
                  <dd className="break-all text-ink">{selected.customerEmail}</dd>
                  {record?.customer.company && <dd className="text-muted">{record.customer.company}</dd>}
                  {record?.customer.phone && <dd className="text-muted">{record.customer.phone}</dd>}
                </dl>
              </div>

              {record && (
                <div className="rounded-[12px] border border-hair bg-surface p-4">
                  <p className="font-mono text-label uppercase text-dim">The relationship</p>
                  <dl className="mt-2 grid gap-1.5 text-body-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-muted">Paid, all time</dt>
                      <dd className="font-semibold tabular-nums text-gold">
                        {money(record.value.totalCents)}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-muted">Orders</dt>
                      <dd className="tabular-nums text-ink">{record.orders.length}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-muted">Videos</dt>
                      <dd className="tabular-nums text-ink">{record.videos.length}</dd>
                    </div>
                    {plan && (
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-muted">Plan</dt>
                        <dd className="text-ink">{plan.planName}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              <div className="rounded-[12px] border border-hair bg-surface p-4">
                <p className="font-mono text-label uppercase text-dim">Last emails</p>
                {mails === null ? (
                  <p className="mt-2 text-body-sm text-muted">Loading...</p>
                ) : mails.length === 0 ? (
                  <p className="mt-2 text-body-sm text-dim">Nothing recorded yet.</p>
                ) : (
                  <ul className="mt-2 grid gap-2">
                    {mails.map((m) => (
                      <li key={m.id} className="flex items-start justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate text-body-sm text-muted">
                          {m.subject}
                        </span>
                        <Chip
                          tone={
                            m.status === "sent" ? "good" : m.status === "failed" ? "bad" : "warn"
                          }
                        >
                          {m.status}
                        </Chip>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-[12px] border border-hair bg-surface p-4">
                <p className="font-mono text-label uppercase text-dim">Internal notes</p>
                {record ? (
                  <>
                    {record.notes.length > 0 && (
                      <ul className="mt-2 grid gap-2">
                        {record.notes.slice(0, 3).map((n) => (
                          <li key={n.id} className="text-body-sm">
                            <p className="whitespace-pre-wrap text-muted">{n.body}</p>
                            <p className="mt-0.5 font-mono text-label uppercase text-dim">
                              {n.author.split("@")[0]} / {whenFull(n.createdAt)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-2.5 grid gap-2">
                      <textarea
                        rows={2}
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="A note only the team sees"
                        aria-label="Add an internal note"
                        className="tap w-full rounded-[8px] border border-hair bg-canvas px-3 py-2 text-body-sm text-ink placeholder:text-dim focus:border-gold focus:outline-none"
                      />
                      {noteDraft.trim() && (
                        <Button size="sm" variant="primary" disabled={noteBusy} onClick={addNote}>
                          {noteBusy ? "Saving..." : "Save the note"}
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-body-sm text-dim">
                    No customer record is linked to this thread.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
