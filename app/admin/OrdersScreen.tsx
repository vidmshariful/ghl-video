"use client";

import { useEffect, useState } from "react";
import { authHeader, money, supabase, when } from "./client";

export type OrderRow = {
  id: string;
  customer_email: string;
  amount_cents: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "refunded";
  stripe_payment_intent_id: string | null;
  highlevel_contact_id: string | null;
  highlevel_opportunity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  paid_at: string | null;
  fulfillment_stage: string;
  assigned_manager: string;
  delivery_url: string | null;
  intake_completed: boolean;
  invoice_number: string | null;
  product: { name: string } | null;
  customer: { name: string | null; company: string | null; phone: string | null } | null;
};
type OrderEvent = { event_type: string; payload: Record<string, unknown>; created_at: string };

const STATUS_STYLE: Record<string, string> = {
  paid: "border-green/40 text-green",
  pending: "border-gold/40 text-gold",
  failed: "border-error/40 text-error",
  refunded: "border-hair text-dim",
};

export function hlState(o: OrderRow): { label: string; cls: string } {
  if (o.status === "refunded") return { label: "", cls: "" };
  if (o.highlevel_opportunity_id) return { label: "HL synced", cls: "text-green" };
  if (o.metadata?.hl_sync_failed) return { label: "HL sync failed", cls: "text-error" };
  if (o.status === "paid") return { label: "HL pending", cls: "text-dim" };
  return { label: "", cls: "" };
}

const stripeBase = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_test")
  ? "https://dashboard.stripe.com/test"
  : "https://dashboard.stripe.com";
const actionBtn =
  "tap rounded-[3px] border border-hair px-3.5 py-1.5 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-50";

