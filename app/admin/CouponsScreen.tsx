"use client";

import { useEffect, useState } from "react";
import { Button, Input, Select } from "@/components/portal/ui";
import { supabase } from "./client";
import { AdminModal } from "./Modal";

/*
 * Coupon management, in two tabs:
 *
 *   Store coupons    - campaign codes (percent or dollar off), as before.
 *   Partner coupons  - one code per affiliate partner, the ONE discount rail
 *                      of the partner program. Their landing-page buy buttons
 *                      carry ?code=<code> (auto-applied at checkout); anyone
 *                      else types it. Creating one here also stamps the code
 *                      onto the partner row, so their portal shows it.
 *
 * The Active switch is the kill switch either way: flipping it off stops a
 * code instantly. Redemption counts come from paid orders.
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
  partner_id: string | null;
};

type PartnerLite = {
  id: string;
  ref: string;
  name: string;
  status: string;
  coupon_code: string | null;
};


const discountLabel = (c: CouponRow) =>
  c.percent_off != null
    ? `${c.percent_off}% off`
    : `$${((c.amount_off_cents ?? 0) / 100).toLocaleString("en-US")} off`;

/* the program-standard code for a partner: their ref, upper, plus the percent */
const suggestCode = (ref: string, percent: number) =>
  `${ref.toUpperCase().replace(/[^A-Z0-9]/g, "")}${percent}`.slice(0, 32);

/* timestamptz <-> the datetime-local input, in the admin's local time */
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

/* keep the partner row's displayed code in sync with its coupon */
async function syncPartnerCode(partnerId: string | null, code: string | null) {
  if (!partnerId) return;
  await supabase.from("partners").update({ coupon_code: code }).eq("id", partnerId);
}

