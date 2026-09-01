"use client";

import { useCallback, useEffect, useState } from "react";
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
 */

type Item = {
  bucket: "answer" | "revisions" | "start" | "waiting";
  /* which kind of work, so a click knows which screen owns it */
  kind: "purchase" | "project" | "plan";
  projectId: string | null;
  editingSlug: string | null;
  videoId: string;
  orderId: string;
  title: string;
  status: string;
  revisionRound: number;
  hasLink: boolean;
  openNotes: number;
  latestNote: string | null;
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
    hint: "They left a note and nobody has replied or ticked it off.",
    tone: "border-error/40 text-error",
  },
  {
    key: "revisions" as const,
    label: "Changes to make",
    hint: "The client asked for changes and we have not sent a new cut.",
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
    hint: "Sent and waiting on them. Chase the old ones.",
    tone: "border-blue/50 text-blue",
  },
];

export function StudioQueue({
  onOpenJob,
  onOpenProject,
  onOpenEditing,
}: {
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

  const load = useCallback(async () => {
    setErr("");
    try {
      const r = await fetch("/api/admin/studio/queue", { headers: await authHeader() });
      const j = await r.json();
      if (!r.ok) return setErr(j.error ?? "Could not load the queue.");
      setItems(j.items as Item[]);
      setOwners(j.owners ?? []);
      setMe(j.me ?? "");
    } catch {
      setErr("Could not load the queue.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
            : `${needsUs} ${needsUs === 1 ? "video needs" : "videos need"} the studio.`}
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
          const list = shown.filter((i) => i.bucket === b.key);
          if (!list.length) return null;
          return (
            <section key={b.key}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="font-display text-h4 text-ink">{b.label}</h2>
                <span
                  className={`rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${b.tone}`}
                >
                  {list.length}
                </span>
                <p className="text-body-sm text-dim">{b.hint}</p>
              </div>

              <ul className="mt-3 grid gap-2">
                {list
                  .sort((a, c) => (c.waitingDays ?? c.sinceDays ?? 0) - (a.waitingDays ?? a.sinceDays ?? 0))
                  .map((i) => (
                    <li key={i.videoId}>
                      <button
                        type="button"
                        onClick={() => open(i)}
                        className="tap w-full rounded-[8px] border border-hair bg-surface p-4 text-left transition-colors hover:border-gold/50"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <span className="text-body-sm font-semibold text-ink">{i.title}</span>
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
                      </button>
                    </li>
                  ))}
              </ul>
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
