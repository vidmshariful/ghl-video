"use client";

import { useEffect, useState } from "react";
import { supabase } from "./client";

/*
 * The Studio Insights board, managed by hand (client decision): the
 * team sets capacity totals and remaining slots per service line, and
 * curates the production board. Everything here is public on
 * /studio-insights within five minutes of saving (ISR revalidate).
 */
type SlotRow = {
  id: string;
  service: "premade" | "custom" | "editing";
  period_label: string;
  total: number;
  remaining: number;
  updated_at: string;
};

type UpdateRow = {
  id: string;
  title: string;
  status: "in_production" | "launched" | "announcement";
  note: string | null;
  target_date: string | null;
  link_slug: string | null;
  sort: number;
  published: boolean;
};

const field =
  "mt-1.5 w-full rounded-[3px] border border-hair bg-canvas px-3 py-2.5 text-body text-ink focus:border-gold focus:outline-none";
const lab = "font-mono text-label uppercase text-muted";

const SERVICE_NAMES: Record<SlotRow["service"], string> = {
  premade: "Premade Videos",
  custom: "Custom Production",
  editing: "Video Editing",
};

const STATUS_NAMES: Record<UpdateRow["status"], string> = {
  in_production: "In production",
  launched: "Launched",
  announcement: "Announcement",
};

function SlotEditor({ slot, onSaved }: { slot: SlotRow; onSaved: () => void }) {
  const [s, setS] = useState({
    period: slot.period_label,
    total: String(slot.total),
    remaining: String(slot.remaining),
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const total = Math.max(0, Number(s.total) || 0);
    const remaining = Math.min(Math.max(0, Number(s.remaining) || 0), total);
    const { error } = await supabase
      .from("studio_slots")
      .update({ period_label: s.period.trim() || "This week", total, remaining })
      .eq("id", slot.id);
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg("Saved.");
    onSaved();
  }

  return (
    <form
      onSubmit={save}
      className="grid items-end gap-4 rounded-card border border-hair bg-surface p-5 sm:grid-cols-[1.2fr_1fr_1fr_1fr_auto]"
    >
      <div>
        <p className="font-display text-h4 font-semibold text-ink">
          {SERVICE_NAMES[slot.service]}
        </p>
        <p className="mt-1 font-mono text-label uppercase text-dim">
          0 total hides the card on the site
        </p>
      </div>
      <label>
        <span className={lab}>Period label</span>
        <input
          value={s.period}
          onChange={(e) => setS((x) => ({ ...x, period: e.target.value }))}
          className={field}
          placeholder="This week"
        />
      </label>
      <label>
        <span className={lab}>Total slots</span>
        <input
          type="number"
          min={0}
          value={s.total}
          onChange={(e) => setS((x) => ({ ...x, total: e.target.value }))}
          className={field}
        />
      </label>
      <label>
        <span className={lab}>Remaining</span>
        <input
          type="number"
          min={0}
          value={s.remaining}
          onChange={(e) => setS((x) => ({ ...x, remaining: e.target.value }))}
          className={field}
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="tap rounded-[3px] bg-brand-gradient px-5 py-2.5 text-body font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Saving" : "Save"}
        </button>
        {msg && <span className="text-body-sm text-muted">{msg}</span>}
      </div>
    </form>
  );
}

