"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Textarea } from "@/components/portal/ui";
import { authHeader } from "./client";

/*
 * The queue, laid out to be acted on: a mock of the layout proposed after
 * the Premade review (16 September 2026), on real data and real routes.
 *
 * What changes against the current queue: a summary strip of counts at the
 * top; one line per row with the bucket's colour on a left rail and the one
 * button that matters in the same place on every row; unstarted videos of
 * one pack folded into one row with Start all; names in normal case, mono
 * only for codes and days; lateness quiet unless it is ours.
 */

type Bucket = "answer" | "revisions" | "brief" | "start" | "waiting";
type Item = {
  bucket: Bucket;
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
  due?: { text: string; tone: string } | null;
  customer: string;
  invoice: string | null;
  product: string;
  ownerEmail: string | null;
  ownerName: string | null;
};

const BUCKETS: { key: Bucket; label: string; rail: string; chip: string; hint: string }[] = [
  { key: "answer", label: "Answer the client", rail: "border-l-error", chip: "border-error/50 text-error", hint: "A note nobody has replied to or ticked off." },
  { key: "revisions", label: "Changes to make", rail: "border-l-gold", chip: "border-gold/50 text-gold", hint: "They asked for changes; no new cut yet." },
  { key: "brief", label: "No brief yet", rail: "border-l-gold", chip: "border-gold/50 text-gold", hint: "Paid, nothing can start until it lands." },
  { key: "start", label: "Ready to start", rail: "border-l-hair", chip: "border-hair text-muted", hint: "Brief in, nothing built." },
  { key: "waiting", label: "With the client", rail: "border-l-blue", chip: "border-blue/50 text-blue", hint: "Sent and waiting on them." },
];

const WAITING_SHOWN = 5;

