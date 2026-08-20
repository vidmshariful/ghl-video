"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input, Select } from "@/components/portal/ui";
import { supabase, money } from "./client";
import { CatalogScreen } from "./CatalogScreen";
import { BumpsScreen } from "./BumpsScreen";
import { LibraryFiltersTab } from "./LibraryFiltersTab";
import { ProductsScreen } from "./ProductsScreen";

/*
 * Everything sellable, in one place.
 *
 * Before this there were two screens holding the same thing: a video list and
 * a product list, same sku, same price, entered twice, with the buy link
 * stranded in a third place. One catalog now holds all three shapes and this
 * screen is the only door to it.
 *
 *   Videos    sold on their own, or inside a pack
 *   Packs     fixed contents we choose, e.g. the AI First SaaS Pack
 *   Bundles   a count per category; the customer picks the actual videos
 *             on the intake form after checkout
 */

type Tab = "videos" | "packs" | "bundles" | "bumps" | "charges" | "filters";

type Row = {
  id: string;
  code: string;
  title: string;
  kind: string;
  price_cents: number;
  anchor_price_cents: number | null;
  delivery_days: number | null;
  tagline: string | null;
  on_site: boolean;
  pack_count: number | null;
};

type PackItem = { id: string; pack_code: string; item_code: string; group_label: string | null; sort: number };
type BundleRule = {
  id: string;
  bundle_code: string;
  label: string;
  category: string | null;
  library: string | null;
  count: number;
  sort: number;
};


