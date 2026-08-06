"use client";

import { useCallback, useEffect, useState } from "react";
import { authHeader, money, supabase, when } from "./client";

/*
 * Invoices: create an itemized invoice (client + line items + due date + notes)
 * and get a link to send. The client pays on the branded /invoice/<token> page,
 * which runs the normal checkout, so a paid invoice lands in Orders and
 * HighLevel. Status is open / paid (derived from the order) / void.
 */
const SITE = "https://www.ghlvideo.com";
const fField =
  "mt-1.5 w-full rounded-[3px] border border-hair bg-canvas px-3 py-2.5 text-body text-ink focus:border-gold focus:outline-none";
const fLab = "font-mono text-label uppercase text-dim";

type LineItem = { description: string; amount_cents: number };
type Invoice = {
  id: string;
  number: string;
  token: string;
  status: "open" | "paid" | "void";
  customerName: string | null;
  customerEmail: string | null;
  customerCompany: string | null;
  lineItems: LineItem[];
  totalCents: number;
  currency: string;
  notes: string | null;
  dueDate: string | null;
  sentAt: string | null;
  createdAt: string;
};

const STATUS_STYLE: Record<string, string> = {
  paid: "border-green/40 text-green",
  open: "border-gold/40 text-gold",
  void: "border-hair text-dim",
};

