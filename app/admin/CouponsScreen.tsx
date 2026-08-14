"use client";

import { useEffect, useState } from "react";
import { supabase } from "./client";

/*
 * Coupon management. A coupon is percent off OR a flat dollar amount
 * off (one or the other), optionally limited to one SKU, with an
 * optional end date and redemption cap. The Active switch is the kill
 * switch: flipping it off stops a code instantly, campaign pages
 * unchanged. Redemption counts come from paid orders.
 */
type CouponRow = {
  id: string;
  code: string;
  percent_off: number | null;
  amount_off_cents: number | null;
  sku: string | null;
  valid_from: string | null;
  valid_until: string | null;
  max_redemptions: number | null;
  redemption_count: number;
  active: boolean;
  sub_eligible: boolean;
  sub_duration: "once" | "forever" | "repeating" | null;
  sub_duration_months: number | null;
};

const field =
  "mt-1.5 w-full rounded-[3px] border border-hair bg-canvas px-3 py-2.5 text-body text-ink focus:border-gold focus:outline-none";
const lab = "font-mono text-label uppercase text-muted";

const discountLabel = (c: CouponRow) =>
  c.percent_off != null
    ? `${c.percent_off}% off`
    : `$${((c.amount_off_cents ?? 0) / 100).toLocaleString("en-US")} off`;

/* timestamptz <-> the datetime-local input, in the admin's local time */
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