export function StudioQueueV2({
  kind,
  onOpenJob,
  onOpenProject,
  onOpenEditing,
}: {
  kind?: "purchase" | "project" | "plan";
  onOpenJob: (orderId: string) => void;
  onOpenProject: (projectId: string) => void;
  onOpenEditing: (slug: string) => void;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [me, setMe] = useState("");
  const [mine, setMine] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ id: string; text: string; bad?: boolean } | null>(null);
  const [reply, setReply] = useState<{ id: string; text: string } | null>(null);
  const [allWaiting, setAllWaiting] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const open = (i: Item) => {
    if (i.kind === "project" && i.projectId) return onOpenProject(i.projectId);
    if (i.kind === "plan" && i.editingSlug) return onOpenEditing(i.editingSlug);
    if (i.orderId) return onOpenJob(i.orderId);
  };

  const load = useCallback(async () => {
    setErr("");
    try {
      const r = await fetch(`/api/admin/studio/queue${kind ? `?kind=${kind}` : ""}`, { headers: await authHeader() });
      const j = await r.json();
      if (!r.ok) return setErr(j.error ?? "Could not load the queue.");
      setItems(j.items as Item[]);
      setMe(j.me ?? "");
    } catch {
      setErr("Could not load the queue.");
    }
  }, [kind]);
  useEffect(() => {
    load();
  }, [load]);

  async function call(key: string, method: "POST" | "PATCH", path: string, body: Record<string, unknown>, done: (j: Record<string, unknown>) => string) {
    setBusy(key);
    setFlash(null);
    const r = await fetch(path, { method, headers: { "Content-Type": "application/json", ...(await authHeader()) }, body: JSON.stringify(body) }).catch(() => null);
    const j = ((await r?.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    setBusy(null);
    if (!r || !r.ok) return setFlash({ id: key, text: String(j.error ?? "Could not do that."), bad: true });
    setFlash({ id: key, text: done(j) });
    setReply(null);
    await load();
  }
  /* the routes: comments and chase take a POST, the videos a PATCH */
  const post = (key: string, path: string, body: Record<string, unknown>, done: (j: Record<string, unknown>) => string) => call(key, "POST", path, body, done);
  const patchVideos = (key: string, orderId: string, ids: string[], status: string, done: string) =>
    call(key, "PATCH", `/api/admin/orders/${orderId}/deliverables/`, { deliverableIds: ids, status }, () => done);

  const shown = useMemo(() => (items ?? []).filter((i) => !mine || i.ownerEmail === me), [items, mine, me]);
  const counts = useMemo(() => {
    const c: Record<Bucket, number> = { answer: 0, revisions: 0, brief: 0, start: 0, waiting: 0 };
    for (const i of shown) c[i.bucket]++;
    return c;
  }, [shown]);
  const mineCount = (items ?? []).filter((i) => i.ownerEmail === me).length;

  if (err) return <p className="text-body text-error">{err}</p>;
  if (items === null) return <p className="text-body text-muted">Loading the queue...</p>;

  const needsUs = counts.answer + counts.revisions + counts.brief + counts.start;
  const days = (i: Item) => i.waitingDays ?? i.sinceDays ?? 0;
  const late = (i: Item) => i.due?.tone === "late";

  /* unstarted videos of one order fold into one row */
  const startGroups = (() => {
    const map = new Map<string, Item[]>();
    for (const i of shown.filter((x) => x.bucket === "start")) map.set(i.orderId ?? i.videoId, [...(map.get(i.orderId ?? i.videoId) ?? []), i]);
    return [...map.entries()].sort((a, b) => days(b[1][0]) - days(a[1][0]));
  })();

  const meta = (i: Item, extra?: string) => (
    <p className="mt-0.5 truncate text-body-sm text-muted">
      {i.customer}
      {i.product !== i.title ? `, ${i.product}` : ""}
      {i.invoice ? <span className="font-mono text-label uppercase tracking-[0.08em] text-dim"> {i.invoice}</span> : null}
      {extra ? <span className={late(i) && i.bucket !== "waiting" ? " text-error" : " text-dim"}> {extra}</span> : null}
    </p>
  );

  /* a row is a plain function, never a component made inside render: a
     component defined here would remount on every keystroke in the reply box
     and lose focus after one character */
  const row = (i: Item, children: React.ReactNode) => {
    const b = BUCKETS.find((x) => x.key === i.bucket)!;
    return (
      <li key={i.videoId} className={`grid gap-2 rounded-[8px] border border-hair border-l-4 bg-surface px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${b.rail}`}>
        <div className="min-w-0">
          <button type="button" onClick={() => open(i)} className="tap block max-w-full truncate text-left text-body-sm font-semibold text-ink transition-colors hover:text-gold">
            {i.title}
          </button>
          {meta(
            i,
            i.bucket === "waiting"
              ? `${i.waitingDays === 0 ? "sent today" : `${i.waitingDays}d with them`}`
              : i.bucket === "brief"
                ? `paid ${i.sinceDays === 0 ? "today" : `${i.sinceDays}d ago`}`
                : i.due?.text ?? undefined,
          )}
          {i.latestNote && (
            <p className="mt-1.5 truncate border-l-2 border-error/40 pl-2 text-body-sm text-muted">
              {i.latestNote}
              {i.openNotes > 1 ? ` (+${i.openNotes - 1})` : ""}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">{children}</div>
        {flash?.id === i.videoId && (
          <p className={`text-body-sm sm:col-span-2 ${flash.bad ? "text-error" : "text-green"}`}>{flash.text}</p>
        )}
        {reply?.id === i.videoId && i.latestNoteId && i.orderId && (
          <div className="grid gap-2 sm:col-span-2">
            <Textarea
              rows={2}
              autoFocus
              value={reply.text}
              onChange={(e) => setReply({ id: i.videoId, text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && reply.text.trim()) {
                  e.preventDefault();
                  post(i.videoId, `/api/admin/orders/${i.orderId}/comments/`, { deliverableId: i.videoId, body: reply.text, parentId: i.latestNoteId }, () => "Reply sent.");
                }
              }}
              placeholder="Answer the note. Enter to send."
            />
            <div className="flex gap-2">
              <Button variant="brand" size="sm" disabled={busy === i.videoId || !reply.text.trim()} onClick={() => post(i.videoId, `/api/admin/orders/${i.orderId}/comments/`, { deliverableId: i.videoId, body: reply.text, parentId: i.latestNoteId }, () => "Reply sent.")}>
                Send
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setReply(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </li>
    );
  };

  return (
    <div>
      {/* the summary strip: one glance, and a jump to each bucket */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-body-sm text-muted">{needsUs === 0 ? "Nothing waiting on us." : `${needsUs} for us`}</span>
        {BUCKETS.map((b) => (
          <a
            key={b.key}
            href={`#q-${b.key}`}
            className={`tap rounded-full border px-2.5 py-0.5 font-mono text-label uppercase tracking-[0.08em] ${counts[b.key] ? b.chip : "border-hair/60 text-dim"}`}
          >
            {b.label} {counts[b.key]}
          </a>
        ))}
        {mineCount > 0 && (
          <Button variant={mine ? "brand" : "ghost"} size="sm" onClick={() => setMine((m) => !m)} className="ml-auto">
            {mine ? `My jobs (${mineCount})` : `Only my jobs (${mineCount})`}
          </Button>
        )}
      </div>

      <div className="mt-5 grid gap-6">
        {BUCKETS.map((b) => {
          const all = shown.filter((i) => i.bucket === b.key).sort((x, y) => days(y) - days(x));
          if (!all.length) return null;
          const list = b.key === "waiting" && !allWaiting ? all.slice(0, WAITING_SHOWN) : all;
          return (
            <section key={b.key} id={`q-${b.key}`}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="font-display text-h4 text-ink">{b.label}</h2>
                <span className={`rounded-full border px-2 py-0.5 font-mono text-label ${b.chip}`}>{all.length}</span>
                <p className="text-body-sm text-dim">{b.hint}</p>
              </div>
              <ul className="mt-2.5 grid gap-1.5">
                {b.key === "start"
                  ? startGroups.map(([key, group]) => {
                      const first = group[0];
                      if (group.length === 1)
                        return (
                          row(first, <>
                            <Button variant="brand" size="sm" disabled={busy === first.videoId} onClick={() => first.orderId && patchVideos(first.videoId, first.orderId, [first.videoId], "in_production", "Started.")}>
                              Start
                            </Button>
</>)
                        );
                      const g: Item = { ...first, videoId: `group:${key}`, title: `${group.length} videos on ${first.product}` };
                      return (
                        <li key={key} className="grid gap-2 rounded-[8px] border border-hair border-l-4 border-l-hair bg-surface px-4 py-3">
                          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                            <div className="min-w-0">
                              <button type="button" onClick={() => open(first)} className="tap block truncate text-left text-body-sm font-semibold text-ink transition-colors hover:text-gold">
                                {g.title}
                              </button>
                              {meta(g, first.due?.text ?? undefined)}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                              <Button variant="ghost" size="sm" onClick={() => setOpenGroup(openGroup === key ? null : key)}>
                                {openGroup === key ? "Hide" : "Show"} the {group.length}
                              </Button>
                              <Button variant="brand" size="sm" disabled={busy === g.videoId} onClick={() => first.orderId && patchVideos(g.videoId, first.orderId, group.map((v) => v.videoId), "in_production", `Started all ${group.length}.`)}>
                                Start all
                              </Button>
                            </div>
                          </div>
                          {flash?.id === g.videoId && <p className={`text-body-sm ${flash.bad ? "text-error" : "text-green"}`}>{flash.text}</p>}
                          {openGroup === key && (
                            <ul className="grid gap-1 border-t border-hair pt-2">
                              {group.map((v) => (
                                <li key={v.videoId} className="flex items-center justify-between gap-3 text-body-sm text-muted">
                                  <span className="truncate">{v.title}</span>
                                  <Button variant="ghost" size="sm" disabled={busy === v.videoId} onClick={() => v.orderId && patchVideos(v.videoId, v.orderId, [v.videoId], "in_production", "Started.")}>
                                    Start
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })
                  : list.map((i) => (
                      row(i, <>
                        {i.bucket === "answer" && i.latestNoteId && i.orderId ? (
                          <>
                            <Button variant="brand" size="sm" disabled={busy === i.videoId} onClick={() => setReply({ id: i.videoId, text: "" })}>
                              Reply
                            </Button>
                            <Button variant="ghost" size="sm" disabled={busy === i.videoId} onClick={() => post(i.videoId, `/api/admin/orders/${i.orderId}/comments/`, { deliverableId: i.videoId, resolveId: i.latestNoteId, resolved: true }, () => "Marked done.")}>
                              Mark done
                            </Button>
                          </>
                        ) : i.bucket === "revisions" ? (
                          <Button variant="brand" size="sm" onClick={() => open(i)}>
                            Open the job
                          </Button>
                        ) : i.bucket === "brief" && i.orderId ? (
                          <>
                            <Button variant="secondary" size="sm" disabled={busy === i.videoId} onClick={() => post(i.videoId, `/api/admin/orders/${i.orderId}/chase/`, { action: "nudge-brief" }, (j) => `Reminder sent, ${j.sent} of ${j.of}.`)}>
                              Nudge
                            </Button>
                            <a href={`/checkout/intake/${i.orderId}/?by=studio`} target="_blank" rel="noopener" className="tap rounded-[8px] border border-gold/50 px-3 py-1.5 font-mono text-label uppercase text-gold transition-colors hover:bg-gold hover:text-canvas">
                              Enter it
                            </a>
                          </>
                        ) : i.bucket === "waiting" && i.orderId ? (
                          <>
                            <Button variant="secondary" size="sm" disabled={busy === i.videoId} onClick={() => post(i.videoId, `/api/admin/orders/${i.orderId}/chase/`, { action: "nudge-review", deliverableId: i.videoId }, () => "Reminder sent.")}>
                              Nudge
                            </Button>
                            <Button variant="ghost" size="sm" disabled={busy === i.videoId} onClick={() => confirm(`Approve ${i.title} for ${i.customer}?`) && post(i.videoId, `/api/admin/orders/${i.orderId}/chase/`, { action: "approve", deliverableId: i.videoId }, () => "Approved for them.")}>
                              Approve for them
                            </Button>
                          </>
                        ) : null}
</>)
                    ))}
              </ul>
              {b.key === "waiting" && all.length > WAITING_SHOWN && (
                <Button variant="ghost" size="sm" onClick={() => setAllWaiting((v) => !v)} className="mt-2">
                  {allWaiting ? `Show the oldest ${WAITING_SHOWN}` : `Show all ${all.length}`}
                </Button>
              )}
            </section>
          );
        })}
        {shown.length === 0 && <p className="text-body text-muted">{mine ? "Nothing assigned to you right now." : "Nothing in the queue."}</p>}
      </div>
    </div>
  );
}
