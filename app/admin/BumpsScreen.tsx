"use client";

import { useEffect, useState } from "react";
import { money, supabase } from "./client";

type BumpRow = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  unit: "flat" | "per_video";
  scope: "all" | "kinds" | "prefixes" | "skus";
  scope_values: string[];
  active: boolean;
  sort: number;
};

const field =
  "mt-1.5 w-full rounded-[3px] border border-hair bg-canvas px-3 py-2.5 text-body text-ink focus:border-gold focus:outline-none";
const lab = "font-mono text-label uppercase text-muted";

const SCOPE_HINT: Record<BumpRow["scope"], string> = {
  all: "Shown on every product.",
  kinds: "Comma-separated kinds: video, pack, bundle",
  prefixes: "Comma-separated code prefixes: EXP, DEMO, SHORT, MKT, FA, PACK",
  skus: "Comma-separated product codes: exp-004, demo-003",
};

function BumpForm({
  initial,
  onDone,
  onCancel,
}: {
  initial: Partial<BumpRow>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const isNew = !initial.id;
  const [b, setB] = useState({
    name: initial.name ?? "",
    description: initial.description ?? "",
    price: initial.price_cents != null ? String(initial.price_cents / 100) : "",
    unit: initial.unit ?? "flat",
    scope: initial.scope ?? "all",
    scopeValues: (initial.scope_values ?? []).join(", "),
    active: initial.active ?? true,
    sort: initial.sort != null ? String(initial.sort) : "0",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: unknown) => setB((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!b.name.trim() || b.price === "") {
      setErr("Name and price are required.");
      return;
    }
    setBusy(true);
    setErr("");
    const payload = {
      name: b.name.trim(),
      description: b.description.trim() || null,
      price_cents: Math.round(Number(b.price) * 100),
      unit: b.unit,
      scope: b.scope,
      scope_values:
        b.scope === "all"
          ? []
          : b.scopeValues
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
      active: b.active,
      sort: Number(b.sort) || 0,
      updated_at: new Date().toISOString(),
    };
    const q = supabase.from("order_bumps");
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
        {isNew ? "Add an order bump" : `Edit ${initial.name}`}
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className={lab}>Name</span>
          <input
            required
            value={b.name}
            onChange={(e) => set("name", e.target.value)}
            className={field}
            placeholder="Niche customization"
          />
        </label>
        <label className="sm:col-span-2">
          <span className={lab}>Description</span>
          <textarea
            rows={2}
            value={b.description}
            onChange={(e) => set("description", e.target.value)}
            className={`${field} resize-y`}
            placeholder="Swap any graphic or footage so the video fits your niche."
          />
        </label>
        <label>
          <span className={lab}>Price (USD)</span>
          <input
            required
            type="number"
            min="0"
            step="1"
            value={b.price}
            onChange={(e) => set("price", e.target.value)}
            className={field}
          />
        </label>
        <label>
          <span className={lab}>Price type</span>
          <select value={b.unit} onChange={(e) => set("unit", e.target.value)} className={field}>
            <option value="flat">Flat (one price)</option>
            <option value="per_video">Per video (× video count)</option>
          </select>
        </label>
        <label>
          <span className={lab}>Show on</span>
          <select value={b.scope} onChange={(e) => set("scope", e.target.value)} className={field}>
            <option value="all">All products</option>
            <option value="kinds">By kind</option>
            <option value="prefixes">By code prefix</option>
            <option value="skus">Specific products</option>
          </select>
        </label>
        <label>
          <span className={lab}>Sort</span>
          <input
            type="number"
            value={b.sort}
            onChange={(e) => set("sort", e.target.value)}
            className={field}
          />
        </label>
        {b.scope !== "all" ? (
          <label className="sm:col-span-2">
            <span className={lab}>Targets</span>
            <input
              value={b.scopeValues}
              onChange={(e) => set("scopeValues", e.target.value)}
              className={field}
              placeholder={SCOPE_HINT[b.scope as BumpRow["scope"]]}
            />
            <span className="mt-1 block font-mono text-label text-dim">
              {SCOPE_HINT[b.scope as BumpRow["scope"]]}
            </span>
          </label>
        ) : (
          <p className="self-end font-mono text-label text-dim sm:col-span-2">
            {SCOPE_HINT.all}
          </p>
        )}
        <label className="flex items-center gap-3 sm:col-span-2">
          <input
            type="checkbox"
            checked={b.active}
            onChange={(e) => set("active", e.target.checked)}
            className="h-4 w-4 accent-[#00CC00]"
          />
          <span className="text-body text-ink">Active (offered at checkout)</span>
        </label>
      </div>
      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}
      <div className="mt-5 flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="tap rounded-[3px] bg-brand-gradient px-6 py-2.5 text-body font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Saving" : "Save bump"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="tap rounded-[3px] border border-hair px-6 py-2.5 text-body text-muted transition-colors hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function BumpsScreen() {
  const [rows, setRows] = useState<BumpRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<BumpRow | "new" | null>(null);
  const [err, setErr] = useState("");

  async function load() {
    const { data, error } = await supabase
      .from("order_bumps")
      .select("*")
      .order("sort", { ascending: true });
    if (error) setErr(error.message);
    else setRows(data as BumpRow[]);
    setLoaded(true);
  }
  useEffect(() => {
    load();
  }, []);

  async function remove(id: string, name: string) {
    if (!confirm(`Delete the "${name}" bump? Existing orders keep their copy.`)) return;
    const { error } = await supabase.from("order_bumps").delete().eq("id", id);
    if (error) setErr(error.message);
    else load();
  }

  if (!loaded) return <p className="text-body text-muted">Loading bumps...</p>;

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-h3 text-ink">Order Bumps</h1>
          <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
            Opt-in add-ons offered at checkout. Choose a price, whether it is
            flat or per video, and which products or groups show it. The checkout
            re-derives every price server-side. {rows.length} bump
            {rows.length === 1 ? "" : "s"}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="tap rounded-[3px] bg-brand-gradient px-6 py-2.5 text-body font-semibold text-canvas transition-all hover:brightness-110"
        >
          Add bump
        </button>
      </div>

      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}

      {editing && (
        <div className="mt-6">
          <BumpForm
            initial={editing === "new" ? {} : editing}
            onDone={() => {
              setEditing(null);
              load();
            }}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      <ul className="mt-6 overflow-hidden rounded-card border border-hair">
        {rows.length === 0 ? (
          <li className="bg-surface px-5 py-8 text-center text-body text-muted">
            No bumps yet. Add one to offer an upsell at checkout.
          </li>
        ) : null}
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-hair bg-surface px-5 py-4 first:border-t-0"
          >
            <div className="min-w-0">
              <p className="text-body font-semibold text-ink">
                {r.name}
                <span className="ml-3 font-mono text-price font-bold text-gold [font-variant-numeric:tabular-nums]">
                  {money(r.price_cents, "usd")}
                  {r.unit === "per_video" ? "/video" : ""}
                </span>
                {!r.active && (
                  <span className="ml-3 inline-flex rounded-full border border-hair bg-canvas px-2.5 py-0.5 font-mono text-label uppercase text-dim">
                    inactive
                  </span>
                )}
              </p>
              <p className="mt-0.5 font-mono text-label uppercase text-dim">
                {r.scope === "all"
                  ? "all products"
                  : `${r.scope}: ${r.scope_values.join(", ") || "none"}`}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setEditing(r)}
                className="tap rounded-[3px] border border-hair px-3.5 py-1.5 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => remove(r.id, r.name)}
                className="tap rounded-[3px] border border-hair px-3.5 py-1.5 font-mono text-label uppercase text-muted transition-colors hover:border-error/60 hover:text-error"
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
