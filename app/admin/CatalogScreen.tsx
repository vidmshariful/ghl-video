"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminModal } from "./Modal";
import { authHeader, supabase } from "./client";
import { packsContaining, packsPickable } from "@/lib/content/pack-map";
import {
  bumpAppliesTo,
  bumpEffectivePrice,
  type OrderBump,
} from "@/lib/checkout/bump-match";

/*
 * The unified video Catalog (Phase 2 of the code->DB catalog move). One card
 * per video, backed by the `catalog` table (RLS: admins manage). Combines the
 * old Video List + Products & Pricing + Buy Links for individual videos: edit
 * link, sku (code), price, category, featured, release date, on-site, and copy
 * the buy link. Goes fully live to the site + checkout at Phase 3.
 */
type CatalogRow = {
  id: string;
  code: string;
  old_code: string | null;
  title: string;
  subject: string | null;
  category: string;
  library: "new" | "classic";
  price_cents: number;
  video_url: string | null;
  poster_url: string | null;
  wistia_id: string | null;
  pack_count: number | null;
  featured: boolean;
  release_date: string | null;
  on_site: boolean;
  coming_soon: boolean;
  sort: number;
  notes: string | null;
};

const CATEGORIES = [
  "Full Explainer",
  "Feature Explainer",
  "Demo",
  "Marketing",
  "Feature Animation",
] as const;

const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US")}`;

const field =
  "mt-1.5 w-full rounded-[8px] border border-hair bg-canvas px-3 py-2.5 text-body text-ink focus:border-gold focus:outline-none";
const lab = "font-mono text-label uppercase text-muted";

