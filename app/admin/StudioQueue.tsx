"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Textarea } from "@/components/portal/ui";
import { authHeader } from "./client";

/*
 * What needs the studio, as a list of videos.
 *
 * Every other screen here is organised by order, which is how we sell but not
 * how we work. Four pack orders is thirty six videos, and finding the three
 * that need somebody meant opening four jobs and reading nine rows in each.
 *
 * Ordered by what should be dealt with first: a client waiting on an answer
 * beats a video nobody has started, because one of those has a person on the
 * other end wondering if we read it.
 *
 * Since the Premade review (16 September 2026) the list can also act: a
 * note is answered here, a client without a brief is nudged or has their
 * emailed brief entered for them, and a video sitting with the client is
 * nudged or approved for them, without opening the job.
 */

type Item = {
  bucket: "answer" | "revisions" | "brief" | "start" | "waiting";
  /* which kind of work, so a click knows which screen owns it */
  kind: "purchase" | "project" | "plan";
  projectId: string | null;
  editingSlug: string | null;
  videoId: string;
  orderId: string | null;
  title: string;
  status: string;
  revisionRound: number;
  hasLink: boolean;
  openNotes: number;
  latestNote: string | null;
  latestNoteId: string | null;
  waitingDays: number | null;
  sinceDays: number | null;
  /* the promised date, worded by the server */
  due?: { text: string; tone: string } | null;
  customer: string;
  invoice: string | null;
  product: string;
  ownerEmail: string | null;
  ownerName: string | null;
};

const BUCKETS = [
  {
    key: "answer" as const,
    label: "Answer the client",
    hint: "They left a note and nobody has replied or ticked it off. Answer it here.",
    tone: "border-error/40 text-error",
  },
  {
    key: "revisions" as const,
    label: "Changes to make",
    hint: "The client asked for changes and we have not sent a new cut.",
    tone: "border-gold/50 text-gold",
  },
  {
    key: "brief" as const,
    label: "No brief yet",
    hint: "Paid, and nothing can start until the brief lands. Nudge them, or enter what they sent by email.",
    tone: "border-gold/50 text-gold",
  },
  {
    key: "start" as const,
    label: "Ready to start",
    hint: "Paid, brief is in, nothing built yet.",
    tone: "border-hair text-muted",
  },
  {
    key: "waiting" as const,
    label: "With the client",
    hint: "Sent and waiting on them. The oldest first: nudge, or approve for them.",
    tone: "border-blue/50 text-blue",
  },
];

/* how many "with the client" rows show before the rest fold away */
const WAITING_SHOWN = 5;

