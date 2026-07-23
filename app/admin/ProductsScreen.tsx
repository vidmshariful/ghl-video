"use client";

import { useEffect, useState } from "react";
import { authHeader, money, supabase } from "./client";

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  type: "one_time" | "subscription";
  price_cents: number;
  currency: string;
  active: boolean;
  metadata: Record<string, unknown> | null;
};

const field =
  "mt-1.5 w-full rounded-[3px] border border-hair bg-canvas px-3 py-2.5 text-body text-ink focus:border-gold focus:outline-none";
const lab = "font-mono text-label uppercase text-muted";

function ProductForm({
  initial,
  onDone,
  onCancel,
}: {
  initial: Partial<ProductRow>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const isNew = !initial.id;
  const meta = (initial.metadata ?? {}) as Record<string, unknown>;
  const [p, setP] = useState({
    sku: initial.sku ?? "",
    name: initial.name ?? "",
    description: initial.description ?? "",
    type: initial.type ?? "one_time",
    price: initial.price_cents != null ? String(initial.price_cents / 100) : "",
    active: initial.active ?? true,
    tags: ((meta.hl_tags as string[]) ?? []).join(", "),
    delivery_days: meta.delivery_days != null ? String(meta.delivery_days) : "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: unknown) => setP((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!p.sku.trim() || !p.name.trim() || p.price === "") {
      setErr("SKU, name and price are required.");
      return;
    }
    setBusy(true);
    setErr("");
    const metadata = {
      ...meta,
      hl_tags: p.tags.split(",").map((t) => t.trim()).filter(Boolean),
      delivery_days: p.delivery_days === "" ? null : Number(p.delivery_days),
    };
    const payload = {
      sku: p.sku.trim(),
      name: p.name.trim(),
      description: p.description.trim() || null,
      type: p.type,
      price_cents: Math.round(Number(p.price) * 100),
      active: p.active,
      metadata,
      updated_at: new Date().toISOString(),
    };
    const q = supabase.from("products");
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
        {isNew ? "Add a product" : `Edit ${initial.name}`}
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label>
          <span className={lab}>SKU (checkout slug)</span>
          <input
            required
            disabled={!isNew}
            value={p.sku}
            onChange={(e) => set("sku", e.target.value)}
            className={`${field} disabled:opacity-60`}
            placeholder="all-in-one-ai-first-positioning"
          />
        </label>
        <label>
          <span className={lab}>Type</span>
          <select value={p.type} onChange={(e) => set("type", e.target.value)} className={field}>
            <option value="one_time">One-time</option>
            <option value="subscription">Subscription</option>
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className={lab}>Name</span>
          <input required value={p.name} onChange={(e) => set("name", e.target.value)} className={field} />
        </label>
        <label className="sm:col-span-2">
          <span className={lab}>Description</span>
          <textarea
            rows={2}
            value={p.description}
            onChange={(e) => set("description", e.target.value)}
            className={`${field} resize-y`}
          />
        </label>
        <label>
          <span className={lab}>Price (USD)</span>
          <input
            required
            type="number"
            min="0"
            step="1"
            value={p.price}
            onChange={(e) => set("price", e.target.value)}
            className={field}
          />
        </label>
        <label>
          <span className={lab}>Delivery days</span>
          <input
            type="number"
            min="0"
            value={p.delivery_days}
            onChange={(e) => set("delivery_days", e.target.value)}
            className={field}
          />
        </label>
        <label className="sm:col-span-2">
          <span className={lab}>HighLevel tags (comma separated)</span>
          <input
            value={p.tags}
            onChange={(e) => set("tags", e.target.value)}
            className={field}
            placeholder="ghlv-purchase, ghlv-all-in-one-ai-first-positioning"
          />
        </label>
        <label className="flex items-center gap-3 sm:col-span-2">
          <input
            type="checkbox"
            checked={p.active}
            onChange={(e) => set("active", e.target.checked)}
            className="h-4 w-4 accent-[#00CC00]"
          />
          <span className="text-body text-ink">Active (sellable at checkout)</span>
        </label>
      </div>
      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}
      <div className="mt-5 flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="tap rounded-[3px] bg-brand-gradient px-6 py-2.5 text-body font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Saving" : "Save product"}
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

export function ProductsScreen() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<ProductRow | "new" | null>(null);
  const [err, setErr] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  async function load() {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) setErr(error.message);
    else setRows(data as ProductRow[]);
    setLoaded(true);
  }
  useEffect(() => {
    load();
  }, []);

  /* Create products rows for every one-time SKU in the catalog that does
     not have one yet. Insert-only, so it never overwrites a price set here. */
  async function sync() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const r = await fetch("/api/admin/sync-products", {
        method: "POST",
        headers: await authHeader(),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Sync failed.");
      setSyncMsg(
        `Synced: ${j.inserted} added, ${j.skipped} already present. ${j.total} one-time SKUs in the catalog.`,
      );
      await load();
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  if (!loaded) return <p className="text-body text-muted">Loading products...</p>;

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-h3 text-ink">Products &amp; Pricing</h1>
          <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
            The checkout reads the price straight from here at purchase time, so
            edits take effect immediately. {rows.length} product
            {rows.length === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={sync}
            disabled={syncing}
            className="tap rounded-[3px] border border-hair px-5 py-2.5 text-body font-semibold text-ink transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-60"
          >
            {syncing ? "Syncing" : "Sync from catalog"}
          </button>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="tap rounded-[3px] bg-brand-gradient px-6 py-2.5 text-body font-semibold text-canvas transition-all hover:brightness-110"
          >
            Add product
          </button>
        </div>
      </div>

      {syncMsg && (
        <p className="mt-4 rounded-[8px] border border-gold/30 bg-gold/[0.06] px-4 py-3 text-body-sm text-muted">
          {syncMsg}
        </p>
      )}

      <div className="mt-4 rounded-[8px] border border-gold/30 bg-gold/[0.06] px-4 py-3 text-body-sm text-muted">
        The marketing pages show their prices from the site code, separate from
        this table. After changing a price here, tell Claude Code to update the
        displayed price too, so the page and the checkout agree.
      </div>

      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}

      {editing && (
        <div className="mt-6">
          <ProductForm
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
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-hair bg-surface px-5 py-4 first:border-t-0"
          >
            <div className="min-w-0">
              <p className="text-body font-semibold text-ink">
                {r.name}
                <span className="ml-3 font-mono text-price font-bold text-gold [font-variant-numeric:tabular-nums]">
                  {money(r.price_cents, r.currency)}
                </span>
                {!r.active && (
                  <span className="ml-3 inline-flex rounded-full border border-hair bg-canvas px-2.5 py-0.5 font-mono text-label uppercase text-dim">
                    inactive
                  </span>
                )}
              </p>
              <p className="mt-0.5 font-mono text-label uppercase text-dim">
                {r.sku} / {r.type === "one_time" ? "one-time" : "subscription"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditing(r)}
              className="tap shrink-0 rounded-[3px] border border-hair px-3.5 py-1.5 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
            >
              Edit
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