export function ProductsHub() {
  const [tab, setTab] = useState<Tab>("videos");

  return (
    <div className="w-full">
      <h1 className="font-display text-h3 text-ink">Products &amp; Packs</h1>
      <p className="mt-0.5 max-w-[var(--measure-body)] text-body-sm text-muted">
        Everything we sell, in one list. A video is sold on its own or inside a
        pack. A pack has contents we choose. A bundle sells a count per
        category and the customer picks the videos at intake.
      </p>

      {/* five tabs do not fit a phone, so the bar scrolls on its own rather
          than letting the page scroll sideways */}
      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-hair [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(
          [
            ["videos", "Videos"],
            ["packs", "Packs"],
            ["bundles", "Bundles"],
            ["bumps", "Order bumps"],
            ["charges", "Checkout prices"],
            ["filters", "Library filters"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`tap shrink-0 whitespace-nowrap rounded-t-[8px] px-4 py-2.5 text-body-sm transition-colors ${
              tab === k
                ? "border border-b-0 border-hair bg-surface font-semibold text-gold"
                : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "videos" ? (
          <CatalogScreen kind="video" embedded />
        ) : tab === "packs" ? (
          <CompositionTab kind="pack" />
        ) : tab === "bundles" ? (
          <CompositionTab kind="bundle" />
        ) : tab === "bumps" ? (
          <BumpsScreen embedded />
        ) : tab === "filters" ? (
          <LibraryFiltersTab />
        ) : (
          <ProductsScreen />
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Packs and bundles share a shell: a list, then what is inside      */
/* ---------------------------------------------------------------- */

function CompositionTab({ kind }: { kind: "pack" | "bundle" }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [videos, setVideos] = useState<Row[]>([]);
  const [items, setItems] = useState<PackItem[]>([]);
  const [rules, setRules] = useState<BundleRule[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setErr("");
    const [a, b, c, d] = await Promise.all([
      supabase.from("catalog").select("*").eq("kind", kind).order("code"),
      supabase.from("catalog").select("*").eq("kind", "video").order("category").order("code"),
      supabase.from("catalog_pack_items").select("*").order("sort"),
      supabase.from("catalog_bundle_rules").select("*").order("sort"),
    ]);
    if (a.error) setErr(a.error.message);
    setRows((a.data as Row[]) ?? []);
    setVideos((b.data as Row[]) ?? []);
    setItems((c.data as PackItem[]) ?? []);
    setRules((d.data as BundleRule[]) ?? []);
  }, [kind]);

  useEffect(() => {
    load();
  }, [load]);

  if (err) return <p className="text-body-sm text-error">{err}</p>;
  if (!rows) return <p className="text-body text-muted">Loading...</p>;

  return (
    <div>
      <p className="max-w-[var(--measure-body)] text-body-sm text-muted">
        {kind === "pack"
          ? "A pack ships the same videos to every buyer. Choose them here; the count on the offer must match what is listed."
          : "A bundle sells a number of videos per category. The customer chooses the actual titles on the intake form, so set the counts here, not the titles."}
      </p>

      <ul className="mt-6 overflow-hidden rounded-[12px] border border-hair">
        {rows.length === 0 ? (
          <li className="p-6 text-body-sm text-muted">Nothing here yet.</li>
        ) : (
          rows.map((r) => {
            const mine = items.filter((i) => i.pack_code === r.code);
            const myRules = rules.filter((x) => x.bundle_code === r.code);
            const total =
              kind === "pack" ? mine.length : myRules.reduce((n, x) => n + x.count, 0);
            /* A pack with no itemised members but a stated count is the feature
               animation case: we sell "7 animations" as a set and never listed
               them one by one. That is a normal shape, not a fault, so it must
               not read as a red zero. */
            const countedOnly = kind === "pack" && total === 0 && (r.pack_count ?? 0) > 0;
            return (
              <li key={r.id} className="border-t border-hair bg-surface/40 first:border-t-0">
                <button
                  type="button"
                  onClick={() => setOpen(open === r.code ? null : r.code)}
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 p-4 text-left"
                >
                  <span className="w-28 shrink-0 font-mono text-label uppercase tracking-[0.08em] text-gold/80">
                    {r.code.toUpperCase()}
                  </span>
                  <div className="min-w-[12rem] flex-1">
                    <p className="font-semibold text-ink">{r.title}</p>
                    <p className="font-mono text-label uppercase text-dim">
                      {money(r.price_cents, "usd")}
                      {r.delivery_days ? ` / ${r.delivery_days} day delivery` : ""}
                      {r.on_site ? "" : " / hidden"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${
                      countedOnly
                        ? "border-hair text-muted"
                        : total > 0
                          ? "border-gold/40 bg-gold/10 text-gold"
                          : "border-error/40 text-error"
                    }`}
                  >
                    {countedOnly
                      ? `${r.pack_count} as a set`
                      : `${total} ${kind === "pack" ? "videos" : "picks"}`}
                  </span>
                </button>
                {open === r.code ? (
                  kind === "pack" ? (
                    <PackEditor pack={r} items={mine} videos={videos} onChanged={load} />
                  ) : (
                    <BundleEditor bundle={r} rules={myRules} onChanged={load} />
                  )
                ) : null}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Pack: pick the exact videos                                       */
/* ---------------------------------------------------------------- */

function PackEditor({
  pack,
  items,
  videos,
  onChanged,
}: {
  pack: Row;
  items: PackItem[];
  videos: Row[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [query, setQuery] = useState("");
  const inPack = useMemo(() => new Set(items.map((i) => i.item_code)), [items]);

  const shown = videos.filter(
    (v) =>
      !inPack.has(v.code) &&
      (query.trim() === "" ||
        v.title.toLowerCase().includes(query.toLowerCase()) ||
        v.code.includes(query.toLowerCase())),
  );

  async function add(code: string) {
    setBusy(true);
    setErr("");
    const { error } = await supabase.from("catalog_pack_items").insert({
      pack_code: pack.code,
      item_code: code,
      sort: items.length,
    });
    if (error) setErr(error.message);
    else await onChanged();
    setBusy(false);
  }

  async function drop(id: string) {
    setBusy(true);
    setErr("");
    const { error } = await supabase.from("catalog_pack_items").delete().eq("id", id);
    if (error) setErr(error.message);
    else await onChanged();
    setBusy(false);
  }

  const byCode = new Map(videos.map((v) => [v.code, v]));

  return (
    <div className="grid gap-5 border-t border-hair bg-canvas/40 p-5 lg:grid-cols-2">
      <div>
        <p className="font-mono text-label uppercase tracking-[0.08em] text-muted">Inside this pack ({items.length})</p>
        {items.length === 0 ? (
          (pack.pack_count ?? 0) > 0 ? (
            <p className="mt-2 max-w-[var(--measure-body)] text-body-sm text-muted">
              This pack is sold as a set of {pack.pack_count} and its contents were
              never listed one by one. That is fine. Add the individual videos
              here if you ever want them tracked separately in a client&apos;s portal.
            </p>
          ) : (
            <p className="mt-2 text-body-sm text-error">
              Nothing listed. The offer promises videos, so buyers would receive an empty pack.
            </p>
          )
        ) : (
          <ul className="mt-2 grid gap-1.5">
            {items.map((i) => {
              const v = byCode.get(i.item_code);
              return (
                <li
                  key={i.id}
                  className="flex items-center gap-3 rounded-[8px] border border-hair bg-surface px-3 py-2"
                >
                  <span className="w-20 shrink-0 font-mono text-label uppercase text-gold/80">
                    {i.item_code.toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-body-sm text-ink">
                    {v?.title ?? "(not in the catalog)"}
                  </span>
                  {i.group_label ? (
                    <span className="font-mono text-label uppercase text-dim">{i.group_label}</span>
                  ) : null}
                  <Button variant="secondary" disabled={busy} onClick={() => drop(i.id)}>
                    Remove
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        {err ? <p className="mt-3 text-body-sm text-error">{err}</p> : null}
      </div>

      <div>
        <p className="font-mono text-label uppercase tracking-[0.08em] text-muted">Add a video</p>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or code"
        />
        <ul className="mt-2 max-h-80 overflow-y-auto rounded-[8px] border border-hair">
          {shown.slice(0, 40).map((v) => (
            <li
              key={v.id}
              className="flex items-center gap-3 border-t border-hair bg-surface px-3 py-2 first:border-t-0"
            >
              <span className="w-20 shrink-0 font-mono text-label uppercase text-dim">
                {v.code.toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-body-sm text-muted">{v.title}</span>
              <Button variant="secondary" disabled={busy} onClick={() => add(v.code)}>
                Add
              </Button>
            </li>
          ))}
          {shown.length === 0 ? (
            <li className="px-3 py-4 text-body-sm text-dim">Nothing left to add.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Bundle: set how many of each category the customer may pick       */
/* ---------------------------------------------------------------- */

const CATEGORIES = [
  "Full Explainer",
  "Feature Explainer",
  "Demo",
  "Marketing",
  "Feature Animation",
  "Explainer",
  "Short Explainer",
];

function BundleEditor({
  bundle,
  rules,
  onChanged,
}: {
  bundle: Row;
  rules: BundleRule[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [count, setCount] = useState("1");
  const [library, setLibrary] = useState("any");

  const total = rules.reduce((n, r) => n + r.count, 0);

  async function add() {
    setBusy(true);
    setErr("");
    const n = Math.max(1, Number(count) || 1);
    const { error } = await supabase.from("catalog_bundle_rules").insert({
      bundle_code: bundle.code,
      label: label.trim() || `${n}x ${category}`,
      category,
      library,
      count: n,
      sort: rules.length,
    });
    if (error) setErr(error.message);
    else {
      setLabel("");
      setCount("1");
      await onChanged();
    }
    setBusy(false);
  }

  async function drop(id: string) {
    setBusy(true);
    const { error } = await supabase.from("catalog_bundle_rules").delete().eq("id", id);
    if (error) setErr(error.message);
    else await onChanged();
    setBusy(false);
  }

  return (
    <div className="grid gap-5 border-t border-hair bg-canvas/40 p-5 lg:grid-cols-2">
      <div>
        <p className="font-mono text-label uppercase tracking-[0.08em] text-muted">What the customer picks ({total} videos in total)</p>
        {rules.length === 0 ? (
          <p className="mt-2 text-body-sm text-error">
            No picks set. A buyer would reach the intake form with nothing to choose.
          </p>
        ) : (
          <ul className="mt-2 grid gap-1.5">
            {rules.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-[8px] border border-hair bg-surface px-3 py-2"
              >
                <span className="w-10 shrink-0 text-center font-mono text-body-sm text-gold">
                  {r.count}
                </span>
                <span className="min-w-0 flex-1 truncate text-body-sm text-ink">{r.label}</span>
                {r.library && r.library !== "any" ? (
                  <span className="font-mono text-label uppercase text-dim">{r.library}</span>
                ) : null}
                <Button variant="secondary" disabled={busy} onClick={() => drop(r.id)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
        {err ? <p className="mt-3 text-body-sm text-error">{err}</p> : null}
      </div>

      <div>
        <p className="font-mono text-label uppercase tracking-[0.08em] text-muted">Add a pick rule</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label>
            <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">How many</span>
            <Input
              type="number"
              min="1"
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          </label>
          <label>
            <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">From which category</span>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Library</span>
            <Select value={library} onChange={(e) => setLibrary(e.target.value)}>
              <option value="any">Any</option>
              <option value="new">New</option>
              <option value="classic">Classic</option>
            </Select>
          </label>
          <label>
            <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Label on the offer</span>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={`${count}x ${category}`}
            />
          </label>
        </div>
        <Button variant="brand" onClick={add} disabled={busy} className="mt-4">
          Add rule
        </Button>
      </div>
    </div>
  );
}
