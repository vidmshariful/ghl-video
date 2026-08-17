"use client";

import { useEffect, useState } from "react";
import { supabase } from "./client";
import { AdminModal } from "./Modal";

/*
 * The Journal: the platform's shared brain. Three tabs over one table:
 *
 *   Build log - what changed, when, in plain language. Claude writes an
 *               entry at the end of every working session; the team can add
 *               notes too.
 *   Decisions - the decision register: what was decided, why, status.
 *               Superseding keeps the old card and points it at the new one,
 *               so the history of thinking survives every pivot.
 *   Ideas     - the owner's inbox. Jot a thought the moment it clicks;
 *               Claude reads the open ones at the start of every session.
 */
type Entry = {
  id: string;
  seq: number;
  kind: "log" | "decision" | "idea";
  title: string;
  body: string | null;
  status: string | null;
  superseded_by: number | null;
  decided_on: string | null;
  author: string;
  created_at: string;
  /* the owner answering back: how much he wants it, and why */
  rating: number | null;
  feedback: string | null;
  feedback_at: string | null;
  feedback_by: string | null;
};

type Tab = "log" | "decision" | "idea";

const field =
  "mt-1.5 w-full rounded-[8px] border border-hair bg-canvas px-3 py-2.5 text-body text-ink focus:border-gold focus:outline-none";
const lab = "font-mono text-label uppercase text-muted";
const btn =
  "tap rounded-[8px] border border-hair px-4 py-2 text-body-sm text-ink transition-colors hover:border-gold/60";
const btnGold =
  "tap rounded-[8px] bg-brand-gradient px-5 py-2.5 text-body font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60";

const IDEA_STATUS_STYLE: Record<string, string> = {
  open: "border-gold/40 text-gold",
  planned: "border-blue/40 text-blue",
  done: "border-green/40 text-green",
  dropped: "border-hair text-dim",
};

const day = (iso: string | null) =>
  iso
    ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

