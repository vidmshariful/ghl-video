"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { authHeader, money, supabase, when } from "./client";
import { AdminModal } from "./Modal";
import { bundlePickTitles } from "@/lib/bundles";

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
  archived: boolean;
  product: { name: string; sku: string; metadata: { code?: string } | null } | null;
  customer: { name: string | null; company: string | null; phone: string | null } | null;
};
type OrderEvent = { event_type: string; payload: Record<string, unknown>; created_at: string };
type OrderUpdate = { id: string; body: string; created_at: string };
type InvoiceLink = {
  id: string;
  number: string;
  parent_order_id: string | null;
  product_sku: string;
  total_cents: number;
  status: string;
  token: string;
  line_items: { description: string; amount_cents: number }[];
};

/* the pipeline buckets Manage Orders groups paid orders into */
const STAGE_BUCKET: Record<string, "new" | "production" | "delivered"> = {
  paid: "new",
  intake: "new",
  production: "production",
  review: "production",
  delivered: "delivered",
};

/* an invoice / manual order shows its invoice number + title, not a catalog code */
function invoiceTitle(o: OrderRow): { number: string | null; title: string } | null {
  const m = o.metadata ?? {};
  const isInvoice = Boolean(m.invoice || m.manual || m.custom);
  if (!isInvoice) return null;
  const number = (m.invoiceRef as string) || o.invoice_number || null;
  const title = o.product?.name || (m.customTitle as string) || (m.sku as string) || "Invoice";
  return { number, title };
}

const STATUS_STYLE: Record<string, string> = {
  paid: "border-green/40 text-green",
  pending: "border-gold/40 text-gold",
  failed: "border-error/40 text-error",
  refunded: "border-hair text-dim",
};

