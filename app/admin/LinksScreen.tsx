"use client";

import { useCallback, useEffect, useState } from "react";
import { money, supabase } from "./client";

/*
 * Buy Links: ready-to-send checkout links for every product, with an optional
 * coupon appended to one-time links, so the sales team can copy and send them.
 * Custom-priced deals are handled by the Invoices screen. Links point at the
 * canonical production domain.
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
  metadata: { code?: string; custom?: boolean; invoice?: boolean } | null;
};
type Coupon = {
  code: string;
  percent_off: number | null;
  amount_off_cents: number | null;
  active: boolean;
};

const fLab = "font-mono text-label uppercase text-dim";

function CopyField({ url }: { url: string }) {
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
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setDone(true);
            window.setTimeout(() => setDone(false), 1500);
          } catch {
            /* selectable fallback */
          }
        }}
        className="tap shrink-0 rounded-[3px] border border-hair px-3.5 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
      >
        {done ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function couponLabel(c: Coupon): string {
  const off = c.percent_off
    ? `${c.percent_off}% off`
    : `$${((c.amount_off_cents ?? 0) / 100).toFixed(0)} off`;
  return `${c.code} — ${off}`;
}

export function LinksScreen() {
  const [products, setProducts] = useState<Prod[] | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [coupon, setCoupon] = useState("");

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

  const catalog = (products ?? []).filter(
    (p) => p.active && !p.metadata?.custom && !p.metadata?.invoice,
  );

  const linkFor = (p: Prod) =>
    `${SITE}/checkout/${p.sku}/${coupon && p.type === "one_time" ? `?code=${encodeURIComponent(coupon)}` : ""}`;

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-h3 text-ink">Buy Links</h1>
      <p className="mt-2 text-body text-muted">
        Ready-to-send checkout links for every product. For custom-priced deals, use Invoices.
      </p>

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
    </div>
  );
}
