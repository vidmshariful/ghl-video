"use client";

import { useEffect, useState } from "react";
import { Input, Select } from "@/components/portal/ui";
import { supabase } from "./client";
import { AdminModal } from "./Modal";

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
  status: "selected" | "in_production" | "published";
  format: string | null;
  note: string | null;
  target_date: string | null;
  link_slug: string | null;
  sort: number;
  published: boolean;
};

type RequestRow = {
  id: string;
  topic: string;
  status: "new" | "selected" | "dismissed";
  created_at: string;
};


const SERVICE_NAMES: Record<SlotRow["service"], string> = {
  premade: "Premade Videos",
  custom: "Custom Production",
  editing: "Video Editing (new client spots)",
};

const STATUS_NAMES: Record<UpdateRow["status"], string> = {
  selected: "Up next",
  in_production: "In production",
  published: "Published",
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
      className="grid items-end gap-4 rounded-[12px] border border-hair bg-surface p-5 sm:grid-cols-[1.2fr_1fr_1fr_1fr_auto]"
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
        <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Period label</span>
        <Input
          value={s.period}
          onChange={(e) => setS((x) => ({ ...x, period: e.target.value }))}
          placeholder="This week"
        />
      </label>
      <label>
        <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Total slots</span>
        <Input
          type="number"
          min={0}
          value={s.total}
          onChange={(e) => setS((x) => ({ ...x, total: e.target.value }))}
        />
      </label>
      <label>
        <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Remaining</span>
        <Input
          type="number"
          min={0}
          value={s.remaining}
          onChange={(e) => setS((x) => ({ ...x, remaining: e.target.value }))}
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="tap rounded-[8px] bg-brand-gradient px-5 py-2.5 text-body font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60"
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
    format: initial.format ?? "",
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
      format: u.format || null,
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
    <form onSubmit={save}>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Title</span>
          <Input
            required
            value={u.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Payments + Invoicing Explainer"
          />
        </label>
        <label>
          <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Status</span>
          <Select
            value={u.status}
            onChange={(e) => set("status", e.target.value)}
          >
            <option value="selected">Up next</option>
            <option value="in_production">In production</option>
            <option value="published">Published</option>
          </Select>
        </label>
        <label>
          <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Video type</span>
          <Select
            value={u.format}
            onChange={(e) => set("format", e.target.value)}
          >
            <option value="">None</option>
            <option value="Explainer">Explainer</option>
            <option value="Demo">Demo</option>
            <option value="Marketing / Promo">Marketing / Promo</option>
          </Select>
        </label>
        <label>
          <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Target / published date</span>
          <Input
            type="date"
            value={u.target}
            onChange={(e) => set("target", e.target.value)}
          />
        </label>
        <label className="sm:col-span-2">
          <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Note (one line, optional)</span>
          <Input
            value={u.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder="Scripted and voiced; animation pass this week."
          />
        </label>
        <label>
          <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Library slug (Order Now link when published)</span>
          <Input
            value={u.slug}
            onChange={(e) => set("slug", e.target.value)}
            placeholder="payments-invoicing-explainer"
          />
        </label>
        <label>
          <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Sort</span>
          <Input
            type="number"
            value={u.sort}
            onChange={(e) => set("sort", e.target.value)}
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
          className="tap rounded-[8px] bg-brand-gradient px-6 py-2.5 text-body font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Saving" : "Save entry"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="tap rounded-[8px] border border-hair px-6 py-2.5 text-body text-ink transition-colors hover:border-gold/60"
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
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [editing, setEditing] = useState<UpdateRow | "new" | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    const [a, b, c] = await Promise.all([
      supabase.from("studio_slots").select("*").order("service"),
      supabase.from("studio_updates").select("*").order("sort").order("updated_at", { ascending: false }),
      supabase.from("studio_requests").select("*").order("created_at", { ascending: false }),
    ]);
    if (a.error || b.error || c.error) setErr((a.error ?? b.error ?? c.error)!.message);
    else {
      setSlots(a.data as SlotRow[]);
      setUpdates(b.data as UpdateRow[]);
      setRequests(c.data as RequestRow[]);
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

  /* promote a visitor request onto the board as an Up next card */
  async function promote(r: RequestRow) {
    const ins = await supabase
      .from("studio_updates")
      .insert({ title: r.topic, status: "selected", published: true, sort: 0 });
    if (ins.error) {
      setErr(ins.error.message);
      return;
    }
    const upd = await supabase
      .from("studio_requests")
      .update({ status: "selected" })
      .eq("id", r.id);
    if (upd.error) setErr(upd.error.message);
    load();
  }

  async function setRequestStatus(r: RequestRow, status: RequestRow["status"]) {
    const { error } = await supabase
      .from("studio_requests")
      .update({ status })
      .eq("id", r.id);
    if (error) setErr(error.message);
    else load();
  }

  async function removeRequest(r: RequestRow) {
    if (!confirm(`Delete the request "${r.topic}"?`)) return;
    const { error } = await supabase.from("studio_requests").delete().eq("id", r.id);
    if (error) setErr(error.message);
    else load();
  }

  if (!loaded) return <p className="text-body text-muted">Loading the studio board...</p>;

  return (
    <div className="w-full">
      <h1 className="font-display text-h3 text-ink">Studio Insights</h1>
      <p className="mt-0.5 max-w-[var(--measure-body)] text-body-sm text-muted">
        What /studio-insights shows. Slots are fully manual: set the total
        and remaining for each line, and set total to 0 to hide that card.
        Visitor video requests queue below; move one to the board to show
        it as Up next. Changes go live within five minutes.
      </p>
      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}

      <h2 className="mt-8 font-display text-h4 font-semibold text-ink">Capacity</h2>
      <div className="mt-4 space-y-4">
        {slots.map((s) => (
          <SlotEditor key={s.id} slot={s} onSaved={load} />
        ))}
      </div>

      <h2 className="mt-10 font-display text-h4 font-semibold text-ink">
        Video requests
        {requests.some((r) => r.status === "new") && (
          <span className="ml-2 font-mono text-label uppercase text-gold">
            [ {requests.filter((r) => r.status === "new").length} new ]
          </span>
        )}
      </h2>
      <ul className="mt-4 overflow-hidden rounded-[12px] border border-hair">
        {requests.length === 0 && (
          <li className="bg-canvas px-5 py-5 text-body text-muted">
            No visitor requests yet. They arrive from the board on
            /studio-insights.
          </li>
        )}
        {requests.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-3 border-t border-hair bg-canvas px-5 py-3.5 first:border-t-0"
          >
            <div className="min-w-0">
              <p className={`text-body ${r.status === "new" ? "text-ink" : "text-dim"}`}>
                {r.topic}
              </p>
              <p className="mt-0.5 font-mono text-label uppercase text-dim">
                {r.created_at.slice(0, 10)}
                {r.status !== "new" ? ` / ${r.status}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {r.status === "new" && (
                <>
                  <button
                    type="button"
                    onClick={() => promote(r)}
                    className="tap rounded-[8px] bg-brand-gradient px-4 py-2 text-body-sm font-semibold text-canvas transition-all hover:brightness-110"
                  >
                    Move to board
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequestStatus(r, "dismissed")}
                    className="tap rounded-[8px] border border-hair px-4 py-2 text-body-sm text-ink transition-colors hover:border-gold/60"
                  >
                    Dismiss
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => removeRequest(r)}
                className="tap rounded-[8px] border border-hair px-4 py-2 text-body-sm text-error transition-colors hover:border-error/60"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-10 flex items-center justify-between">
        <h2 className="font-display text-h4 font-semibold text-ink">Premade pipeline</h2>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="tap rounded-[8px] bg-brand-gradient px-5 py-2.5 text-body font-semibold text-canvas transition-all hover:brightness-110"
        >
          Add entry
        </button>
      </div>

      <AdminModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === "new" || !editing ? "Add a board entry" : `Edit ${editing.title}`}
      >
        {editing && (
          <UpdateForm
            initial={editing === "new" ? {} : editing}
            onDone={() => {
              setEditing(null);
              load();
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </AdminModal>

      <ul className="mt-5 overflow-hidden rounded-[12px] border border-hair">
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
                {u.format ? ` / ${u.format}` : ""}
                {u.target_date ? ` / ${u.target_date}` : ""}
                {u.note ? ` / ${u.note}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setEditing(u)}
                className="tap rounded-[8px] border border-hair px-4 py-2 text-body-sm text-ink transition-colors hover:border-gold/60"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => remove(u)}
                className="tap rounded-[8px] border border-hair px-4 py-2 text-body-sm text-error transition-colors hover:border-error/60"
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