function CouponForm({
  initial,
  partners,
  onDone,
  onCancel,
}: {
  initial: Partial<CouponRow>;
  partners: PartnerLite[];
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
    partnerId: initial.partner_id ?? "",
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
      partner_id: f.partnerId || null,
    };
    const q = supabase.from("coupons");
    const { error } = isNew
      ? await q.insert(payload)
      : await q.update(payload).eq("id", initial.id!);
    if (error) {
      setErr(error.code === "23505" ? "That code already exists." : error.message);
      setBusy(false);
      return;
    }
    // partner display sync: the new owner shows this code; a previous owner
    // (when reassigning) loses it
    await syncPartnerCode(payload.partner_id, code);
    if (initial.partner_id && initial.partner_id !== payload.partner_id) {
      await syncPartnerCode(initial.partner_id, null);
    }
    onDone();
  }

  return (
    <form onSubmit={save}>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label>
          <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Code (what the buyer types)</span>
          <Input
            required
            value={f.code}
            onChange={(e) => set("code", e.target.value.toUpperCase())} className="font-mono uppercase"
            placeholder="AIFIRST30"
            maxLength={32}
          />
        </label>
        <label>
          <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Belongs to a partner? (optional)</span>
          <Select
            value={f.partnerId}
            onChange={(e) => set("partnerId", e.target.value)}
          >
            <option value="">No, a store coupon</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (?ref={p.ref})
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Discount type</span>
          <Select
            value={f.kind}
            onChange={(e) => set("kind", e.target.value)}
          >
            <option value="percent">Percent off</option>
            <option value="amount">Dollar amount off</option>
          </Select>
        </label>
        {f.kind === "percent" ? (
          <label>
            <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Percent off (1 to 90)</span>
            <Input
              type="number"
              min={1}
              max={90}
              value={f.percent}
              onChange={(e) => set("percent", e.target.value)}
              placeholder="30"
            />
          </label>
        ) : (
          <label>
            <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Dollars off</span>
            <Input
              type="number"
              min={1}
              step="0.01"
              value={f.amount}
              onChange={(e) => set("amount", e.target.value)}
              placeholder="600"
            />
          </label>
        )}
        <label>
          <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Limit to one SKU (blank = any product)</span>
          <Input
            value={f.sku}
            onChange={(e) => set("sku", e.target.value)} className="font-mono lowercase"
            placeholder="pack-001"
          />
        </label>
        <label>
          <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Valid until (blank = no end date)</span>
          <Input
            type="datetime-local"
            value={f.until}
            onChange={(e) => set("until", e.target.value)}
          />
        </label>
        <label>
          <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Max redemptions (blank = unlimited)</span>
          <Input
            type="number"
            min={1}
            value={f.max}
            onChange={(e) => set("max", e.target.value)}
          />
        </label>
        <div className="rounded-[8px] border border-hair p-4 sm:col-span-2">
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
                <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">On a subscription, the discount lasts</span>
                <Select
                  value={f.subDuration}
                  onChange={(e) => set("subDuration", e.target.value)}
                >
                  <option value="forever">Every month (as long as subscribed)</option>
                  <option value="once">First payment only</option>
                  <option value="repeating">First N months</option>
                </Select>
              </label>
              {f.subDuration === "repeating" && (
                <label>
                  <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Number of months</span>
                  <Input
                    type="number"
                    min={1}
                    value={f.subMonths}
                    onChange={(e) => set("subMonths", e.target.value)}
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
        <Button variant="brand" type="submit" disabled={busy}>
          {busy ? "Saving" : "Save coupon"}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* one-click generator: partner -> their program-standard coupon */
function PartnerCouponGenerator({
  partners,
  onDone,
  onCancel,
}: {
  partners: PartnerLite[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const withoutCode = partners.filter((p) => !p.coupon_code);
  const [partnerId, setPartnerId] = useState(withoutCode[0]?.id ?? partners[0]?.id ?? "");
  const [percent, setPercent] = useState("10");
  const [months, setMonths] = useState("3");
  const [code, setCode] = useState(() => {
    const p = withoutCode[0] ?? partners[0];
    return p ? suggestCode(p.ref, 10) : "";
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const pickPartner = (id: string) => {
    setPartnerId(id);
    const p = partners.find((x) => x.id === id);
    if (p) setCode(suggestCode(p.ref, Math.round(Number(percent)) || 10));
  };
  const pickPercent = (v: string) => {
    setPercent(v);
    const p = partners.find((x) => x.id === partnerId);
    if (p) setCode(suggestCode(p.ref, Math.round(Number(v)) || 10));
  };

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const pct = Math.round(Number(percent));
    const mo = Math.max(1, Math.round(Number(months) || 3));
    const cleanCode = code.trim().toUpperCase();
    if (!partnerId) return setErr("Pick a partner.");
    if (!pct || pct < 1 || pct > 90) return setErr("Percent must be between 1 and 90.");
    if (cleanCode.length < 3) return setErr("The code needs at least 3 characters.");
    setBusy(true);
    setErr("");
    const { error } = await supabase.from("coupons").insert({
      code: cleanCode,
      percent_off: pct,
      amount_off_cents: null,
      sku: null,
      active: true,
      sub_eligible: true,
      sub_duration: "repeating",
      sub_duration_months: mo,
      partner_id: partnerId,
    });
    if (error) {
      setErr(error.code === "23505" ? "That code already exists." : error.message);
      setBusy(false);
      return;
    }
    await syncPartnerCode(partnerId, cleanCode);
    onDone();
  }

  return (
    <form onSubmit={create}>
      <p className="text-body-sm text-muted">
        The program standard: percent off any product, and on editing plans it runs for
        the first months you set. The code lands on the partner row, so their portal and
        page buttons pick it up instantly.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label>
          <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Partner</span>
          <Select value={partnerId} onChange={(e) => pickPartner(e.target.value)}>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.coupon_code ? ` (has ${p.coupon_code})` : " (no code yet)"}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Code</span>
          <Input
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())} className="font-mono uppercase"
            maxLength={32}
          />
        </label>
        <label>
          <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Percent off</span>
          <Input
            type="number"
            min={1}
            max={90}
            value={percent}
            onChange={(e) => pickPercent(e.target.value)}
          />
        </label>
        <label>
          <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Months on editing plans</span>
          <Input
            type="number"
            min={1}
            value={months}
            onChange={(e) => setMonths(e.target.value)}
          />
        </label>
      </div>
      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}
      <div className="mt-6 flex gap-3">
        <Button variant="brand" type="submit" disabled={busy}>
          {busy ? "Creating" : "Create coupon"}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function CouponsScreen() {
  const [tab, setTab] = useState<"store" | "partner">("store");
  const [rows, setRows] = useState<CouponRow[]>([]);
  const [partners, setPartners] = useState<PartnerLite[]>([]);
  const [editing, setEditing] = useState<CouponRow | "new" | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const [c, p] = await Promise.all([
      supabase.from("coupons").select("*").order("created_at", { ascending: false }),
      // audience coupons are a VIP-tier benefit only (program rules):
      // affiliates and partnership members run on links alone
      supabase
        .from("partners")
        .select("id, ref, name, status, coupon_code")
        .in("status", ["invited", "active"])
        .eq("tier", "vip")
        .order("name"),
    ]);
    if (c.error) setErr(c.error.message);
    else setRows(c.data as CouponRow[]);
    if (p.error) setErr(p.error.message);
    else setPartners((p.data ?? []) as PartnerLite[]);
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
    if (error) {
      setErr(error.message);
      return;
    }
    // the partner row should not keep advertising a dead code
    if (c.partner_id) {
      const owner = partners.find((p) => p.id === c.partner_id);
      if (owner?.coupon_code === c.code) await syncPartnerCode(c.partner_id, null);
    }
    load();
  }

  /* program-standard codes for every partner still missing one */
  async function createMissing() {
    const missing = partners.filter((p) => !p.coupon_code);
    if (missing.length === 0) {
      setNotice("Every partner already has a code.");
      return;
    }
    if (!confirm(`Create the standard 10% coupon for ${missing.length} partner(s)?`)) return;
    setErr("");
    let made = 0;
    for (const p of missing) {
      const code = suggestCode(p.ref, 10);
      const { error } = await supabase.from("coupons").insert({
        code,
        percent_off: 10,
        amount_off_cents: null,
        sku: null,
        active: true,
        sub_eligible: true,
        sub_duration: "repeating",
        sub_duration_months: 3,
        partner_id: p.id,
      });
      if (error) {
        setErr(`Stopped at ${p.name}: ${error.code === "23505" ? `code ${code} already exists` : error.message}`);
        break;
      }
      await syncPartnerCode(p.id, code);
      made++;
    }
    setNotice(made ? `Created ${made} partner coupon(s).` : "");
    load();
  }

  if (!loaded) return <p className="text-body text-muted">Loading coupons...</p>;

  const partnerName = (id: string | null) =>
    id ? (partners.find((p) => p.id === id)?.name ?? "a partner") : null;
  const storeRows = rows.filter((c) => !c.partner_id);
  const partnerRows = rows.filter((c) => c.partner_id);
  const shown = tab === "store" ? storeRows : partnerRows;
  const missingCount = partners.filter((p) => !p.coupon_code).length;

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-h3 text-ink">Coupons</h1>
        <div className="flex gap-2">
          {tab === "partner" && missingCount > 0 && (
            <Button variant="secondary" onClick={createMissing}>
              Create missing ({missingCount})
            </Button>
          )}
          <Button
            variant="brand"
            onClick={() => (tab === "store" ? setEditing("new") : setGenerating(true))}
          >
            {tab === "store" ? "Add coupon" : "Create partner coupon"}
          </Button>
        </div>
      </div>
      <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
        {tab === "store"
          ? "Codes buyers can enter at checkout, or that campaign links apply automatically. Turning Active off stops a code instantly. The discount always applies to the product price, never to order bumps."
          : "One code per partner, the discount rail of the affiliate program. Partner-page buy buttons apply it automatically; everyone else types it at checkout. Creating or deleting here updates what the partner sees in their portal."}
      </p>

      <div className="mt-6 flex gap-1 border-b border-hair">
        {(
          [
            { key: "store", label: `Store coupons (${storeRows.length})` },
            { key: "partner", label: `Partner coupons (${partnerRows.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setEditing(null);
              setGenerating(false);
              setNotice("");
            }}
            className={`tap rounded-t-[8px] px-4 py-2.5 text-body-sm transition-colors ${
              tab === t.key
                ? "border border-b-0 border-hair bg-surface font-semibold text-gold"
                : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}
      {notice && <p className="mt-4 text-body-sm text-gold">{notice}</p>}

      <AdminModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === "new" || !editing ? "Add a coupon" : `Edit ${editing.code}`}
      >
        {editing && (
          <CouponForm
            initial={editing === "new" ? {} : editing}
            partners={partners}
            onDone={() => {
              setEditing(null);
              load();
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </AdminModal>
      <AdminModal
        open={generating}
        onClose={() => setGenerating(false)}
        title="Create a partner coupon"
      >
        {generating && (
          <PartnerCouponGenerator
            partners={partners}
            onDone={() => {
              setGenerating(false);
              load();
            }}
            onCancel={() => setGenerating(false)}
          />
        )}
      </AdminModal>

      <ul className="mt-6 overflow-hidden rounded-[12px] border border-hair">
        {shown.length === 0 && (
          <li className="bg-canvas px-5 py-6 text-body text-muted">
            {tab === "store"
              ? "No store coupons yet. Add the first one."
              : "No partner coupons yet. Create one, or hit Create missing to cover every partner."}
          </li>
        )}
        {shown.map((c) => (
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
                {c.partner_id ? ` / ${partnerName(c.partner_id)}` : ""}
                {c.sku ? ` / ${c.sku}` : " / any product"}
                {c.sub_eligible
                  ? c.sub_duration === "repeating"
                    ? ` / editing ${c.sub_duration_months ?? 1} mo`
                    : ` / editing ${c.sub_duration ?? "once"}`
                  : ""}
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
                className={`tap rounded-[8px] border px-4 py-2 text-body-sm transition-colors ${
                  c.active
                    ? "border-hair text-ink hover:border-gold/60"
                    : "border-gold/50 bg-gold/10 text-gold hover:bg-gold/20"
                }`}
              >
                {c.active ? "Turn off" : "Turn on"}
              </button>
              <Button
                variant="secondary"
                onClick={() => setEditing(c)}
              >
                Edit
              </Button>
              <Button
                variant="secondary"
                onClick={() => remove(c)} className="text-error hover:border-error/60"
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