export function CatalogScreen() {
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<CatalogRow | "new" | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [copied, setCopied] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [bumps, setBumps] = useState<OrderBump[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState("");

  /* push the catalog to the products table so edits reach checkout: prices,
     new videos, and hidden (unbuyable) videos all take effect. Runs after
     every change, and on demand via the button. */
  const publish = useCallback(async () => {
    setPublishing(true);
    setPublished("");
    try {
      const r = await fetch("/api/admin/sync-catalog", {
        method: "POST",
        headers: await authHeader(),
      });
      const j = await r.json();
      if (!r.ok) setErr(j.error ?? "Publish to checkout failed.");
      else setPublished(`Checkout updated: ${j.active} live, ${j.hidden} hidden.`);
    } catch {
      setErr("Publish to checkout failed.");
    } finally {
      setPublishing(false);
    }
  }, []);

  const load = useCallback(async () => {
    setErr("");
    const [cat, ob] = await Promise.all([
      supabase
        .from("catalog")
        .select("*")
        .order("category", { ascending: true })
        .order("code", { ascending: true }),
      supabase
        .from("order_bumps")
        .select("*")
        .eq("active", true)
        .order("sort", { ascending: true }),
    ]);
    if (cat.error) setErr(cat.error.message);
    else setRows((cat.data as CatalogRow[]) ?? []);
    if (!ob.error) setBumps((ob.data as OrderBump[]) ?? []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(row: CatalogRow) {
    if (!window.confirm(`Delete "${row.title}" (${row.code.toUpperCase()}) from the catalog?`)) return;
    const { error } = await supabase.from("catalog").delete().eq("id", row.id);
    if (error) setErr(error.message);
    else {
      await publish();
      load();
    }
  }

  async function toggle(row: CatalogRow, key: "featured" | "on_site") {
    const { error } = await supabase.from("catalog").update({ [key]: !row[key] }).eq("id", row.id);
    if (error) setErr(error.message);
    else {
      // on_site controls buyability, so it must reach checkout; featured is
      // display-only and the site picks it up on its own.
      if (key === "on_site") await publish();
      load();
    }
  }

  async function copyLink(row: CatalogRow) {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/checkout/${row.code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(row.id);
      window.setTimeout(() => setCopied((c) => (c === row.id ? null : c)), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  const shown = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.category === filter)),
    [rows, filter],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.category] = (c[r.category] ?? 0) + 1;
    return c;
  }, [rows]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-h2 text-ink">Catalog</h1>
          <p className="mt-1 max-w-xl text-body-sm text-muted">
            Every video in one place: link, code, price, category, featured, release date, and buy link.
            {" "}
            {loaded ? `${rows.length} videos.` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={publish}
            disabled={publishing}
            className="tap rounded-[8px] border border-hair px-4 py-2.5 text-body-sm font-semibold text-muted transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-50"
            title="Push catalog prices and visibility to checkout"
          >
            {publishing ? "Publishing..." : "Publish to checkout"}
          </button>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="tap rounded-[8px] bg-brand-gradient px-5 py-2.5 text-body-sm font-semibold text-canvas transition-all hover:brightness-110"
          >
            Add video
          </button>
        </div>
      </div>

      {err ? <p className="mt-4 text-body-sm text-error">{err}</p> : null}
      {published ? <p className="mt-4 text-body-sm text-green">{published}</p> : null}

      {/* category filter */}
      <div className="mt-5 flex flex-wrap gap-2">
        {["all", ...CATEGORIES].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(c)}
            className={`tap rounded-full border px-3.5 py-1.5 font-mono text-label uppercase transition-colors ${
              filter === c
                ? "border-gold/60 bg-gold/10 text-gold"
                : "border-hair text-muted hover:border-gold/40 hover:text-ink"
            }`}
          >
            {c === "all" ? `All (${rows.length})` : `${c} (${counts[c] ?? 0})`}
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-[12px] border border-hair">
        {!loaded ? (
          <p className="p-6 text-body-sm text-muted">Loading catalog...</p>
        ) : shown.length === 0 ? (
          <p className="p-6 text-body-sm text-muted">No videos here.</p>
        ) : (
          <ul className="divide-y divide-hair">
            {shown.map((row) => (
              <li key={row.id} className="bg-surface/40">
                <div
                  className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 p-4"
                  onClick={() => setExpanded((e) => (e === row.id ? null : row.id))}
                >
                <span className="w-24 shrink-0 font-mono text-label uppercase tracking-[0.08em] text-gold/80">
                  {row.code.toUpperCase()}
                </span>
                <div className="min-w-[12rem] flex-1">
                  <p className="flex items-center gap-2 font-semibold text-ink">
                    <span className="truncate">{row.title}</span>
                    {row.featured ? (
                      <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 font-mono text-label uppercase text-gold">
                        Featured
                      </span>
                    ) : null}
                    {row.coming_soon ? (
                      <span className="rounded-full border border-hair px-2 py-0.5 font-mono text-label uppercase text-dim">
                        Soon
                      </span>
                    ) : null}
                    {!row.on_site ? (
                      <span className="rounded-full border border-error/40 bg-error/10 px-2 py-0.5 font-mono text-label uppercase text-error">
                        Hidden
                      </span>
                    ) : null}
                  </p>
                  <p className="text-body-sm text-muted">
                    {row.category} / {row.library === "new" ? "New" : "Classic"}
                    {row.old_code ? ` / was ${row.old_code.toUpperCase()}` : ""}
                  </p>
                </div>
                <span className="w-16 shrink-0 font-mono text-body-sm text-ink">{money(row.price_cents)}</span>
                <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={() => copyLink(row)} className={btnGhost}>
                    {copied === row.id ? "Copied" : "Buy link"}
                  </button>
                  <button type="button" onClick={() => toggle(row, "featured")} className={btnGhost}>
                    {row.featured ? "Unfeature" : "Feature"}
                  </button>
                  <button type="button" onClick={() => setEditing(row)} className={btnGhost}>
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(row)}
                    className="tap rounded-[8px] border border-hair px-3 py-1.5 font-mono text-label uppercase text-dim transition-colors hover:border-error/60 hover:text-error"
                  >
                    Delete
                  </button>
                </div>
                </div>
                {expanded === row.id ? <RowDetails row={row} bumps={bumps} /> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing ? (
        <CatalogForm
          row={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await publish();
            load();
          }}
        />
      ) : null}
    </div>
  );
}

const btnGhost =
  "tap rounded-[8px] border border-hair px-3 py-1.5 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold";

/* The relations a row cannot show inline: which packs carry this video,
 * which order bumps checkout will offer with it, and its links. Read-only;
 * membership and bump rules live where they are enforced (pack-map and
 * bump-match mirror the site and checkout exactly). */
function RowDetails({ row, bumps }: { row: CatalogRow; bumps: OrderBump[] }) {
  const isFaPack = row.category === "Feature Animation";
  const target = {
    sku: row.code,
    metadata: {
      kind: isFaPack ? "pack" : "video",
      code: row.code.toUpperCase(),
      video_count: row.pack_count ?? undefined,
    },
  };
  const applicable = bumps.filter((b) => bumpAppliesTo(b, target));
  const memberOf = packsContaining(row.code);
  const pickable = packsPickable(row.code);
  const chip =
    "rounded-full border border-hair bg-canvas px-2.5 py-0.5 font-mono text-label uppercase text-muted";

  return (
    <div className="grid gap-4 border-t border-hair bg-canvas/40 px-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <p className={lab}>In packs</p>
        {memberOf.length === 0 && pickable.length === 0 ? (
          <p className="mt-1.5 text-body-sm text-dim">
            {isFaPack ? "This is itself a pack of animations." : "Not part of any pack."}
          </p>
        ) : (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {memberOf.map((r) => (
              <span key={r.sku} className={`${chip} border-gold/40 text-gold`}>
                {r.name}
              </span>
            ))}
            {pickable.map((r) => (
              <span key={r.sku} className={chip} title="The buyer can pick this video at intake">
                Pickable: {r.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <div>
        <p className={lab}>Order bumps at checkout</p>
        {applicable.length === 0 ? (
          <p className="mt-1.5 text-body-sm text-dim">No bumps apply.</p>
        ) : (
          <ul className="mt-1.5 grid gap-1">
            {applicable.map((b) => (
              <li key={b.id} className="text-body-sm text-ink">
                {b.name}{" "}
                <span className="font-mono text-body-sm text-muted">
                  {money(bumpEffectivePrice(b, target))}
                  {b.unit === "per_video" ? " (per video)" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1.5 text-body-sm text-dim">
          Managed in Products &amp; Pricing, Order bumps tab.
        </p>
      </div>
      <div>
        <p className={lab}>Links</p>
        <ul className="mt-1.5 grid gap-1 text-body-sm">
          <li className="truncate text-muted">
            Buy: <span className="text-ink">/checkout/{row.code}</span>
          </li>
          {row.video_url ? (
            <li className="truncate">
              <a href={row.video_url} target="_blank" rel="noreferrer" className="text-gold hover:underline">
                Video file
              </a>
            </li>
          ) : (
            <li className="text-dim">No video file yet.</li>
          )}
          {row.poster_url ? (
            <li className="truncate">
              <a href={row.poster_url} target="_blank" rel="noreferrer" className="text-gold hover:underline">
                Poster image
              </a>
            </li>
          ) : null}
          {row.wistia_id ? <li className="text-muted">Wistia: {row.wistia_id}</li> : null}
          {row.release_date ? <li className="text-muted">Released: {row.release_date}</li> : null}
        </ul>
      </div>
    </div>
  );
}

function CatalogForm({
  row,
  onClose,
  onSaved,
}: {
  row: CatalogRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!row;
  const [v, setV] = useState({
    code: row?.code ?? "",
    title: row?.title ?? "",
    subject: row?.subject ?? "",
    category: row?.category ?? "Feature Explainer",
    library: row?.library ?? "new",
    price: row ? String(row.price_cents / 100) : "",
    video_url: row?.video_url ?? "",
    poster_url: row?.poster_url ?? "",
    wistia_id: row?.wistia_id ?? "",
    release_date: row?.release_date ?? "",
    featured: row?.featured ?? false,
    on_site: row?.on_site ?? true,
    coming_soon: row?.coming_soon ?? false,
    notes: row?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, val: unknown) => setV((x) => ({ ...x, [k]: val }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const payload = {
      code: v.code.trim().toLowerCase(),
      title: v.title.trim(),
      subject: v.subject.trim() || null,
      category: v.category,
      library: v.library,
      price_cents: Math.round(Number(v.price || 0) * 100),
      video_url: v.video_url.trim() || null,
      poster_url: v.poster_url.trim() || null,
      wistia_id: v.wistia_id.trim() || null,
      release_date: v.release_date || null,
      featured: v.featured,
      on_site: v.on_site,
      coming_soon: v.coming_soon,
      notes: v.notes.trim() || null,
    };
    const { error } = isEdit
      ? await supabase.from("catalog").update(payload).eq("id", row!.id)
      : await supabase.from("catalog").insert(payload);
    if (error) {
      setErr(error.code === "23505" ? "That code is already used." : error.message);
      setBusy(false);
      return;
    }
    onSaved();
  }

  return (
    <AdminModal open onClose={onClose} title={isEdit ? `Edit ${row!.code.toUpperCase()}` : "Add a video"}>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className={lab}>Title</span>
          <input required value={v.title} onChange={(e) => set("title", e.target.value)} className={field} />
        </label>
        <label>
          <span className={lab}>Code (sku)</span>
          <input required value={v.code} onChange={(e) => set("code", e.target.value)} className={field} placeholder="fexp-038" />
        </label>
        <label>
          <span className={lab}>Category</span>
          <select value={v.category} onChange={(e) => set("category", e.target.value)} className={field}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          <span className={lab}>Library</span>
          <select value={v.library} onChange={(e) => set("library", e.target.value)} className={field}>
            <option value="new">New</option>
            <option value="classic">Classic</option>
          </select>
        </label>
        <label>
          <span className={lab}>Price (USD)</span>
          <input type="number" min="0" value={v.price} onChange={(e) => set("price", e.target.value)} className={field} />
        </label>
        <label>
          <span className={lab}>Subject / capability</span>
          <input value={v.subject} onChange={(e) => set("subject", e.target.value)} className={field} placeholder="AI Receptionist" />
        </label>
        <label>
          <span className={lab}>Release date</span>
          <input type="date" value={v.release_date} onChange={(e) => set("release_date", e.target.value)} className={field} />
        </label>
        <label className="sm:col-span-2">
          <span className={lab}>Video link (mp4 preview)</span>
          <input value={v.video_url} onChange={(e) => set("video_url", e.target.value)} className={field} placeholder="https://..." />
        </label>
        <label>
          <span className={lab}>Poster URL</span>
          <input value={v.poster_url} onChange={(e) => set("poster_url", e.target.value)} className={field} placeholder="/posters/..." />
        </label>
        <label>
          <span className={lab}>Wistia ID (classic)</span>
          <input value={v.wistia_id} onChange={(e) => set("wistia_id", e.target.value)} className={field} />
        </label>
        <div className="flex flex-wrap gap-5 sm:col-span-2">
          <label className="flex items-center gap-2 text-body-sm text-ink">
            <input type="checkbox" checked={v.featured} onChange={(e) => set("featured", e.target.checked)} className="h-4 w-4 accent-[#FCC000]" />
            Featured
          </label>
          <label className="flex items-center gap-2 text-body-sm text-ink">
            <input type="checkbox" checked={v.on_site} onChange={(e) => set("on_site", e.target.checked)} className="h-4 w-4 accent-[#FCC000]" />
            On site
          </label>
          <label className="flex items-center gap-2 text-body-sm text-ink">
            <input type="checkbox" checked={v.coming_soon} onChange={(e) => set("coming_soon", e.target.checked)} className="h-4 w-4 accent-[#FCC000]" />
            Coming soon
          </label>
        </div>
        {err ? <p className="text-body-sm text-error sm:col-span-2">{err}</p> : null}
        <div className="flex items-center gap-3 border-t border-hair pt-4 sm:col-span-2">
          <button type="submit" disabled={busy} className="tap rounded-[8px] bg-brand-gradient px-6 py-2.5 text-body font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60">
            {busy ? "Saving..." : isEdit ? "Save changes" : "Add video"}
          </button>
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
        </div>
      </form>
    </AdminModal>
  );
}