function CouponForm({
  initial,
  onDone,
  onCancel,
}: {
  initial: Partial<CouponRow>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const isNew = !initial.id;
  const [f, setF] = useState({
    code: initial.code ?? "",
    kind: initial.amount_off_cents != null ? "amount" : "percent",
    percent: initial.percent_off != null ? String(initial.percent_off) : "",
    amount:
      initial.amount_off_cents != null
        ? String(initial.amount_off_cents / 100)
        : "",
    sku: initial.sku ?? "",
    until: toLocalInput(initial.valid_until ?? null),
    max: initial.max_redemptions != null ? String(initial.max_redemptions) : "",
    active: initial.active ?? true,
    subEligible: initial.sub_eligible ?? false,
    subDuration: initial.sub_duration ?? "forever",
    subMonths: initial.sub_duration_months != null ? String(initial.sub_duration_months) : "3",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const code = f.code.trim().toUpperCase();
    if (code.length < 3) {
      setErr("The code needs at least 3 characters.");
      return;
    }
    const percent = f.kind === "percent" ? Math.round(Number(f.percent)) : null;
    const amountCents =
      f.kind === "amount" ? Math.round(Number(f.amount) * 100) : null;
    if (f.kind === "percent" && (!percent || percent < 1 || percent > 90)) {
      setErr("Percent must be between 1 and 90.");
      return;
    }
    if (f.kind === "amount" && (!amountCents || amountCents <= 0)) {
      setErr("The dollar amount must be above zero.");
      return;
    }
    setBusy(true);
    setErr("");
    const payload = {
      code,
      percent_off: percent,
      amount_off_cents: amountCents,
      sku: f.sku.trim().toLowerCase() || null,
      valid_until: fromLocalInput(f.until),
      max_redemptions: f.max ? Math.max(1, Math.round(Number(f.max))) : null,
      active: f.active,
      sub_eligible: f.subEligible,
      sub_duration: f.subEligible ? f.subDuration : null,
      sub_duration_months:
        f.subEligible && f.subDuration === "repeating"
          ? Math.max(1, Math.round(Number(f.subMonths) || 1))
          : null,
    };
    const q = supabase.from("coupons");
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
        {isNew ? "Add a coupon" : `Edit ${initial.code}`}
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label>
          <span className={lab}>Code (what the buyer types)</span>
          <input
            required
            value={f.code}
            onChange={(e) => set("code", e.target.value.toUpperCase())}
            className={`${field} font-mono uppercase`}
            placeholder="AIFIRST30"
            maxLength={32}
          />
        </label>
        <label>
          <span className={lab}>Discount type</span>
          <select
            value={f.kind}
            onChange={(e) => set("kind", e.target.value)}
            className={field}
          >
            <option value="percent">Percent off</option>
            <option value="amount">Dollar amount off</option>
          </select>
        </label>
        {f.kind === "percent" ? (
          <label>
            <span className={lab}>Percent off (1 to 90)</span>
            <input
              type="number"
              min={1}
              max={90}
              value={f.percent}
              onChange={(e) => set("percent", e.target.value)}
              className={field}
              placeholder="30"
            />
          </label>
        ) : (
          <label>
            <span className={lab}>Dollars off</span>
            <input
              type="number"
              min={1}
              step="0.01"
              value={f.amount}
              onChange={(e) => set("amount", e.target.value)}
              className={field}
              placeholder="600"
            />
          </label>
        )}
        <label>
          <span className={lab}>Limit to one SKU (blank = any product)</span>
          <input
            value={f.sku}
            onChange={(e) => set("sku", e.target.value)}
            className={`${field} font-mono lowercase`}
            placeholder="pack-001"
          />
        </label>
        <label>
          <span className={lab}>Valid until (blank = no end date)</span>
          <input
            type="datetime-local"
            value={f.until}
            onChange={(e) => set("until", e.target.value)}
            className={field}
          />
        </label>
        <label>
          <span className={lab}>Max redemptions (blank = unlimited)</span>
          <input
            type="number"
            min={1}
            value={f.max}
            onChange={(e) => set("max", e.target.value)}
            className={field}
          />
        </label>
        <div className="rounded-[3px] border border-hair p-4 sm:col-span-2">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={f.subEligible}
              onChange={(e) => set("subEligible", e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-body text-ink">Also works on editing plans (subscriptions)</span>
          </label>
          {f.subEligible && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label>
                <span className={lab}>On a subscription, the discount lasts</span>
                <select
                  value={f.subDuration}
                  onChange={(e) => set("subDuration", e.target.value)}
                  className={field}
                >
                  <option value="forever">Every month (as long as subscribed)</option>
                  <option value="once">First payment only</option>
                  <option value="repeating">First N months</option>
                </select>
              </label>
              {f.subDuration === "repeating" && (
                <label>
                  <span className={lab}>Number of months</span>
                  <input
                    type="number"
                    min={1}
                    value={f.subMonths}
                    onChange={(e) => set("subMonths", e.target.value)}
                    className={field}
                    placeholder="3"
                  />
                </label>
              )}
            </div>
          )}
        </div>
        <label className="flex items-center gap-3 sm:col-span-2">
          <input
            type="checkbox"
            checked={f.active}
            onChange={(e) => set("active", e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-body text-ink">Active</span>
        </label>
      </div>
      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}
      <div className="mt-6 flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="tap rounded-[3px] bg-brand-gradient px-6 py-2.5 text-body font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Saving" : "Save coupon"}
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

export function CouponsScreen() {
  const [rows, setRows] = useState<CouponRow[]>([]);
  const [editing, setEditing] = useState<CouponRow | "new" | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setErr(error.message);
    else setRows(data as CouponRow[]);
    setLoaded(true);
  }
  useEffect(() => {
    load();
  }, []);

  async function toggleActive(c: CouponRow) {
    const { error } = await supabase
      .from("coupons")
      .update({ active: !c.active })
      .eq("id", c.id);
    if (error) setErr(error.message);
    else load();
  }

  async function remove(c: CouponRow) {
    if (!confirm(`Delete coupon ${c.code}? Past orders keep their record of it.`)) return;
    const { error } = await supabase.from("coupons").delete().eq("id", c.id);
    if (error) setErr(error.message);
    else load();
  }

  if (!loaded) return <p className="text-body text-muted">Loading coupons...</p>;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h3 text-ink">Coupons</h1>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="tap rounded-[3px] bg-brand-gradient px-5 py-2.5 text-body font-semibold text-canvas transition-all hover:brightness-110"
        >
          Add coupon
        </button>
      </div>
      <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
        Codes buyers can enter at checkout, or that campaign links apply
        automatically. Turning Active off stops a code instantly. The
        discount always applies to the product price, never to order bumps.
      </p>
      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}

      {editing && (
        <div className="mt-6">
          <CouponForm
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
        {rows.length === 0 && (
          <li className="bg-canvas px-5 py-6 text-body text-muted">
            No coupons yet. Add the first one.
          </li>
        )}
        {rows.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-3 border-t border-hair bg-canvas px-5 py-4 first:border-t-0"
          >
            <div className="min-w-0">
              <p className="font-mono text-body font-semibold uppercase tracking-[0.06em] text-ink">
                {c.code}
                {!c.active && (
                  <span className="ml-2 font-mono text-label uppercase text-error">[off]</span>
                )}
              </p>
              <p className="mt-0.5 font-mono text-label uppercase text-muted">
                {discountLabel(c)}
                {c.sku ? ` / ${c.sku}` : " / any product"}
                {c.valid_until ? ` / until ${c.valid_until.slice(0, 10)}` : ""}
                {" / used "}
                {c.redemption_count}
                {c.max_redemptions != null ? ` of ${c.max_redemptions}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => toggleActive(c)}
                className={`tap rounded-[3px] border px-4 py-2 text-body-sm transition-colors ${
                  c.active
                    ? "border-hair text-ink hover:border-gold/60"
                    : "border-gold/50 bg-gold/10 text-gold hover:bg-gold/20"
                }`}
              >
                {c.active ? "Turn off" : "Turn on"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(c)}
                className="tap rounded-[3px] border border-hair px-4 py-2 text-body-sm text-ink transition-colors hover:border-gold/60"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => remove(c)}
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
