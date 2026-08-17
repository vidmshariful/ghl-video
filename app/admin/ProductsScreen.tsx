"use client";

import { useEffect, useState } from "react";
import { Input, Select, Textarea } from "@/components/portal/ui";
import { authHeader, money, supabase } from "./client";
import { AdminModal } from "./Modal";
import { BumpsScreen } from "./BumpsScreen";
import { packContentsFor } from "@/lib/content/pack-map";

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
    <form onSubmit={save}>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label>
          <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">SKU (checkout slug)</span>
          <Input
            required
            disabled={!isNew}
            value={p.sku}
            onChange={(e) => set("sku", e.target.value)} className="disabled:opacity-60"
            placeholder="all-in-one-ai-first-positioning"
          />
        </label>
        <label>
          <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Type</span>
          <Select value={p.type} onChange={(e) => set("type", e.target.value)}>
            <option value="one_time">One-time</option>
            <option value="subscription">Subscription</option>
          </Select>
        </label>
        <label className="sm:col-span-2">
          <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Name</span>
          <Input required value={p.name} onChange={(e) => set("name", e.target.value)} />
        </label>
        <label className="sm:col-span-2">
          <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Description</span>
          <Textarea
            rows={2}
            value={p.description}
            onChange={(e) => set("description", e.target.value)} className="resize-y"
          />
        </label>
        <label>
          <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Price (USD)</span>
          <Input
            required
            type="number"
            min="0"
            step="1"
            value={p.price}
            onChange={(e) => set("price", e.target.value)}
          />
        </label>
        <label>
          <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Delivery days</span>
          <Input
            type="number"
            min="0"
            value={p.delivery_days}
            onChange={(e) => set("delivery_days", e.target.value)}
          />
        </label>
        <label className="sm:col-span-2">
          <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">HighLevel tags (comma separated)</span>
          <Input
            value={p.tags}
            onChange={(e) => set("tags", e.target.value)}
            placeholder="ghlv-purchase, ghlv-all-in-one-ai-first-positioning"
          />
        </label>
        <label className="flex items-center gap-3 sm:col-span-2">
          <input
            type="checkbox"
            checked={p.active}
            onChange={(e) => set("active", e.target.checked)}
            className="h-4 w-4 accent-[var(--green)]"
          />
          <span className="text-body text-ink">Active (sellable at checkout)</span>
        </label>
      </div>
      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}
      <div className="mt-5 flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="tap rounded-[8px] bg-brand-gradient px-6 py-2.5 text-body font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Saving" : "Save product"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="tap rounded-[8px] border border-hair px-6 py-2.5 text-body text-muted transition-colors hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ProductsScreen() {
  const [tab, setTab] = useState<"products" | "packs" | "bumps">("products");
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

  /* Sync every one-time SKU from the site catalog: new SKUs get a row,
     existing catalog SKUs take the catalog's price, name and metadata.
     The active switch and hand-created rows are never touched. */
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
      const priceChanges = (j.updatedSkus ?? [])
        .map(
          (u: { sku: string; fromCents: number; toCents: number }) =>
            `${u.sku} ${money(u.fromCents, "usd")} to ${money(u.toCents, "usd")}`,
        )
        .join(", ");
      setSyncMsg(
        `Synced ${j.total} catalog SKUs: ${j.inserted} added, ${j.updated} updated, ${j.unchanged} unchanged.` +
          (priceChanges ? ` Changes: ${priceChanges}.` : ""),
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
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-h2 text-ink">Products &amp; Pricing</h1>
        {tab === "products" && (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={sync}
              disabled={syncing}
              className="tap rounded-[8px] border border-hair px-5 py-2.5 text-body font-semibold text-ink transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-60"
            >
              {syncing ? "Syncing" : "Sync from catalog"}
            </button>
            <button
              type="button"
              onClick={() => setEditing("new")}
              className="tap rounded-[8px] bg-brand-gradient px-6 py-2.5 text-body font-semibold text-canvas transition-all hover:brightness-110"
            >
              Add product
            </button>
          </div>
        )}
      </div>

      {/* what we sell, in two tabs: the sellable products and their bumps */}
      <div className="mt-6 flex gap-1 border-b border-hair">
        {(
          [
            ["products", "Products"],
            ["packs", "Packs & bundles"],
            ["bumps", "Order bumps"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`tap rounded-t-[8px] px-4 py-2.5 text-body-sm transition-colors ${
              tab === k
                ? "border border-b-0 border-hair bg-surface font-semibold text-gold"
                : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "bumps" ? (
        <div className="mt-6">
          <BumpsScreen embedded />
        </div>
      ) : tab === "packs" ? (
        <PacksTab rows={rows} onEdit={(r) => setEditing(r)} />
      ) : (
        <>
      <p className="mt-4 max-w-[var(--measure-body)] text-body text-muted">
        The checkout reads the price straight from here at purchase time, so
        edits take effect immediately. {rows.length} product
        {rows.length === 1 ? "" : "s"}.
      </p>

      {syncMsg && (
        <p className="mt-4 rounded-[8px] border border-gold/30 bg-gold/[0.06] px-4 py-3 text-body-sm text-muted">
          {syncMsg}
        </p>
      )}

      <div className="mt-4 rounded-[8px] border border-gold/30 bg-gold/[0.06] px-4 py-3 text-body-sm text-muted">
        Catalog SKUs take their price from the site code: change it there,
        deploy, then run Sync from catalog so the page and the checkout always
        agree. A price edited directly here holds only until the next sync.
        The active switch and products created here by hand are never
        overwritten by a sync.
      </div>

      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}

      <AdminModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === "new" || !editing ? "Add a product" : `Edit ${editing.name}`}
      >
        {editing && (
          <ProductForm
            initial={editing === "new" ? {} : editing}
            onDone={() => {
              setEditing(null);
              load();
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </AdminModal>

      <ul className="mt-6 overflow-hidden rounded-[12px] border border-hair">
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
              className="tap shrink-0 rounded-[8px] border border-hair px-3.5 py-1.5 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
            >
              Edit
            </button>
          </li>
        ))}
      </ul>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Packs & bundles: every multi-video product with its composition    */
/* ---------------------------------------------------------------- */
function PacksTab({
  rows,
  onEdit,
}: {
  rows: ProductRow[];
  onEdit: (r: ProductRow) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const packs = rows.filter((r) => {
    const kind = (r.metadata ?? {}).kind;
    return kind === "pack" || kind === "bundle";
  });

  async function copyLink(r: ProductRow) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/checkout/${r.sku}`);
      setCopied(r.id);
      window.setTimeout(() => setCopied((c) => (c === r.id ? null : c)), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="mt-6">
      <p className="max-w-[var(--measure-body)] text-body text-muted">
        Every pack and bundle we sell, with what is inside it. Composition
        follows the site catalog; prices and the active switch are edited on
        the product itself.
      </p>
      {packs.length === 0 ? (
        <p className="mt-6 text-body-sm text-muted">No packs or bundles yet.</p>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {packs.map((r) => {
            const c = packContentsFor(r.sku);
            const code = ((r.metadata ?? {}).code as string) ?? r.sku.toUpperCase();
            return (
              <div key={r.id} className="rounded-[12px] border border-hair bg-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-label uppercase tracking-[0.08em] text-gold/80">{code}</p>
                    <p className="mt-0.5 text-body font-semibold text-ink">{r.name}</p>
                    <p className="mt-0.5 font-mono text-body-sm text-muted">
                      {money(r.price_cents, r.currency)}
                      {!r.active ? " / inactive" : ""}
                      {c?.videoCount ? ` / ${c.videoCount} videos` : ""}
                      {c?.deliveryDays ? ` / ${c.deliveryDays} day delivery` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => copyLink(r)}
                      className="tap rounded-[8px] border border-hair px-3 py-1.5 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
                    >
                      {copied === r.id ? "Copied" : "Buy link"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(r)}
                      className="tap rounded-[8px] border border-hair px-3 py-1.5 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
                    >
                      Edit
                    </button>
                  </div>
                </div>
                {c ? (
                  <div className="mt-4 border-t border-hair pt-4">
                    {c.lines.length > 0 ? (
                      <ul className="flex flex-wrap gap-1.5">
                        {c.lines.map((l) => (
                          <li
                            key={l}
                            className="rounded-full border border-hair bg-canvas px-2.5 py-0.5 font-mono text-label uppercase text-muted"
                          >
                            {l}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {c.videos.length > 0 ? (
                      <ul className="mt-3 grid gap-1 sm:grid-cols-2">
                        {c.videos.map((v) => (
                          <li key={v.title} className="text-body-sm text-ink">
                            {v.title}
                            {v.sku ? (
                              <span className="ml-1.5 font-mono text-label uppercase text-dim">
                                {v.sku.toUpperCase()}
                              </span>
                            ) : null}
                            {v.comingSoon ? (
                              <span className="ml-1.5 font-mono text-label uppercase text-gold/70">soon</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {c.note ? <p className="mt-3 text-body-sm text-dim">{c.note}</p> : null}
                  </div>
                ) : (
                  <p className="mt-4 border-t border-hair pt-4 text-body-sm text-dim">
                    Composition is not mapped for this product.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