function CopyField({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full min-w-0 rounded-[3px] border border-hair bg-canvas px-3 py-2 font-mono text-body-sm text-muted focus:outline-none"
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

type Row = { description: string; amount: string };

export function InvoicesScreen() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([{ description: "", amount: "" }]);
  const [parentOrderId, setParentOrderId] = useState("");
  const [orders, setOrders] = useState<
    { id: string; customer_email: string; created_at: string; product: { name: string } | null }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/invoices", { headers: await authHeader(), cache: "no-store" });
    const j = await r.json();
    setInvoices((j.invoices as Invoice[]) ?? []);
    // paid orders, for the "attach to an existing order" picker (extra work)
    const { data } = await supabase
      .from("orders")
      .select("id,customer_email,created_at, product:products(name)")
      .eq("status", "paid")
      .order("created_at", { ascending: false });
    setOrders(
      (data as unknown as {
        id: string;
        customer_email: string;
        created_at: string;
        product: { name: string } | null;
      }[]) ?? [],
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const previewTotal = rows.reduce((s, r) => {
    const n = Number(r.amount);
    return s + (Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0);
  }, 0);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    const lineItems = rows
      .map((r) => ({ description: r.description.trim(), amountCents: Math.round(Number(r.amount) * 100) }))
      .filter((r) => r.description && Number.isFinite(r.amountCents) && r.amountCents > 0);
    const res = await fetch("/api/admin/invoices", {
      method: "POST",
      headers: { ...(await authHeader()), "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: name,
        customerEmail: email,
        customerCompany: company,
        dueDate,
        notes,
        lineItems,
        parentOrderId: parentOrderId || null,
      }),
    });
    const j = await res.json();
    setBusy(false);
    if (j.error) {
      setErr(j.error);
      return;
    }
    setName("");
    setEmail("");
    setCompany("");
    setDueDate("");
    setNotes("");
    setParentOrderId("");
    setRows([{ description: "", amount: "" }]);
    load();
  }

  async function act(id: string, action: "sent" | "void") {
    if (action === "void" && !window.confirm("Void this invoice? Its pay link will stop working.")) {
      return;
    }
    await fetch(`/api/admin/invoices/${id}`, {
      method: "PATCH",
      headers: { ...(await authHeader()), "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    load();
  }

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-h3 text-ink">Invoices</h1>
      <p className="mt-2 text-body text-muted">
        Itemized invoices for custom videos and one-off deals. Create one, send the link, and it is
        marked paid the moment the client pays, right inside Orders.
      </p>

      {/* create */}
      <form onSubmit={create} className="mt-6 rounded-card border border-gold/30 bg-gold/[0.04] p-5">
        <p className="font-mono text-label uppercase text-gold">New invoice</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label>
            <span className={fLab}>Client name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={fField} />
          </label>
          <label>
            <span className={fLab}>Client email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fField}
            />
          </label>
          <label>
            <span className={fLab}>Company (optional)</span>
            <input value={company} onChange={(e) => setCompany(e.target.value)} className={fField} />
          </label>
        </div>

        <div className="mt-5">
          <span className={fLab}>Line items</span>
          <div className="mt-2 grid gap-2">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={r.description}
                  onChange={(e) =>
                    setRows((p) => p.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))
                  }
                  placeholder="Description (e.g. Custom explainer video, 60s)"
                  className="min-w-0 flex-1 rounded-[3px] border border-hair bg-canvas px-3 py-2.5 text-body text-ink focus:border-gold focus:outline-none"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={r.amount}
                  onChange={(e) =>
                    setRows((p) => p.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))
                  }
                  placeholder="Amount"
                  className="w-32 shrink-0 rounded-[3px] border border-hair bg-canvas px-3 py-2.5 text-body text-ink focus:border-gold focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setRows((p) => (p.length > 1 ? p.filter((_, j) => j !== i) : p))}
                  className="tap shrink-0 rounded-[3px] border border-hair px-3 py-2.5 text-dim transition-colors hover:border-error/60 hover:text-error"
                  aria-label="Remove line"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setRows((p) => [...p, { description: "", amount: "" }])}
              className="tap font-mono text-label uppercase text-muted transition-colors hover:text-gold"
            >
              + Add line item
            </button>
            <span className="font-mono text-body-sm text-muted">
              Total{" "}
              <span className="font-bold text-ink [font-variant-numeric:tabular-nums]">
                {money(previewTotal)}
              </span>
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label>
            <span className={fLab}>Due date (optional)</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={fField}
            />
          </label>
          <label>
            <span className={fLab}>Notes (optional, shown on the invoice)</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={fField} />
          </label>
        </div>

        <label className="mt-4 block">
          <span className={fLab}>Attach to an existing order (optional)</span>
          <select
            value={parentOrderId}
            onChange={(e) => setParentOrderId(e.target.value)}
            className={fField}
          >
            <option value="">Standalone invoice</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.customer_email} - {o.product?.name ?? "Order"} ({when(o.created_at)})
              </option>
            ))}
          </select>
          <span className="mt-1 block text-body-sm text-dim">
            For extra work on a past order: the invoice nests under that order instead of
            showing as a separate one.
          </span>
        </label>

        {err ? <p className="mt-3 text-body-sm text-error">{err}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="tap mt-4 rounded-[3px] bg-brand-gradient px-6 py-2.5 text-body-sm font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Creating..." : "Create invoice"}
        </button>
      </form>

      {/* list */}
      <p className="mt-8 font-mono text-label uppercase text-dim">All invoices</p>
      {invoices === null ? (
        <p className="mt-3 text-body-sm text-muted">Loading...</p>
      ) : invoices.length === 0 ? (
        <p className="mt-3 text-body-sm text-dim">No invoices yet.</p>
      ) : (
        <ul className="mt-3 grid gap-3">
          {invoices.map((inv) => (
            <li
              key={inv.id}
              className={`rounded-card border border-hair bg-surface p-4 ${inv.status === "void" ? "opacity-60" : ""}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="font-semibold text-ink">
                  <span className="mr-2 font-mono text-gold/80">{inv.number}</span>
                  {inv.customerName || inv.customerEmail}
                  {inv.customerCompany ? (
                    <span className="ml-2 text-body-sm text-dim">{inv.customerCompany}</span>
                  ) : null}
                </p>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${STATUS_STYLE[inv.status]}`}
                  >
                    {inv.status}
                  </span>
                  <span className="font-mono text-body-sm font-bold text-ink [font-variant-numeric:tabular-nums]">
                    {money(inv.totalCents, inv.currency)}
                  </span>
                </div>
              </div>
              <p className="mt-1 font-mono text-label uppercase text-dim">
                {when(inv.createdAt)}
                {inv.dueDate ? ` · due ${inv.dueDate}` : ""}
                {inv.sentAt ? " · sent" : ""}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <CopyField url={`${SITE}/invoice/${inv.token}/`} />
                <a
                  href={`/invoice/${inv.token}/`}
                  target="_blank"
                  rel="noopener"
                  className="tap shrink-0 rounded-[3px] border border-hair px-3.5 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
                >
                  View
                </a>
                {inv.status === "open" ? (
                  <>
                    {!inv.sentAt ? (
                      <button
                        type="button"
                        onClick={() => act(inv.id, "sent")}
                        className="tap shrink-0 rounded-[3px] border border-hair px-3.5 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
                      >
                        Mark sent
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => act(inv.id, "void")}
                      className="tap shrink-0 rounded-[3px] border border-hair px-3.5 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-error/60 hover:text-error"
                    >
                      Void
                    </button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