function OrderActions({ order, onChanged }: { order: OrderRow; onChanged: () => void }) {
  const [busy, setBusy] = useState<null | "resync" | "refund">(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function call(kind: "resync" | "refund") {
    if (
      kind === "refund" &&
      !window.confirm(
        `Refund ${money(order.amount_cents, order.currency)} to ${order.customer_email}? This issues a real Stripe refund.`,
      )
    )
      return;
    setBusy(kind);
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/orders/${order.id}/${kind}`, {
        method: "POST",
        headers: await authHeader(),
      });
      const j = await r.json();
      if (j.ok) {
        setMsg({ ok: true, text: kind === "refund" ? "Refunded." : j.alreadySynced ? "Already synced." : "Synced to HighLevel." });
        onChanged();
      } else {
        setMsg({ ok: false, text: j.error ?? "Something went wrong." });
      }
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      {order.stripe_payment_intent_id && (
        <a
          href={`${stripeBase}/payments/${order.stripe_payment_intent_id}`}
          target="_blank"
          rel="noopener"
          className={actionBtn}
        >
          View in Stripe
        </a>
      )}
      {order.status === "paid" && !order.highlevel_opportunity_id && (
        <button type="button" onClick={() => call("resync")} disabled={busy !== null} className={actionBtn}>
          {busy === "resync" ? "Syncing..." : "Re-sync to HighLevel"}
        </button>
      )}
      {order.status === "paid" && (
        <button
          type="button"
          onClick={() => call("refund")}
          disabled={busy !== null}
          className={`${actionBtn} hover:border-error/60 hover:text-error`}
        >
          {busy === "refund" ? "Refunding..." : "Refund"}
        </button>
      )}
      {msg && <span className={`text-body-sm ${msg.ok ? "text-green" : "text-error"}`}>{msg.text}</span>}
    </div>
  );
}

const STAGES = ["paid", "intake", "production", "review", "delivered"];
const fField =
  "mt-1.5 w-full rounded-[3px] border border-hair bg-canvas px-3 py-2.5 text-body text-ink focus:border-gold focus:outline-none";
const fLab = "font-mono text-label uppercase text-dim";

function FulfillmentEditor({ order, onChanged }: { order: OrderRow; onChanged: () => void }) {
  const [stage, setStage] = useState(order.fulfillment_stage);
  const [manager, setManager] = useState(order.assigned_manager);
  const [deliveryUrl, setDeliveryUrl] = useState(order.delivery_url ?? "");
  const [intake, setIntake] = useState(order.intake_completed);
  const [update, setUpdate] = useState("");
  const [busy, setBusy] = useState<null | "save" | "post">(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(kind: "save" | "post") {
    setBusy(kind);
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/orders/${order.id}/fulfillment`, {
        method: "POST",
        headers: { ...(await authHeader()), "Content-Type": "application/json" },
        body: JSON.stringify({
          stage,
          manager,
          deliveryUrl,
          intakeCompleted: intake,
          update: kind === "post" ? update : undefined,
        }),
      });
      const j = await r.json();
      if (j.ok) {
        setMsg({ ok: true, text: kind === "post" ? "Update posted." : "Saved." });
        if (kind === "post") setUpdate("");
        onChanged();
      } else setMsg({ ok: false, text: j.error ?? "Failed." });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const btn =
    "tap rounded-[3px] px-5 py-2 text-body-sm font-semibold transition-all disabled:opacity-50";

  return (
    <div className="mt-6 rounded-[8px] border border-gold/30 bg-gold/[0.04] p-5">
      <p className="font-mono text-label uppercase text-gold">Fulfillment (what the customer sees)</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label>
          <span className={fLab}>Stage</span>
          <select value={stage} onChange={(e) => setStage(e.target.value)} className={fField}>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={fLab}>Assigned producer</span>
          <input value={manager} onChange={(e) => setManager(e.target.value)} className={fField} />
        </label>
        <label className="sm:col-span-2">
          <span className={fLab}>PlayBook delivery link</span>
          <input
            value={deliveryUrl}
            onChange={(e) => setDeliveryUrl(e.target.value)}
            className={fField}
            placeholder="https://playbook..."
          />
        </label>
        <label className="flex items-center gap-3 sm:col-span-2">
          <input
            type="checkbox"
            checked={intake}
            onChange={(e) => setIntake(e.target.checked)}
            className="h-4 w-4 accent-[#00CC00]"
          />
          <span className="text-body text-ink">Intake completed</span>
        </label>
      </div>
      <div className="mt-4">
        <button
          type="button"
          onClick={() => send("save")}
          disabled={busy !== null}
          className={`${btn} bg-brand-gradient text-canvas hover:brightness-110`}
        >
          {busy === "save" ? "Saving..." : "Save fulfillment"}
        </button>
      </div>

      <div className="mt-5 border-t border-hair pt-4">
        <span className={fLab}>Post an update the customer sees</span>
        <textarea
          value={update}
          onChange={(e) => setUpdate(e.target.value)}
          rows={2}
          className={`${fField} resize-y`}
          placeholder="First cut is in review."
        />
        <button
          type="button"
          onClick={() => send("post")}
          disabled={busy !== null || !update.trim()}
          className={`${btn} mt-3 border border-hair text-muted hover:border-gold/60 hover:text-gold`}
        >
          {busy === "post" ? "Posting..." : "Post update"}
        </button>
      </div>
      {msg && <p className={`mt-3 text-body-sm ${msg.ok ? "text-green" : "text-error"}`}>{msg.text}</p>}
    </div>
  );
}

function OrderDetail({ order, onChanged }: { order: OrderRow; onChanged: () => void }) {
  const [events, setEvents] = useState<OrderEvent[] | null>(null);
  useEffect(() => {
    supabase
      .from("order_events")
      .select("event_type,payload,created_at")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => setEvents((data as OrderEvent[]) ?? []));
  }, [order.id]);

  const meta: [string, string | null | undefined][] = [
    ["Order id", order.id],
    ["Stripe payment", order.stripe_payment_intent_id],
    ["HighLevel contact", order.highlevel_contact_id],
    ["HighLevel opportunity", order.highlevel_opportunity_id],
    ["Company", order.customer?.company],
    ["Phone", order.customer?.phone],
  ];

  return (
    <div className="border-t border-hair bg-canvas px-5 py-5">
      <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
        {meta
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="flex gap-2 text-body-sm">
              <span className="shrink-0 font-mono text-label uppercase text-dim">{k}:</span>
              <span className="break-all font-mono text-muted">{v as string}</span>
            </div>
          ))}
      </div>
      <FulfillmentEditor order={order} onChanged={onChanged} />
      <p className="mt-6 font-mono text-label uppercase text-dim">Timeline</p>
      <ul className="mt-2 grid gap-1.5">
        {events === null ? (
          <li className="text-body-sm text-muted">Loading...</li>
        ) : (
          events.map((e, i) => (
            <li key={i} className="flex items-baseline gap-3 text-body-sm">
              <span className="w-32 shrink-0 font-mono text-dim">{when(e.created_at)}</span>
              <span className="text-muted">
                {e.event_type}
                {e.payload?.error ? `: ${String(e.payload.error)}` : ""}
              </span>
            </li>
          ))
        )}
      </ul>
      <OrderActions order={order} onChanged={onChanged} />
    </div>
  );
}