export function hlState(o: OrderRow): { label: string; cls: string } {
  if (o.status === "refunded") return { label: "", cls: "" };
  // Manual orders came from outside (already in HighLevel); never flag them.
  if (o.metadata?.manual) return { label: "Manual", cls: "text-muted" };
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

type Brief = {
  brandName: string;
  primaryColor: string;
  accentColor: string;
  brandPronunciation: string;
  notes: string;
  logoUrl: string | null;
  screenshotUrls: string[];
  videoSelections?: {
    master?: string[];
    demo?: string[];
    feature?: string[];
  } | null;
};

/* The client's submitted branding brief, read from the intake route (which
 * returns the files as short-lived signed URLs). */
function BrandingBrief({ orderId }: { orderId: string }) {
  const [brief, setBrief] = useState<Brief | null | "loading">("loading");
  useEffect(() => {
    fetch(`/api/intake/${orderId}/`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setBrief((j?.intake as Brief) ?? null))
      .catch(() => setBrief(null));
  }, [orderId]);

  const lab = "shrink-0 font-mono text-label uppercase text-dim";
  const chip =
    "rounded-[3px] border border-hair px-3 py-1 font-mono text-label uppercase text-ink hover:border-gold/60";
  // map a picked video slug to its title, for the fulfillment team
  const slugTitle = useMemo(() => bundlePickTitles(), []);
  const pickCats: { key: "master" | "demo" | "feature"; label: string }[] = [
    { key: "master", label: "Master" },
    { key: "demo", label: "Demo" },
    { key: "feature", label: "Feature" },
  ];

  return (
    <div className="mt-6">
      <p className="font-mono text-label uppercase text-gold">Branding brief</p>
      {brief === "loading" ? (
        <p className="mt-2 text-body-sm text-muted">Loading...</p>
      ) : !brief ? (
        <p className="mt-2 text-body-sm text-dim">
          Not submitted yet. Client link:{" "}
          <span className="break-all font-mono text-muted">/checkout/intake/{orderId}</span>
        </p>
      ) : (
        <div className="mt-2 grid gap-2 text-body-sm">
          <div className="flex gap-2">
            <span className={lab}>Brand:</span>
            <span className="text-muted">{brief.brandName}</span>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <span className="inline-flex items-center gap-2">
              <span className={lab}>Primary</span>
              <span className="h-4 w-4 rounded border border-hair" style={{ background: brief.primaryColor }} />
              <span className="font-mono text-muted">{brief.primaryColor}</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className={lab}>Accent</span>
              <span className="h-4 w-4 rounded border border-hair" style={{ background: brief.accentColor }} />
              <span className="font-mono text-muted">{brief.accentColor}</span>
            </span>
          </div>
          {brief.videoSelections &&
          pickCats.some((c) => (brief.videoSelections?.[c.key] ?? []).length) ? (
            <div className="grid gap-1 rounded-[3px] border border-hair/60 bg-canvas/40 p-3">
              <span className="font-mono text-label uppercase text-gold/80">Chosen videos</span>
              {pickCats.map((c) => {
                const slugs = brief.videoSelections?.[c.key] ?? [];
                if (!slugs.length) return null;
                return (
                  <div key={c.key} className="flex gap-2">
                    <span className={lab}>{c.label}:</span>
                    <span className="text-muted">
                      {slugs.map((slug) => slugTitle[slug] ?? slug).join(", ")}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
          {brief.brandPronunciation ? (
            <div className="flex gap-2">
              <span className={lab}>Say it:</span>
              <span className="text-muted">{brief.brandPronunciation}</span>
            </div>
          ) : null}
          {brief.notes ? (
            <div className="flex gap-2">
              <span className={lab}>Notes:</span>
              <span className="whitespace-pre-wrap text-muted">{brief.notes}</span>
            </div>
          ) : null}
          {brief.logoUrl || brief.screenshotUrls.length ? (
            <div className="mt-1 flex flex-wrap gap-2">
              {brief.logoUrl ? (
                <a href={brief.logoUrl} target="_blank" rel="noopener" className={chip}>
                  Logo
                </a>
              ) : null}
              {brief.screenshotUrls.map((u, i) => (
                <a key={i} href={u} target="_blank" rel="noopener" className={chip}>
                  Shot {i + 1}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function OrderDetail({
  order,
  attachedInvoices,
  onChanged,
}: {
  order: OrderRow;
  attachedInvoices: InvoiceLink[];
  onChanged: () => void;
}) {
  const [events, setEvents] = useState<OrderEvent[] | null>(null);
  const [updates, setUpdates] = useState<OrderUpdate[] | null>(null);

  const loadUpdates = useCallback(() => {
    supabase
      .from("order_updates")
      .select("id,body,created_at")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setUpdates((data as OrderUpdate[]) ?? []));
  }, [order.id]);

  useEffect(() => {
    supabase
      .from("order_events")
      .select("event_type,payload,created_at")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => setEvents((data as OrderEvent[]) ?? []));
    loadUpdates();
  }, [order.id, loadUpdates]);

  const meta: [string, string | null | undefined][] = [
    ["Order id", order.id],
    ["Stripe payment", order.stripe_payment_intent_id],
    ["HighLevel contact", order.highlevel_contact_id],
    ["HighLevel opportunity", order.highlevel_opportunity_id],
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
      {/* left: post updates + the update history the client sees */}
      <div>
        <FulfillmentEditor
          order={order}
          onChanged={() => {
            onChanged();
            loadUpdates();
          }}
        />
        <p className="mt-8 font-mono text-label uppercase text-dim">
          Updates the client sees
        </p>
        <ul className="mt-2 grid gap-2">
          {updates === null ? (
            <li className="text-body-sm text-muted">Loading...</li>
          ) : updates.length === 0 ? (
            <li className="rounded-[3px] border border-dashed border-hair px-4 py-3 text-body-sm text-muted">
              No updates posted yet. Post one above: the client is emailed and sees it in
              their portal, and it shows here too.
            </li>
          ) : (
            updates.map((u) => (
              <li
                key={u.id}
                className="rounded-[3px] border border-hair bg-surface px-4 py-3"
              >
                <p className="font-mono text-label uppercase text-dim">{when(u.created_at)}</p>
                <p className="mt-1 whitespace-pre-wrap text-body-sm text-ink">{u.body}</p>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* right: brief, order meta, system timeline, actions */}
      <div>
        <BrandingBrief orderId={order.id} />
        {attachedInvoices.length > 0 && (
          <>
            <p className="mt-6 font-mono text-label uppercase text-dim">Extra-work invoices</p>
            <ul className="mt-2 grid gap-2">
              {attachedInvoices.map((i) => (
                <li key={i.id} className="rounded-[3px] border border-hair bg-surface px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-body-sm text-gold/80">{i.number}</span>
                    <span className="font-mono text-body-sm font-bold text-ink [font-variant-numeric:tabular-nums]">
                      {money(i.total_cents)}
                    </span>
                  </div>
                  <p className="mt-1 text-body-sm text-muted">
                    {i.line_items?.map((li) => li.description).filter(Boolean).join(", ") || "Invoice"}
                  </p>
                  <a
                    href={`/invoice/${i.token}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block font-mono text-label uppercase text-muted transition-colors hover:text-gold"
                  >
                    {i.status === "void" ? "Voided" : "Open invoice"} &rarr;
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-6 font-mono text-label uppercase text-dim">Order</p>
        <div className="mt-2 grid gap-y-2">
          {meta
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="flex gap-2 text-body-sm">
                <span className="shrink-0 font-mono text-label uppercase text-dim">{k}:</span>
                <span className="break-all font-mono text-muted">{v as string}</span>
              </div>
            ))}
        </div>
        <p className="mt-6 font-mono text-label uppercase text-dim">System timeline</p>
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
    </div>
  );
}

type ProdOpt = {
  sku: string;
  name: string;
  price_cents: number;
  metadata: { code?: string; manual?: boolean; invoice?: boolean; custom?: boolean } | null;
};

/* Record a sale that happened outside the site (HighLevel invoice, etc.):
   creates the customer + a paid order + portal access via /api/admin/orders/manual. */
function ManualOrderForm({ onDone }: { onDone: () => void }) {
  const [products, setProducts] = useState<ProdOpt[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [sku, setSku] = useState("__custom");
  const [customTitle, setCustomTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase
      .from("products")
      .select("sku,name,price_cents,active,metadata")
      .eq("active", true)
      .order("price_cents", { ascending: true })
      .then(({ data }) => {
        setProducts(
          ((data as ProdOpt[]) ?? []).filter(
            (p) => !p.metadata?.manual && !p.metadata?.invoice && !p.metadata?.custom,
          ),
        );
      });
  }, []);

  function pickProduct(value: string) {
    setSku(value);
    const p = products.find((x) => x.sku === value);
    if (p) setAmount((p.price_cents / 100).toString());
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    const custom = sku === "__custom";
    const res = await fetch("/api/admin/orders/manual", {
      method: "POST",
      headers: { ...(await authHeader()), "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        company,
        phone,
        productSku: custom ? "" : sku,
        customTitle: custom ? customTitle : "",
        amountCents: Math.round(Number(amount) * 100),
        invoiceRef,
        note,
      }),
    });
    const j = await res.json();
    setBusy(false);
    if (j.error) {
      setErr(j.error);
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={fLab}>Client name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={fField} />
        </label>
        <label>
          <span className={fLab}>Client email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fField}
          />
        </label>
        <label>
          <span className={fLab}>Company</span>
          <input value={company} onChange={(e) => setCompany(e.target.value)} className={fField} />
        </label>
        <label>
          <span className={fLab}>Phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={fField} />
        </label>
      </div>

      <label>
        <span className={fLab}>Project</span>
        <select value={sku} onChange={(e) => pickProduct(e.target.value)} className={fField}>
          {products.map((p) => (
            <option key={p.sku} value={p.sku}>
              {p.metadata?.code ? `${p.metadata.code} ` : ""}
              {p.name}
            </option>
          ))}
          <option value="__custom">Custom project (enter a title)</option>
        </select>
      </label>

      {sku === "__custom" && (
        <label>
          <span className={fLab}>Project title (shown to the client)</span>
          <input
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="e.g. AI First SaaS Pack"
            className={fField}
          />
        </label>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={fLab}>Amount paid (USD)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={fField}
          />
        </label>
        <label>
          <span className={fLab}>Invoice / reference (optional)</span>
          <input
            value={invoiceRef}
            onChange={(e) => setInvoiceRef(e.target.value)}
            placeholder="e.g. INV-000831"
            className={fField}
          />
        </label>
      </div>

      <label>
        <span className={fLab}>Internal note (optional)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} className={fField} />
      </label>

      {err && <p className="text-body-sm text-error">{err}</p>}
      <p className="text-body-sm text-dim">
        Creates a paid order and gives the client portal access. No Stripe charge, no HighLevel
        sync (the sale already lives there).
      </p>
      <button
        type="submit"
        disabled={busy}
        className="tap justify-self-start rounded-[3px] bg-brand-gradient px-6 py-2.5 text-body-sm font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-50"
      >
        {busy ? "Creating..." : "Create order"}
      </button>
    </form>
  );
}

/* Download the full order list as a CSV report (All Orders view). */
function exportOrdersCsv(rows: OrderRow[]) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = [
    "Date", "Invoice", "Customer", "Email", "Company", "Product", "Code", "Status", "Stage", "Amount",
  ].join(",");
  const lines = rows.map((r) =>
    [
      r.created_at, r.invoice_number ?? "", r.customer?.name ?? "", r.customer_email,
      r.customer?.company ?? "", r.product?.name ?? "", r.product?.metadata?.code ?? "",
      r.status, r.fulfillment_stage, (r.amount_cents / 100).toFixed(2),
    ].map(esc).join(","),
  );
  const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function OrdersScreen() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceLink[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [view, setView] = useState<"manage" | "all">("manage");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const [o, inv] = await Promise.all([
      supabase
        .from("orders")
        .select("*, product:products(name, sku, metadata), customer:customers(name,company,phone)")
        .order("created_at", { ascending: false }),
      supabase
        .from("invoices")
        .select("id,number,parent_order_id,product_sku,total_cents,status,token,line_items")
        .not("parent_order_id", "is", null),
    ]);
    if (o.error) setErr(o.error.message);
    else setRows(o.data as OrderRow[]);
    if (!inv.error) setInvoices((inv.data as unknown as InvoiceLink[]) ?? []);
    setLoaded(true);
  }
  useEffect(() => {
    load();
  }, []);

  async function archive(id: string, archived: boolean) {
    setBusyId(id);
    try {
      await fetch(`/api/admin/orders/${id}/fulfillment`, {
        method: "POST",
        headers: { ...(await authHeader()), "content-type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (!loaded) return <p className="text-body text-muted">Loading orders...</p>;

  // An "extra work" invoice attached to a parent order backs a child order; nest
  // it under the parent instead of listing it as its own order in Manage.
  const childSkus = new Set(invoices.map((i) => i.product_sku));
  const isChild = (r: OrderRow) => (r.product?.sku ? childSkus.has(r.product.sku) : false);

  const openOrder = rows.find((r) => r.id === open) ?? null;

  // ---- full-page order detail ----
  if (openOrder) {
    const hl = hlState(openOrder);
    const inv = invoiceTitle(openOrder);
    const attached = invoices.filter((i) => i.parent_order_id === openOrder.id);
    return (
      <div className="max-w-5xl">
        <button
          type="button"
          onClick={() => setOpen(null)}
          className="tap font-mono text-label uppercase text-muted transition-colors hover:text-gold"
        >
          &larr; Orders
        </button>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-hair pb-5">
          <div className="min-w-0">
            <h1 className="font-display text-h3 text-ink">
              {openOrder.customer?.name || openOrder.customer_email}
            </h1>
            <p className="mt-1 font-mono text-body-sm text-muted">
              {inv ? (
                <>
                  {inv.number ? <span className="text-gold/80">{inv.number} </span> : null}
                  {inv.title}
                </>
              ) : (
                <>
                  {openOrder.product?.metadata?.code ? (
                    <span className="text-gold/80">{openOrder.product.metadata.code} </span>
                  ) : null}
                  {openOrder.product?.name ?? (openOrder.metadata?.sku as string)}
                </>
              )}
              <span className="text-dim"> / {openOrder.customer_email}</span>
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            {hl.label && (
              <span className={`font-mono text-label uppercase ${hl.cls}`}>{hl.label}</span>
            )}
            <span
              className={`rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${STATUS_STYLE[openOrder.status]}`}
            >
              {openOrder.status}
            </span>
            <span className="font-mono text-price font-bold text-ink [font-variant-numeric:tabular-nums]">
              {money(openOrder.amount_cents, openOrder.currency)}
            </span>
            <button
              type="button"
              onClick={() => archive(openOrder.id, !openOrder.archived)}
              disabled={busyId === openOrder.id}
              className="tap rounded-[3px] border border-hair px-3 py-1 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-50"
            >
              {openOrder.archived ? "Unarchive" : "Archive"}
            </button>
          </div>
        </div>
        <div className="mt-6">
          <OrderDetail order={openOrder} attachedInvoices={attached} onChanged={load} />
        </div>
      </div>
    );
  }

  // ---- list views ----
  const paid = rows.filter((r) => r.status === "paid");
  const summary: [string, string, string][] = [
    ["Revenue", money(paid.reduce((s, r) => s + r.amount_cents, 0)), "text-gold"],
    ["Paid", String(paid.length), "text-green"],
    ["Pending", String(rows.filter((r) => r.status === "pending").length), "text-muted"],
    ["Orders", String(rows.length), "text-muted"],
  ];

  // Manage: only real work (paid/refunded, not archived, not a nested child).
  const manageable = rows.filter(
    (r) => !r.archived && !isChild(r) && (r.status === "paid" || r.status === "refunded"),
  );
  const buckets: { key: string; label: string; tone: string; items: OrderRow[] }[] = [
    {
      key: "new",
      label: "New orders",
      tone: "text-gold",
      items: manageable.filter((r) => r.status === "paid" && STAGE_BUCKET[r.fulfillment_stage] === "new"),
    },
    {
      key: "production",
      label: "In production",
      tone: "text-blue",
      items: manageable.filter((r) => r.status === "paid" && STAGE_BUCKET[r.fulfillment_stage] === "production"),
    },
    {
      key: "delivered",
      label: "Delivered",
      tone: "text-green",
      items: manageable.filter((r) => r.status === "paid" && STAGE_BUCKET[r.fulfillment_stage] === "delivered"),
    },
    { key: "cancelled", label: "Cancelled", tone: "text-dim", items: manageable.filter((r) => r.status === "refunded") },
  ];

  const row = (r: OrderRow) => {
    const hl = hlState(r);
    const inv = invoiceTitle(r);
    return (
      <li key={r.id} className="group/row relative border-t border-hair first:border-t-0">
        <button
          type="button"
          onClick={() => setOpen(r.id)}
          className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-2 bg-surface px-5 py-4 pr-28 text-left transition-colors hover:bg-white/[0.02]"
        >
          <div className="min-w-0">
            <p className="text-body font-semibold text-ink">
              {r.customer?.name || r.customer_email}
              <span className="ml-3 font-mono text-body-sm text-muted">
                {inv ? (
                  <>
                    {inv.number ? <span className="text-gold/80">{inv.number} </span> : null}
                    {inv.title}
                  </>
                ) : (
                  <>
                    {r.product?.metadata?.code ? (
                      <span className="text-gold/80">{r.product.metadata.code} </span>
                    ) : null}
                    {r.product?.name ?? (r.metadata?.sku as string)}
                  </>
                )}
              </span>
            </p>
            <p className="mt-0.5 font-mono text-label uppercase text-dim">
              {when(r.created_at)} / {r.customer_email}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {hl.label && <span className={`font-mono text-label uppercase ${hl.cls}`}>{hl.label}</span>}
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
        <button
          type="button"
          onClick={() => archive(r.id, !r.archived)}
          disabled={busyId === r.id}
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-[3px] border border-hair bg-surface px-2 py-1 font-mono text-label uppercase text-dim opacity-0 transition-all hover:border-gold/60 hover:text-gold group-hover/row:opacity-100 focus-visible:opacity-100 disabled:opacity-50"
        >
          {r.archived ? "Unarch" : "Archive"}
        </button>
      </li>
    );
  };

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-h3 text-ink">Orders</h1>
          <p className="mt-2 text-body text-muted">
            {view === "manage"
              ? "Your active pipeline. New and in-production up top."
              : "Every order, for reporting and export."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowManual(true)}
            className="tap rounded-[3px] bg-brand-gradient px-4 py-2 font-mono text-label font-semibold uppercase text-canvas transition-all hover:brightness-110"
          >
            Add manual order
          </button>
          {view === "all" && (
            <button
              type="button"
              onClick={() => exportOrdersCsv(rows)}
              className="tap rounded-[3px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
            >
              Export CSV
            </button>
          )}
        </div>
      </div>

      <div role="tablist" aria-label="Orders view" className="mt-6 flex gap-1 border-b border-hair">
        {([["manage", "Manage Orders"], ["all", "All Orders"]] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={view === k}
            onClick={() => setView(k)}
            className={`min-h-11 px-4 font-mono text-body-sm transition-colors ${
              view === k
                ? "border-b-2 border-gold font-semibold text-gold"
                : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}

      {view === "manage" ? (
        <div className="mt-6 grid gap-8">
          {buckets.map((b) => (
            <section key={b.key}>
              <div className="flex items-baseline gap-3">
                <p className={`font-mono text-label uppercase ${b.tone}`}>{b.label}</p>
                <span className="font-mono text-label text-dim [font-variant-numeric:tabular-nums]">
                  {b.items.length}
                </span>
              </div>
              {b.items.length === 0 ? (
                <p className="mt-2 text-body-sm text-dim">Nothing here.</p>
              ) : (
                <ul className="mt-2 overflow-hidden rounded-card border border-hair">
                  {b.items.map(row)}
                </ul>
              )}
            </section>
          ))}
        </div>
      ) : (
        <>
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
          {rows.length === 0 ? (
            <p className="mt-8 text-body text-muted">No orders yet.</p>
          ) : (
            <ul className="mt-6 overflow-hidden rounded-card border border-hair">{rows.map(row)}</ul>
          )}
        </>
      )}

      {showManual && (
        <AdminModal
          open
          onClose={() => setShowManual(false)}
          maxWidth="max-w-2xl"
          title="Add a manual order"
          subtitle="Record a sale from a third party (a HighLevel invoice, a wire) and give the client portal access."
        >
          <ManualOrderForm
            onDone={() => {
              setShowManual(false);
              setLoaded(false);
              load();
            }}
          />
        </AdminModal>
      )}
    </div>
  );
}
