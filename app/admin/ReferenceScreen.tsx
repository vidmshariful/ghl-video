"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { authHeader } from "./client";

/*
 * Quick reference: the things you need often, in one place.
 *
 * Copying is the point, so copy is the biggest thing on every row. A secret's
 * value is not even sent to the browser with the list; it is fetched when
 * somebody asks for that one. That is deliberate rather than decorative: this
 * screen gets screenshotted, and a wall of visible keys is how one leaks.
 */

type Item = {
  id: string;
  label: string;
  note: string | null;
  category: string;
  secret: boolean;
  value: string | null;
  updatedAt: string;
};

type Draft = {
  id?: string;
  label: string;
  value: string;
  note: string;
  category: string;
  secret: boolean;
};

const EMPTY: Draft = { label: "", value: "", note: "", category: "General", secret: false };

const field =
  "tap w-full rounded-[8px] border border-hair bg-canvas px-3 py-2 text-body-sm text-ink placeholder:text-dim";
const lab = "font-mono text-label uppercase tracking-[0.1em] text-dim";
const btn =
  "tap rounded-[8px] border border-hair px-3.5 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-40";

export function ReferenceScreen() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [shown, setShown] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setErr("");
    try {
      const r = await fetch("/api/admin/reference", { headers: await authHeader() });
      const j = await r.json();
      if (!r.ok) return setErr(j.error ?? "Could not load these.");
      setItems(j.items as Item[]);
    } catch {
      setErr("Could not load these.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** the value we can copy right now, if we have it */
  const valueOf = (i: Item) => (i.secret ? (shown[i.id] ?? null) : i.value);

  async function reveal(i: Item): Promise<string | null> {
    if (!i.secret) return i.value;
    if (shown[i.id]) return shown[i.id];
    const r = await fetch(`/api/admin/reference?reveal=${i.id}`, { headers: await authHeader() });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.value) {
      setErr(j?.error ?? "Could not fetch that.");
      return null;
    }
    setShown((s) => ({ ...s, [i.id]: j.value as string }));
    return j.value as string;
  }

  async function copy(i: Item) {
    const v = await reveal(i);
    if (!v) return;
    try {
      await navigator.clipboard.writeText(v);
      setCopied(i.id);
      setTimeout(() => setCopied((c) => (c === i.id ? null : c)), 1600);
    } catch {
      setErr("Your browser would not let us copy. Reveal it and copy by hand.");
    }
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setErr("");
    const r = await fetch("/api/admin/reference", {
      method: draft.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify(draft),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(false);
    if (r && !r.ok) return setErr(j?.error ?? "Could not save.");
    // a changed secret must not keep showing the old revealed value
    if (draft.id) setShown((s) => ({ ...s, [draft.id!]: "" }));
    setDraft(null);
    await load();
  }

  async function remove(i: Item) {
    if (!confirm(`Delete "${i.label}"? This cannot be undone.`)) return;
    setBusy(true);
    await fetch(`/api/admin/reference?id=${i.id}`, {
      method: "DELETE",
      headers: await authHeader(),
    }).catch(() => null);
    setBusy(false);
    await load();
  }

  const categories = useMemo(
    () => [...new Set((items ?? []).map((i) => i.category))].sort(),
    [items],
  );

  const shownItems = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items ?? [];
    return (items ?? []).filter((i) =>
      [i.label, i.note, i.category, i.secret ? "" : i.value]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [items, q]);

  if (err && !items) return <p className="text-body text-error">{err}</p>;
  if (!items) return <p className="text-body text-muted">Loading...</p>;

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-h2 text-ink">Reference</h1>
          <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
            The things you need often, in one place. Anything marked secret stays
            hidden until you ask for it, so this screen is safe to have open.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDraft({ ...EMPTY })}
          className="tap rounded-[8px] bg-brand-gradient px-4 py-2.5 font-mono text-label font-bold uppercase text-canvas transition-opacity hover:opacity-90"
        >
          Add something
        </button>
      </div>

      {items.length > 0 && (
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, note or category"
          className={`${field} mt-6 max-w-[28rem]`}
        />
      )}

      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}

      {draft && (
        <div className="mt-6 rounded-[12px] border border-gold/40 bg-surface p-5">
          <p className="font-mono text-label uppercase text-gold">
            {draft.id ? "Edit" : "Add something"}
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="grid gap-1">
              <span className={lab}>Name</span>
              <input
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="Team site access key"
                className={field}
              />
            </label>
            <label className="grid gap-1">
              <span className={lab}>Category</span>
              <input
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                placeholder="Keys and access"
                list="reference-categories"
                className={field}
              />
              <datalist id="reference-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="grid gap-1 md:col-span-2">
              <span className={lab}>The thing itself</span>
              <textarea
                rows={2}
                value={draft.value}
                onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                placeholder="Paste the key, link or id"
                className={field}
              />
            </label>
            <label className="grid gap-1 md:col-span-2">
              <span className={lab}>Note, so future you remembers what it is for</span>
              <input
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                placeholder="Give each teammate their own. Revoke one without touching the rest."
                className={field}
              />
            </label>
          </div>

          <label className="mt-4 flex items-start gap-2.5 text-body-sm text-muted">
            <input
              type="checkbox"
              checked={draft.secret}
              onChange={(e) => setDraft({ ...draft, secret: e.target.checked })}
              className="mt-0.5 h-4 w-4 accent-[#FCC000]"
            />
            <span>
              Keep this hidden until asked for. Use it for anything you would not
              want in a screenshot.
            </span>
          </label>

          <p className="mt-3 text-body-sm text-dim">
            Do not put the Stripe secret key, the database key or the database URL
            here. Those belong in the hosting settings, where they are encrypted
            and cannot be read back out. Putting one here would turn a single admin
            login into access to everything.
          </p>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={busy || !draft.label.trim() || !draft.value.trim()}
              onClick={save}
              className={`${btn} border-gold/60 text-gold`}
            >
              {busy ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={() => setDraft(null)} className={btn}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="mt-8 rounded-[12px] border border-hair bg-surface p-8 text-center">
          <p className="text-body text-muted">
            Nothing here yet. Add the things you find yourself hunting for: keys,
            links, ids, the exact wording of something.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-6">
          {categories
            .filter((c) => shownItems.some((i) => i.category === c))
            .map((cat) => (
              <section key={cat}>
                <h2 className="font-mono text-label uppercase tracking-[0.1em] text-gold">{cat}</h2>
                <ul className="mt-3 grid gap-2">
                  {shownItems
                    .filter((i) => i.category === cat)
                    .map((i) => {
                      const v = valueOf(i);
                      return (
                        <li key={i.id} className="rounded-[12px] border border-hair bg-surface p-4">
                          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                            <div className="min-w-[12rem] flex-1">
                              <p className="text-body-sm font-semibold text-ink">
                                {i.label}
                                {i.secret && (
                                  <span className="ml-2 rounded-full border border-gold/40 px-2 py-0.5 font-mono text-label uppercase text-gold">
                                    Secret
                                  </span>
                                )}
                              </p>
                              {i.note && <p className="mt-1 text-body-sm text-muted">{i.note}</p>}
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => copy(i)}
                                className={`${btn} ${copied === i.id ? "border-green/60 text-green" : ""}`}
                              >
                                {copied === i.id ? "Copied" : "Copy"}
                              </button>
                              {i.secret && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    v
                                      ? setShown((s) => ({ ...s, [i.id]: "" }))
                                      : reveal(i)
                                  }
                                  className={btn}
                                >
                                  {v ? "Hide" : "Show"}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={async () => {
                                  const full = await reveal(i);
                                  setDraft({
                                    id: i.id,
                                    label: i.label,
                                    value: full ?? "",
                                    note: i.note ?? "",
                                    category: i.category,
                                    secret: i.secret,
                                  });
                                }}
                                className={btn}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => remove(i)}
                                className={`${btn} hover:border-error/60 hover:text-error`}
                              >
                                Delete
                              </button>
                            </div>
                          </div>

                          {v ? (
                            <p className="mt-3 break-all rounded-[8px] border border-hair bg-canvas px-3 py-2 font-mono text-body-sm text-ink">
                              {v}
                            </p>
                          ) : (
                            <p className="mt-3 rounded-[8px] border border-hair bg-canvas px-3 py-2 font-mono text-body-sm text-dim">
                              Hidden. Copy takes it straight to your clipboard without
                              showing it.
                            </p>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </section>
            ))}
          {shownItems.length === 0 && (
            <p className="text-body text-muted">Nothing matches that.</p>
          )}
        </div>
      )}
    </div>
  );
}