function EntryForm({
  kind,
  initial,
  meEmail,
  onDone,
  onCancel,
}: {
  kind: Tab;
  initial: Partial<Entry>;
  meEmail: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const isNew = !initial.id;
  const [title, setTitle] = useState(initial.title ?? "");
  const [body, setBody] = useState(initial.body ?? "");
  const [decidedOn, setDecidedOn] = useState(initial.decided_on ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setErr("A title is required.");
    setBusy(true);
    setErr("");
    const payload = {
      kind,
      title: title.trim(),
      body: body.trim() || null,
      decided_on: decidedOn || null,
      ...(isNew
        ? {
            status: kind === "decision" ? "active" : kind === "idea" ? "open" : null,
            author: meEmail || "team",
          }
        : {}),
    };
    const q = supabase.from("journal");
    const { error } = isNew
      ? await q.insert(payload)
      : await q.update(payload).eq("id", initial.id!);
    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={save}>
      <div className="mt-5 grid gap-4">
        <label>
          <span className={lab}>{kind === "idea" ? "The idea, in one line" : "Title"}</span>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
        </label>
        <label>
          <span className={lab}>
            {kind === "decision" ? "What we decided, and why" : "Details (optional)"}
          </span>
          <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} className={field} />
        </label>
        {kind !== "idea" && (
          <label className="max-w-56">
            <span className={lab}>{kind === "decision" ? "Decided on" : "For the day"}</span>
            <input type="date" value={decidedOn ?? ""} onChange={(e) => setDecidedOn(e.target.value)} className={field} />
          </label>
        )}
      </div>
      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}
      <div className="mt-6 flex gap-3">
        <button type="submit" disabled={busy} className={btnGold}>
          {busy ? "Saving" : isNew ? "Save" : "Save changes"}
        </button>
        <button type="button" onClick={onCancel} className={btn}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function JournalScreen({ meEmail }: { meEmail: string }) {
  const [tab, setTab] = useState<Tab>("log");
  const [rows, setRows] = useState<Entry[]>([]);
  const [editing, setEditing] = useState<Entry | "new" | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    const { data, error } = await supabase
      .from("journal")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setErr(error.message);
    else setRows((data ?? []) as Entry[]);
    setLoaded(true);
  }
  useEffect(() => {
    load();
  }, []);

  async function setStatus(e: Entry, status: string) {
    const { error } = await supabase.from("journal").update({ status }).eq("id", e.id);
    if (error) setErr(error.message);
    else load();
  }

  async function supersede(e: Entry) {
    const raw = prompt(
      `Mark decision #${e.seq} as superseded.\nReplaced by which decision number? (Leave empty if none yet.)`,
    );
    if (raw === null) return;
    const by = Number(raw.replace(/[^0-9]/g, "")) || null;
    const { error } = await supabase
      .from("journal")
      .update({ status: "superseded", superseded_by: by })
      .eq("id", e.id);
    if (error) setErr(error.message);
    else load();
  }

  async function remove(e: Entry) {
    if (!confirm(`Delete #${e.seq} "${e.title}"? Superseding is usually better than deleting.`)) return;
    const { error } = await supabase.from("journal").delete().eq("id", e.id);
    if (error) setErr(error.message);
    else load();
  }

  /* Clicking the star already set clears the rating, so a misclick is undone
   * the same way it was made. Back to null, not down to one: unrated and
   * rated-lowest are different answers and Claude reads them differently. */
  async function rate(e: Entry, n: number) {
    const next = e.rating === n ? null : n;
    setRows((rs) => rs.map((r) => (r.id === e.id ? { ...r, rating: next } : r)));
    const { error } = await supabase.from("journal").update({ rating: next }).eq("id", e.id);
    if (error) {
      setErr(error.message);
      load();
    }
  }

  async function saveFeedback(e: Entry, text: string) {
    const body = text.trim() || null;
    const { error } = await supabase
      .from("journal")
      .update({
        feedback: body,
        feedback_at: body ? new Date().toISOString() : null,
        feedback_by: body ? meEmail || "team" : null,
      })
      .eq("id", e.id);
    if (error) setErr(error.message);
    else load();
  }

  /*
   * How much you want it, and why.
   *
   * Both halves matter and the note is the more useful one: "yes but only for
   * agencies" changes what gets built far more than four stars does. The
   * stars exist so a list of thirty ideas ranks itself at a glance, and the
   * CLI reads both at the start of every session, which is the only reason
   * any of this is worth having.
   */
  function Reaction({ e }: { e: Entry }) {
    const open = noteFor === e.id;
    return (
      <div className="mt-4 border-t border-hair pt-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-label uppercase tracking-[0.1em] text-dim">
              Worth doing
            </span>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => {
                const on = (e.rating ?? 0) >= n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => rate(e, n)}
                    aria-label={
                      e.rating === n ? `Clear the rating on #${e.seq}` : `Rate #${e.seq} ${n} out of 5`
                    }
                    aria-pressed={on}
                    className={`tap rounded-[4px] px-0.5 text-body leading-none transition-colors ${
                      on ? "text-gold" : "text-hair hover:text-dim"
                    }`}
                  >
                    {on ? "★" : "☆"}
                  </button>
                );
              })}
            </div>
            {e.rating != null && (
              <span className="font-mono text-label text-dim">{e.rating}/5</span>
            )}
          </div>

          {!open && (
            <button
              type="button"
              onClick={() => {
                setNoteFor(e.id);
                setNoteDraft(e.feedback ?? "");
              }}
              className="tap font-mono text-label uppercase tracking-[0.1em] text-dim transition-colors hover:text-gold"
            >
              {e.feedback ? "Edit your note" : "Add a note"}
            </button>
          )}
        </div>

        {e.feedback && !open && (
          <p className="mt-2.5 whitespace-pre-wrap rounded-[8px] border border-gold/30 bg-gold/5 px-3.5 py-2.5 text-body-sm leading-relaxed text-ink">
            {e.feedback}
          </p>
        )}

        {open && (
          <div className="mt-2.5">
            <textarea
              autoFocus
              rows={3}
              value={noteDraft}
              onChange={(ev) => setNoteDraft(ev.target.value)}
              placeholder="What you think. Claude reads this before building anything."
              className="tap w-full rounded-[8px] border border-hair bg-canvas px-3 py-2 text-body-sm text-ink placeholder:text-dim"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  await saveFeedback(e, noteDraft);
                  setNoteFor(null);
                }}
                className={`${btn} border-gold/60 text-gold`}
              >
                Save note
              </button>
              <button type="button" onClick={() => setNoteFor(null)} className={btn}>
                Cancel
              </button>
              {e.feedback && (
                <button
                  type="button"
                  onClick={async () => {
                    await saveFeedback(e, "");
                    setNoteFor(null);
                  }}
                  className={`${btn} text-error hover:border-error/60`}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!loaded) return <p className="text-body text-muted">Loading the journal...</p>;

  const logs = rows.filter((r) => r.kind === "log");
  const decisions = rows.filter((r) => r.kind === "decision");
  const ideas = rows.filter((r) => r.kind === "idea");
  const openIdeas = ideas.filter((r) => r.status === "open" || r.status === "planned");
  const closedIdeas = ideas.filter((r) => r.status === "done" || r.status === "dropped");
  const activeDecisions = decisions.filter((r) => r.status !== "superseded");
  const supersededDecisions = decisions.filter((r) => r.status === "superseded");

  const tabs: { key: Tab; label: string }[] = [
    { key: "log", label: `Build log (${logs.length})` },
    { key: "decision", label: `Decisions (${activeDecisions.length})` },
    { key: "idea", label: `Ideas (${openIdeas.length})` },
  ];

  /* logs grouped by day, newest day first */
  const logDays: { day: string; items: Entry[] }[] = [];
  for (const e of logs) {
    const d = day(e.decided_on ?? e.created_at);
    const g = logDays.find((x) => x.day === d);
    if (g) g.items.push(e);
    else logDays.push({ day: d, items: [e] });
  }

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-h2 text-ink">Journal</h1>
        <button type="button" onClick={() => setEditing("new")} className={btnGold}>
          {tab === "log" ? "Add note" : tab === "decision" ? "Record decision" : "Jot an idea"}
        </button>
      </div>
      <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
        {tab === "log"
          ? "What changed, day by day, in plain language. Claude writes an entry after every working session; add your own notes any time."
          : tab === "decision"
            ? "What we decided and why. When a direction changes, the old decision is marked superseded, never erased, so the history of thinking survives."
            : "Your inbox to Claude. Jot a thought the moment it clicks; every working session starts by reading the open ones."}
      </p>

      <div className="mt-6 flex gap-1 border-b border-hair">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setEditing(null);
            }}
            className={`tap rounded-t-[8px] px-4 py-2.5 text-body-sm transition-colors ${
              tab === t.key
                ? "border border-b-0 border-hair bg-surface font-semibold text-gold"
                : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}

      <AdminModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={
          editing === "new" || !editing
            ? tab === "idea"
              ? "What clicked?"
              : tab === "decision"
                ? "Record a decision"
                : "Add a log note"
            : tab === "idea"
              ? "Edit idea"
              : tab === "decision"
                ? `Edit decision #${editing.seq}`
                : `Edit note #${editing.seq}`
        }
      >
        {editing && (
          <EntryForm
            kind={tab}
            initial={editing === "new" ? {} : editing}
            meEmail={meEmail}
            onDone={() => {
              setEditing(null);
              load();
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </AdminModal>

      {/* ---- build log ---- */}
      {tab === "log" && (
        <div className="mt-6 grid gap-6">
          {logDays.length === 0 && (
            <p className="text-body text-muted">Nothing logged yet.</p>
          )}
          {logDays.map((g) => (
            <div key={g.day}>
              <p className="font-mono text-label uppercase tracking-[0.1em] text-gold">{g.day}</p>
              <div className="mt-2 grid gap-3">
                {g.items.map((e) => (
                  <div key={e.id} className="rounded-[12px] border border-hair bg-surface p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-body font-semibold text-ink">{e.title}</p>
                      <span className="font-mono text-label uppercase text-dim">
                        #{e.seq} / {e.author === "claude" ? "claude" : e.author.split("@")[0]}
                      </span>
                    </div>
                    {e.body && (
                      <p className="mt-1.5 whitespace-pre-wrap text-body-sm leading-relaxed text-muted">
                        {e.body}
                      </p>
                    )}
                    {e.author !== "claude" && (
                      <button type="button" onClick={() => setEditing(e)} className={`${btn} mt-3`}>
                        Edit
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- decisions ---- */}
      {tab === "decision" && (
        <div className="mt-6 grid gap-3">
          {activeDecisions.map((e) => (
            <div key={e.id} className="rounded-[12px] border border-hair bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-body font-semibold text-ink">
                  <span className="mr-2 font-mono text-label text-gold">#{e.seq}</span>
                  {e.title}
                </p>
                <span className="font-mono text-label uppercase text-dim">{day(e.decided_on ?? e.created_at)}</span>
              </div>
              {e.body && (
                <p className="mt-1.5 whitespace-pre-wrap text-body-sm leading-relaxed text-muted">{e.body}</p>
              )}
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setEditing(e)} className={btn}>
                  Edit
                </button>
                <button type="button" onClick={() => supersede(e)} className={btn}>
                  Mark superseded
                </button>
              </div>
              <Reaction e={e} />
            </div>
          ))}
          {supersededDecisions.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowClosed(!showClosed)}
                className="tap font-mono text-label uppercase text-muted transition-colors hover:text-gold"
              >
                {showClosed ? "Hide" : "Show"} superseded ({supersededDecisions.length})
              </button>
              {showClosed && (
                <div className="mt-3 grid gap-3">
                  {supersededDecisions.map((e) => (
                    <div key={e.id} className="rounded-[12px] border border-hair bg-canvas p-5 opacity-70">
                      <p className="text-body font-semibold text-ink">
                        <span className="mr-2 font-mono text-label text-dim">#{e.seq}</span>
                        {e.title}
                        <span className="ml-2 inline-flex rounded-full border border-hair px-2.5 py-0.5 font-mono text-label uppercase text-dim">
                          superseded{e.superseded_by ? ` by #${e.superseded_by}` : ""}
                        </span>
                      </p>
                      {e.body && (
                        <p className="mt-1.5 whitespace-pre-wrap text-body-sm leading-relaxed text-dim">{e.body}</p>
                      )}
                      <button type="button" onClick={() => setStatus(e, "active")} className={`${btn} mt-3`}>
                        Reactivate
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---- ideas ---- */}
      {tab === "idea" && (
        <div className="mt-6 grid gap-3">
          <p className="text-body-sm text-dim">
            Claude reads every open idea at the start of a session and moves it along:
            open, planned, then done or dropped.
          </p>
          {openIdeas.length === 0 && (
            <p className="text-body text-muted">No open ideas. When something clicks, jot it.</p>
          )}
          {openIdeas.map((e) => (
            <div key={e.id} className="rounded-[12px] border border-hair bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-body font-semibold text-ink">{e.title}</p>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${IDEA_STATUS_STYLE[e.status ?? "open"]}`}
                >
                  {e.status}
                </span>
              </div>
              {e.body && (
                <p className="mt-1.5 whitespace-pre-wrap text-body-sm leading-relaxed text-muted">{e.body}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setEditing(e)} className={btn}>
                  Edit
                </button>
                {e.status === "open" && (
                  <button type="button" onClick={() => setStatus(e, "planned")} className={btn}>
                    Mark planned
                  </button>
                )}
                <button type="button" onClick={() => setStatus(e, "done")} className={btn}>
                  Done
                </button>
                <button
                  type="button"
                  onClick={() => setStatus(e, "dropped")}
                  className={`${btn} text-error hover:border-error/60`}
                >
                  Drop
                </button>
              </div>
              <Reaction e={e} />
            </div>
          ))}
          {closedIdeas.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowClosed(!showClosed)}
                className="tap font-mono text-label uppercase text-muted transition-colors hover:text-gold"
              >
                {showClosed ? "Hide" : "Show"} done and dropped ({closedIdeas.length})
              </button>
              {showClosed && (
                <div className="mt-3 grid gap-3">
                  {closedIdeas.map((e) => (
                    <div key={e.id} className="rounded-[12px] border border-hair bg-canvas p-5 opacity-70">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-body font-semibold text-ink">{e.title}</p>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${IDEA_STATUS_STYLE[e.status ?? "dropped"]}`}
                        >
                          {e.status}
                        </span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => setStatus(e, "open")} className={btn}>
                          Reopen
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(e)}
                          className={`${btn} text-error hover:border-error/60`}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