export function OrdersScreen() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  async function load() {
    const { data, error } = await supabase
      .from("orders")
      .select("*, product:products(name), customer:customers(name,company,phone)")
      .order("created_at", { ascending: false });
    if (error) setErr(error.message);
    else setRows(data as OrderRow[]);
    setLoaded(true);
  }
  useEffect(() => {
    load();
  }, []);

  if (!loaded) return <p className="text-body text-muted">Loading orders...</p>;

  const paid = rows.filter((r) => r.status === "paid");
  const revenue = paid.reduce((s, r) => s + r.amount_cents, 0);
  const counts = {
    paid: paid.length,
    pending: rows.filter((r) => r.status === "pending").length,
    failed: rows.filter((r) => r.status === "failed").length,
  };
  const needsAttention = rows.filter(
    (r) => r.status === "paid" && !r.highlevel_opportunity_id,
  ).length;

  const summary: [string, string, string][] = [
    ["Revenue", money(revenue), "text-gold"],
    ["Paid", String(counts.paid), "text-green"],
    ["Pending", String(counts.pending), "text-muted"],
    ["Failed", String(counts.failed), "text-muted"],
  ];

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-h3 text-ink">Orders</h1>
          <p className="mt-2 text-body text-muted">
            Every checkout, newest first. {rows.length} total.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoaded(false);
            load();
          }}
          className="tap rounded-[3px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
        >
          Refresh
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-hair bg-hair sm:grid-cols-4">
        {summary.map(([label, val, cls]) => (
          <div key={label} className="bg-surface px-5 py-4">
            <p className="font-mono text-label uppercase text-dim">{label}</p>
            <p className={`mt-1 font-display text-h4 [font-variant-numeric:tabular-nums] ${cls}`}>
              {val}
            </p>
          </div>
        ))}
      </div>

      {needsAttention > 0 && (
        <div className="mt-4 rounded-[8px] border border-error/40 bg-error/[0.06] px-4 py-3 text-body-sm text-muted">
          {needsAttention} paid order{needsAttention > 1 ? "s" : ""}{" "}
          {needsAttention > 1 ? "have" : "has"} not synced to HighLevel. Open the
          order to re-sync.
        </div>
      )}

      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}

      {rows.length === 0 ? (
        <p className="mt-8 text-body text-muted">No orders yet.</p>
      ) : (
        <ul className="mt-6 overflow-hidden rounded-card border border-hair">
          {rows.map((r) => {
            const hl = hlState(r);
            const isOpen = open === r.id;
            return (
              <li key={r.id} className="border-t border-hair first:border-t-0">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : r.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-2 bg-surface px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
                >
                  <div className="min-w-0">
                    <p className="text-body font-semibold text-ink">
                      {r.customer?.name || r.customer_email}
                      <span className="ml-3 font-mono text-body-sm text-muted">
                        {r.product?.name ?? (r.metadata?.sku as string)}
                      </span>
                    </p>
                    <p className="mt-0.5 font-mono text-label uppercase text-dim">
                      {when(r.created_at)} / {r.customer_email}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {hl.label && (
                      <span className={`font-mono text-label uppercase ${hl.cls}`}>{hl.label}</span>
                    )}
                    <span
                      className={`rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${STATUS_STYLE[r.status]}`}
                    >
                      {r.status}
                    </span>
                    <span className="font-mono text-price font-bold text-ink [font-variant-numeric:tabular-nums]">
                      {money(r.amount_cents, r.currency)}
                    </span>
                  </div>
                </button>
                {isOpen && <OrderDetail order={r} onChanged={load} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
