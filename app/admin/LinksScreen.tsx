"use client";

import { useCallback, useEffect, useState } from "react";
import { money, supabase } from "./client";

/*
 * Buy Links: ready-to-send checkout links for every product (with an optional
 * coupon appended), plus a "custom offer" generator for custom videos and
 * one-off deals. A custom offer is just an active one_time product row, so its
 * link runs through the normal checkout and lands in Orders / portal / HighLevel
 * like any sale. Links point at the canonical production domain so the sales
 * team can copy and send them straight from here.
 */
const SITE = "https://www.ghlvideo.com";

type Prod = {
  id: string;
  sku: string;
  name: string;
  price_cents: number;
  currency: string;
  type: "one_time" | "subscription";
  active: boolean;
  metadata: { code?: string; custom?: boolean; note?: string } | null;
};
type Coupon = {
  code: string;
  percent_off: number | null;
  amount_off_cents: number | null;
  active: boolean;
};

const fField =
  "mt-1.5 w-full rounded-[3px] border border-hair bg-canvas px-3 py-2.5 text-body text-ink focus:border-gold focus:outline-none";
const fLab = "font-mono text-label uppercase text-dim";

function CopyField({ url, disabled }: { url: string; disabled?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full min-w-0 rounded-[3px] border border-hair bg-canvas px-3 py-2 font-mono text-body-sm text-muted focus:border-gold/60 focus:outline-none"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setDone(true);
            window.setTimeout(() => setDone(false), 1500);
          } catch {
            /* clipboard blocked; the field is selectable as a fallback */
          }
        }}
        className="tap shrink-0 rounded-[3px] border border-hair px-3.5 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-50"
      >
        {done ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function couponLabel(c: Coupon): string {
  const off = c.percent_off ? `${c.percent_off}% off` : `$${((c.amount_off_cents ?? 0) / 100).toFixed(0)} off`;
  return `${c.code} — ${off}`;
}

export function LinksScreen() {
  const [products, setProducts] = useState<Prod[] | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [coupon, setCoupon] = useState("");

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const [prods, coups] = await Promise.all([
      supabase
        .from("products")
        .select("id,sku,name,price_cents,currency,type,active,metadata")
        .order("price_cents", { ascending: true }),
      supabase
        .from("coupons")
        .select("code,percent_off,amount_off_cents,active")
        .eq("active", true)
        .order("code", { ascending: true }),
    ]);
    setProducts((prods.data as Prod[]) ?? []);
    setCoupons((coups.data as Coupon[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const catalog = (products ?? []).filter((p) => p.active && !p.metadata?.custom);
  const customs = (products ?? [])
    .filter((p) => p.metadata?.custom)
    .sort((a, b) => Number(b.active) - Number(a.active));

  const linkFor = (p: Prod) =>
    `${SITE}/checkout/${p.sku}/${coupon && p.type === "one_time" ? `?code=${encodeURIComponent(coupon)}` : ""}`;

  async function createCustom(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const dollars = Number(amount);
    if (!title.trim()) return setErr("Add a title for the offer.");
    if (!Number.isFinite(dollars) || dollars <= 0) return setErr("Enter a valid amount.");
    const cents = Math.round(dollars * 100);
    if (cents < 50) return setErr("Amount must be at least $0.50.");
    setBusy(true);
    setErr("");
    const sku = `custom-${Math.random().toString(36).slice(2, 8)}`;
    const { error } = await supabase.from("products").insert({
      sku,
      name: title.trim(),
      price_cents: cents,
      currency: "usd",
      type: "one_time",
      active: true,
      metadata: { custom: true, code: "CUSTOM", note: note.trim() || null },
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setTitle("");
    setAmount("");
    setNote("");
    load();
  }

  async function setActive(p: Prod, active: boolean) {
    await supabase.from("products").update({ active }).eq("id", p.id);
    load();
  }

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-h3 text-ink">Links &amp; Invoices</h1>
      <p className="mt-2 text-body text-muted">
        Ready-to-send checkout links for every product, plus custom invoices for custom videos and
        one-off deals.
      </p>

      {/* coupon append */}
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-card border border-hair bg-surface px-5 py-4">
        <label className="flex items-center gap-3">
          <span className={fLab}>Append coupon</span>
          <select
            value={coupon}
            onChange={(e) => setCoupon(e.target.value)}
            className="rounded-[3px] border border-hair bg-canvas px-3 py-2 text-body text-ink focus:border-gold focus:outline-none"
          >
            <option value="">None</option>
            {coupons.map((c) => (
              <option key={c.code} value={c.code}>
                {couponLabel(c)}
              </option>
            ))}
          </select>
        </label>
        <span className="text-body-sm text-dim">
          {coupon
            ? `Product links below carry ?code=${coupon}. Applies to one-time products.`
            : "Pick a code to add it to every one-time product link below."}
        </span>
      </div>

      {/* product links */}
      <p className="mt-8 font-mono text-label uppercase text-dim">Product links</p>
      {products === null ? (
        <p className="mt-3 text-body-sm text-muted">Loading...</p>
      ) : catalog.length === 0 ? (
        <p className="mt-3 text-body-sm text-dim">
          No products yet. Add them in Products, then run Sync from catalog.
        </p>
      ) : (
        <ul className="mt-3 grid gap-3">
          {catalog.map((p) => (
            <li key={p.id} className="rounded-card border border-hair bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="font-semibold text-ink">
                  {p.metadata?.code ? (
                    <span className="mr-2 font-mono text-label uppercase text-gold/80">
                      {p.metadata.code}
                    </span>
                  ) : null}
                  {p.name}
                  {p.type === "subscription" ? (
                    <span className="ml-2 font-mono text-label uppercase text-dim">subscription</span>
                  ) : null}
                </p>
                <p className="font-mono text-body-sm font-bold text-ink [font-variant-numeric:tabular-nums]">
                  {money(p.price_cents, p.currency)}
                </p>
              </div>
              <div className="mt-3">
                <CopyField url={linkFor(p)} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* custom offer generator */}
      <p className="mt-10 font-mono text-label uppercase text-dim">Custom offer / invoice</p>
      <p className="mt-2 text-body-sm text-muted">
        For custom videos and one-off deals. This creates a checkout link at your chosen price; the
        client pays through the normal checkout and it shows up in Orders and the portal.
      </p>

      <form onSubmit={createCustom} className="mt-4 rounded-card border border-gold/30 bg-gold/[0.04] p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={fLab}>Offer title (shown at checkout)</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Custom explainer video for Acme"
              className={fField}
            />
          </label>
          <label>
            <span className={fLab}>Amount (USD)</span>
            <input
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1500"
              className={fField}
            />
          </label>
          <label>
            <span className={fLab}>Internal note (optional)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Who / what this is for"
              className={fField}
            />
          </label>
        </div>
        {err ? <p className="mt-3 text-body-sm text-error">{err}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="tap mt-4 rounded-[3px] bg-brand-gradient px-6 py-2.5 text-body-sm font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Creating..." : "Create custom link"}
        </button>
      </form>

      {customs.length > 0 ? (
        <ul className="mt-4 grid gap-3">
          {customs.map((p) => (
            <li
              key={p.id}
              className={`rounded-card border border-hair bg-surface p-4 ${p.active ? "" : "opacity-60"}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="font-semibold text-ink">
                  {p.name}
                  {p.metadata?.note ? (
                    <span className="ml-2 text-body-sm text-dim">({p.metadata.note})</span>
                  ) : null}
                  {!p.active ? (
                    <span className="ml-2 font-mono text-label uppercase text-dim">inactive</span>
                  ) : null}
                </p>
                <p className="font-mono text-body-sm font-bold text-ink [font-variant-numeric:tabular-nums]">
                  {money(p.price_cents, p.currency)}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <CopyField url={`${SITE}/checkout/${p.sku}/`} disabled={!p.active} />
                </div>
                <button
                  type="button"
                  onClick={() => setActive(p, !p.active)}
                  className="tap shrink-0 rounded-[3px] border border-hair px-3.5 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
                >
                  {p.active ? "Deactivate" : "Reactivate"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