export function StudioQueue({
  kind,
  onOpenJob,
  onOpenProject,
  onOpenEditing,
}: {
  /* one kind of work only, for a board that owns one kind */
  kind?: "purchase" | "project" | "plan";
  onOpenJob: (orderId: string) => void;
  onOpenProject: (projectId: string) => void;
  onOpenEditing: (slug: string) => void;
}) {
  /* the queue lists all three kinds of work, and each lives on its own
     screen: a purchase opens its production job, a custom project opens the
     project, plan work opens that client's editing board */
  const open = (i: Item) => {
    if (i.kind === "project" && i.projectId) return onOpenProject(i.projectId);
    if (i.kind === "plan" && i.editingSlug) return onOpenEditing(i.editingSlug);
    if (i.orderId) return onOpenJob(i.orderId);
  };
  const [items, setItems] = useState<Item[] | null>(null);
  const [owners, setOwners] = useState<{ email: string; name: string }[]>([]);
  const [me, setMe] = useState("");
  const [mine, setMine] = useState(false);
  const [err, setErr] = useState("");
  const [allWaiting, setAllWaiting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  /* one line of feedback under the row that was acted on */
  const [flash, setFlash] = useState<{ id: string; text: string; bad?: boolean } | null>(null);
  const [reply, setReply] = useState<{ id: string; text: string } | null>(null);

  const load = useCallback(async () => {
    setErr("");
    try {
      const r = await fetch(`/api/admin/studio/queue${kind ? `?kind=${kind}` : ""}`, {
        headers: await authHeader(),
      });
      const j = await r.json();
      if (!r.ok) return setErr(j.error ?? "Could not load the queue.");
      setItems(j.items as Item[]);
      setOwners(j.owners ?? []);
      setMe(j.me ?? "");
    } catch {
      setErr("Could not load the queue.");
    }
  }, [kind]);

  useEffect(() => {
    load();
  }, [load]);

  /* the producer's hand on a row: a nudge, an approval, a reply, a tick */
  async function act(i: Item, path: string, body: Record<string, unknown>, done: (j: Record<string, unknown>) => string) {
    setBusy(i.videoId);
    setFlash(null);
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify(body),
    }).catch(() => null);
    const j = ((await r?.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    setBusy(null);
    if (!r || !r.ok) return setFlash({ id: i.videoId, text: String(j.error ?? "Could not do that."), bad: true });
    setFlash({ id: i.videoId, text: done(j) });
    setReply(null);
    await load();
  }
  const chase = (i: Item, action: string, done: (j: Record<string, unknown>) => string, extra: Record<string, unknown> = {}) =>
    act(i, `/api/admin/orders/${i.orderId}/chase/`, { action, ...extra }, done);

  if (err) return <p className="text-body text-error">{err}</p>;
  if (items === null) return <p className="text-body text-muted">Loading the queue...</p>;

  const mineCount = items.filter((i) => i.ownerEmail === me).length;
  const shown = mine ? items.filter((i) => i.ownerEmail === me) : items;
  const needsUs = shown.filter((i) => i.bucket !== "waiting").length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-[var(--measure-body)] text-body text-muted">
          {needsUs === 0
            ? "Nothing is waiting on us right now."
            : `${needsUs} ${needsUs === 1 ? "thing needs" : "things need"} the studio.`}
        </p>
        {owners.length > 0 && mineCount > 0 && (
          <button
            type="button"
            onClick={() => setMine((m) => !m)}
            className={`tap rounded-[8px] border px-3.5 py-2 font-mono text-label uppercase transition-colors ${
              mine ? "border-gold text-gold" : "border-hair text-muted hover:border-gold/60 hover:text-gold"
            }`}
          >
            {mine ? `Showing my jobs (${mineCount})` : `Only my jobs (${mineCount})`}
          </button>
        )}
      </div>

      <div className="mt-6 grid gap-6">
        {BUCKETS.map((b) => {
          const all = shown
            .filter((i) => i.bucket === b.key)
            .sort((a, c) => (c.waitingDays ?? c.sinceDays ?? 0) - (a.waitingDays ?? a.sinceDays ?? 0));
          if (!all.length) return null;
          const list = b.key === "waiting" && !allWaiting ? all.slice(0, WAITING_SHOWN) : all;
          return (
            <section key={b.key}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="font-display text-h4 text-ink">{b.label}</h2>
                <span className={`rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${b.tone}`}>
                  {all.length}
                </span>
                <p className="text-body-sm text-dim">{b.hint}</p>
              </div>

              <ul className="mt-3 grid gap-2">
                {list.map((i) => (
                  <li key={i.videoId} className="rounded-[8px] border border-hair bg-surface p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <button
                        type="button"
                        onClick={() => open(i)}
                        className="tap text-left text-body-sm font-semibold text-ink transition-colors hover:text-gold"
                      >
                        {i.title}
                      </button>
                      <span className="font-mono text-label uppercase tracking-[0.1em] text-dim">
                        {i.customer}
                        {i.invoice ? ` / ${i.invoice}` : ""}
                      </span>
                      {/* Late work earns the only red on this screen, so
                          scanning for trouble takes no reading. */}
                      {i.due?.text && (
                        <span
                          className={`shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${
                            i.due.tone === "late"
                              ? "border-error/50 text-error"
                              : i.due.tone === "today"
                                ? "border-gold/50 text-gold"
                                : "border-hair text-dim"
                          }`}
                        >
                          {i.due.text}
                        </span>
                      )}
                    </div>

                    <p className="mt-1 font-mono text-label uppercase tracking-[0.1em] text-dim">
                      {/* On a single video order the product IS the video,
                          so saying both just reads as a stutter. */}
                      {i.product !== i.title ? `${i.product} / ` : ""}
                      {i.ownerName ?? "nobody yet"}
                      {i.bucket === "waiting" && i.waitingDays != null
                        ? ` / ${i.waitingDays === 0 ? "sent today" : `${i.waitingDays}d with them`}`
                        : ""}
                      {i.bucket === "brief" && i.sinceDays != null
                        ? ` / paid ${i.sinceDays === 0 ? "today" : `${i.sinceDays}d ago`}, no brief`
                        : ""}
                      {i.bucket === "revisions" && i.revisionRound > 0
                        ? ` / ${i.revisionRound} change${i.revisionRound === 1 ? "" : "s"} requested`
                        : ""}
                      {i.bucket === "start" && !i.hasLink ? " / no link yet" : ""}
                    </p>

                    {i.latestNote && (
                      <p className="mt-2 border-l-2 border-error/40 pl-3 text-body-sm text-muted">
                        {i.latestNote}
                        {i.openNotes > 1 ? ` (+${i.openNotes - 1} more)` : ""}
                      </p>
                    )}

                    {/* the row acts, so the common moves never need the job open */}
                    {i.bucket === "answer" && i.latestNoteId && i.orderId ? (
                      <div className="mt-3 grid gap-2">
                        {reply?.id === i.videoId ? (
                          <>
                            <Textarea
                              rows={2}
                              autoFocus
                              value={reply.text}
                              onChange={(e) => setReply({ id: i.videoId, text: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  if (reply.text.trim())
                                    act(i, `/api/admin/orders/${i.orderId}/comments/`, { deliverableId: i.videoId, body: reply.text, parentId: i.latestNoteId }, () => "Reply sent. The client gets it by email and in their portal.");
                                }
                              }}
                              placeholder="Answer the note. Enter to send, shift and enter for a new line."
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="secondary"
                                disabled={busy === i.videoId || !reply.text.trim()}
                                onClick={() => act(i, `/api/admin/orders/${i.orderId}/comments/`, { deliverableId: i.videoId, body: reply.text, parentId: i.latestNoteId }, () => "Reply sent. The client gets it by email and in their portal.")}
                              >
                                Send
                              </Button>
                              <button type="button" onClick={() => setReply(null)} className="tap font-mono text-label uppercase text-dim transition-colors hover:text-muted">
                                Cancel
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" disabled={busy === i.videoId} onClick={() => setReply({ id: i.videoId, text: "" })}>
                              Reply
                            </Button>
                            <Button
                              variant="ghost"
                              disabled={busy === i.videoId}
                              onClick={() => act(i, `/api/admin/orders/${i.orderId}/comments/`, { deliverableId: i.videoId, resolveId: i.latestNoteId, resolved: true }, () => "Marked done.")}
                            >
                              Mark done
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {i.bucket === "brief" && i.orderId ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button
                          variant="secondary"
                          disabled={busy === i.videoId}
                          onClick={() => chase(i, "nudge-brief", (j) => `Reminder sent, ${j.sent} of ${j.of}.`)}
                        >
                          Nudge for the brief
                        </Button>
                        <a
                          href={`/checkout/intake/${i.orderId}/?by=studio`}
                          target="_blank"
                          rel="noopener"
                          className="tap rounded-[8px] border border-gold/50 px-3 py-1.5 font-mono text-label uppercase text-gold transition-colors hover:bg-gold hover:text-canvas"
                        >
                          Enter it for them
                        </a>
                      </div>
                    ) : null}

                    {i.bucket === "waiting" && i.orderId ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button
                          variant="secondary"
                          disabled={busy === i.videoId}
                          onClick={() => chase(i, "nudge-review", (j) => `Reminder sent for ${(j.nudged as string[] | undefined)?.join(", ") ?? i.title}.`, { deliverableId: i.videoId })}
                        >
                          Nudge
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={busy === i.videoId}
                          onClick={() => {
                            if (confirm(`Approve ${i.title} for ${i.customer}? They are told, and can ask to reopen it.`))
                              chase(i, "approve", () => "Approved for them, and they have been told.", { deliverableId: i.videoId });
                          }}
                        >
                          Approve for them
                        </Button>
                      </div>
                    ) : null}

                    {flash?.id === i.videoId && (
                      <p className={`mt-2 text-body-sm ${flash.bad ? "text-error" : "text-green"}`}>{flash.text}</p>
                    )}
                  </li>
                ))}
              </ul>
              {b.key === "waiting" && all.length > WAITING_SHOWN && (
                <button
                  type="button"
                  onClick={() => setAllWaiting((v) => !v)}
                  className="tap mt-3 font-mono text-label uppercase tracking-[0.08em] text-muted transition-colors hover:text-gold"
                >
                  {allWaiting ? `Show the oldest ${WAITING_SHOWN}` : `Show all ${all.length}`}
                </button>
              )}
            </section>
          );
        })}

        {shown.length === 0 && (
          <p className="text-body text-muted">
            {mine ? "Nothing assigned to you right now." : "Nothing in the queue."}
          </p>
        )}
      </div>
    </div>
  );
}