function UpdateForm({
  initial,
  onDone,
  onCancel,
}: {
  initial: Partial<UpdateRow>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const isNew = !initial.id;
  const [u, setU] = useState({
    title: initial.title ?? "",
    status: initial.status ?? "in_production",
    note: initial.note ?? "",
    target: initial.target_date ?? "",
    slug: initial.link_slug ?? "",
    sort: initial.sort != null ? String(initial.sort) : "0",
    published: initial.published ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: unknown) => setU((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!u.title.trim()) {
      setErr("A title is required.");
      return;
    }
    setBusy(true);
    setErr("");
    const payload = {
      title: u.title.trim(),
      status: u.status,
      note: u.note.trim() || null,
      target_date: u.target || null,
      link_slug: u.slug.trim() || null,
      sort: Number(u.sort) || 0,
      published: u.published,
    };
    const q = supabase.from("studio_updates");
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
    <form onSubmit={save} className="rounded-card border border-gold/40 bg-surface p-6">
      <p className="font-display text-h4 font-semibold text-ink">
        {isNew ? "Add a board entry" : `Edit ${initial.title}`}
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className={lab}>Title</span>
          <input
            required
            value={u.title}
            onChange={(e) => set("title", e.target.value)}
            className={field}
            placeholder="Payments + Invoicing Explainer"
          />
        </label>
        <label>
          <span className={lab}>Status</span>
          <select
            value={u.status}
            onChange={(e) => set("status", e.target.value)}
            className={field}
          >
            <option value="in_production">In production</option>
            <option value="launched">Launched</option>
            <option value="announcement">Announcement</option>
          </select>
        </label>
        <label>
          <span className={lab}>Target / launch date</span>
          <input
            type="date"
            value={u.target}
            onChange={(e) => set("target", e.target.value)}
            className={field}
          />
        </label>
        <label className="sm:col-span-2">
          <span className={lab}>Note (one line, optional)</span>
          <input
            value={u.note}
            onChange={(e) => set("note", e.target.value)}
            className={field}
            placeholder="Scripted and voiced; animation pass this week."
          />
        </label>
        <label>
          <span className={lab}>Library slug (optional preview link)</span>
          <input
            value={u.slug}
            onChange={(e) => set("slug", e.target.value)}
            className={field}
            placeholder="payments-invoicing-explainer"
          />
        </label>
        <label>
          <span className={lab}>Sort</span>
          <input
            type="number"
            value={u.sort}
            onChange={(e) => set("sort", e.target.value)}
            className={field}
          />
        </label>
        <label className="flex items-center gap-3 sm:col-span-2">
          <input
            type="checkbox"
            checked={u.published}
            onChange={(e) => set("published", e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-body text-ink">Published</span>
        </label>
      </div>
      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}
      <div className="mt-6 flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="tap rounded-[3px] bg-brand-gradient px-6 py-2.5 text-body font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Saving" : "Save entry"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="tap rounded-[3px] border border-hair px-6 py-2.5 text-body text-ink transition-colors hover:border-gold/60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function StudioScreen() {
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [updates, setUpdates] = useState<UpdateRow[]>([]);
  const [editing, setEditing] = useState<UpdateRow | "new" | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    const [a, b] = await Promise.all([
      supabase.from("studio_slots").select("*").order("service"),
      supabase.from("studio_updates").select("*").order("sort").order("updated_at", { ascending: false }),
    ]);
    if (a.error || b.error) setErr((a.error ?? b.error)!.message);
    else {
      setSlots(a.data as SlotRow[]);
      setUpdates(b.data as UpdateRow[]);
    }
    setLoaded(true);
  }
  useEffect(() => {
    load();
  }, []);

  async function remove(row: UpdateRow) {
    if (!confirm(`Delete "${row.title}"?`)) return;
    const { error } = await supabase.from("studio_updates").delete().eq("id", row.id);
    if (error) setErr(error.message);
    else load();
  }

  if (!loaded) return <p className="text-body text-muted">Loading the studio board...</p>;

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-h3 text-ink">Studio Insights</h1>
      <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
        What /studio-insights shows. Slots are fully manual: set the total
        and remaining for each line, and set total to 0 to hide that card.
        Changes go live within five minutes.
      </p>
      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}

      <h2 className="mt-8 font-display text-h4 font-semibold text-ink">Capacity</h2>
      <div className="mt-4 space-y-4">
        {slots.map((s) => (
          <SlotEditor key={s.id} slot={s} onSaved={load} />
        ))}
      </div>

      <div className="mt-10 flex items-center justify-between">
        <h2 className="font-display text-h4 font-semibold text-ink">Production board</h2>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="tap rounded-[3px] bg-brand-gradient px-5 py-2.5 text-body font-semibold text-canvas transition-all hover:brightness-110"
        >
          Add entry
        </button>
      </div>

      {editing && (
        <div className="mt-5">
          <UpdateForm
            initial={editing === "new" ? {} : editing}
            onDone={() => {
              setEditing(null);
              load();
            }}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      <ul className="mt-5 overflow-hidden rounded-card border border-hair">
        {updates.length === 0 && (
          <li className="bg-canvas px-5 py-6 text-body text-muted">
            Nothing on the board yet. Add the first entry.
          </li>
        )}
        {updates.map((u) => (
          <li
            key={u.id}
            className="flex flex-wrap items-center justify-between gap-3 border-t border-hair bg-canvas px-5 py-4 first:border-t-0"
          >
            <div className="min-w-0">
              <p className="font-display text-h4 font-semibold text-ink">
                {u.title}
                {!u.published && (
                  <span className="ml-2 font-mono text-label uppercase text-dim">[draft]</span>
                )}
              </p>
              <p className="mt-0.5 font-mono text-label uppercase text-muted">
                {STATUS_NAMES[u.status]}
                {u.target_date ? ` / ${u.target_date}` : ""}
                {u.note ? ` / ${u.note}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setEditing(u)}
                className="tap rounded-[3px] border border-hair px-4 py-2 text-body-sm text-ink transition-colors hover:border-gold/60"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => remove(u)}
                className="tap rounded-[3px] border border-hair px-4 py-2 text-body-sm text-error transition-colors hover:border-error/60"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
