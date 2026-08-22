"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button, Field, Input, Modal, PageHeader, Select } from "@/components/portal/ui";
import { authHeader, money, supabase, when } from "./client";

/*
 * Invoices: create an itemized invoice (client + line items + due date + notes)
 * and get a link to send. The client pays on the branded /invoice/<token> page,
 * which runs the normal checkout, so a paid invoice lands in Orders and
 * HighLevel. Status is open / paid (derived from the order) / void.
 */
const SITE = "https://www.ghlvideo.com";
const fLab = "font-mono text-label uppercase text-dim";

type LineItem = { description: string; amount_cents: number; quantity?: number; unit_cents?: number };
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
        className="w-full min-w-0 rounded-[8px] border border-hair bg-canvas px-3 py-2 font-mono text-body-sm text-muted focus:outline-none"
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
        className="tap shrink-0 rounded-[8px] border border-hair px-3.5 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
      >
        {done ? "Copied" : "Copy"}
      </button>
    </div>
  );
}


type Customer = { id: string; email: string; name: string | null; company: string | null };
type ProjectPick = { id: string; title: string; customerEmail: string };
type Row = { description: string; quantity: string; unit: string };

const EMPTY_ROW: Row = { description: "", quantity: "1", unit: "" };

export function InvoicesScreen() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerEmail, setCustomerEmail] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([{ ...EMPTY_ROW }]);
  const [discountKind, setDiscountKind] = useState<"" | "percent" | "flat">("");
  const [discountValue, setDiscountValue] = useState("");
  const [parentOrderId, setParentOrderId] = useState("");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [projects, setProjects] = useState<ProjectPick[]>([]);
  const [orders, setOrders] = useState<
    { id: string; customer_email: string; created_at: string; product: { name: string } | null }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/invoices", { headers: await authHeader(), cache: "no-store" });
    const j = await r.json();
    setInvoices((j.invoices as Invoice[]) ?? []);
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

  /* who an invoice can be for, and which jobs it can bill. Closed and
   * cancelled jobs are left out: billing work nobody is doing is a mistake. */
  useEffect(() => {
    (async () => {
      try {
        const h = await authHeader();
        const [c, p] = await Promise.all([
          fetch("/api/admin/customers", { headers: h }).then((x) => x.json()),
          fetch("/api/admin/projects", { headers: h }).then((x) => x.json()),
        ]);
        setCustomers((c.customers as Customer[]) ?? []);
        setProjects(
          ((p.projects as { id: string; title: string; customerEmail: string; status: string }[]) ?? [])
            .filter((x) => x.status !== "closed" && x.status !== "cancelled")
            .map((x) => ({ id: x.id, title: x.title, customerEmail: x.customerEmail })),
        );
      } catch {
        /* the pickers just stay empty */
      }
    })();
  }, []);

  const chosen = customers.find((c) => c.email === customerEmail) ?? null;
  /* only this client's jobs can go on this client's bill */
  const theirProjects = projects.filter(
    (p) => !customerEmail || p.customerEmail.toLowerCase() === customerEmail.toLowerCase(),
  );

  const cents = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
  };
  const qty = (v: string) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n > 0 ? n : 1;
  };
  const subtotal = rows.reduce((s, r) => s + cents(r.unit) * qty(r.quantity), 0);
  const discountCents = (() => {
    const v = Math.round(Number(discountValue));
    if (!discountKind || !Number.isFinite(v) || v <= 0) return 0;
    return discountKind === "percent"
      ? Math.min(subtotal, Math.round((subtotal * Math.min(100, v)) / 100))
      : Math.min(subtotal, Math.round(v * 100));
  })();
  const total = subtotal - discountCents;

  function reset() {
    setCustomerEmail("");
    setDueDate("");
    setNotes("");
    setRows([{ ...EMPTY_ROW }]);
    setDiscountKind("");
    setDiscountValue("");
    setParentOrderId("");
    setProjectIds([]);
    setErr("");
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    const lineItems = rows
      .map((r) => ({
        description: r.description.trim(),
        quantity: qty(r.quantity),
        unitCents: cents(r.unit),
      }))
      .filter((r) => r.description && r.unitCents > 0);
    const res = await fetch("/api/admin/invoices", {
      method: "POST",
      headers: { ...(await authHeader()), "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: chosen?.name ?? "",
        customerEmail,
        customerCompany: chosen?.company ?? "",
        dueDate,
        notes,
        lineItems,
        discountKind: discountKind || null,
        discountValue: discountKind
          ? discountKind === "percent"
            ? Math.round(Number(discountValue))
            : Math.round(Number(discountValue) * 100)
          : null,
        parentOrderId: parentOrderId || null,
        projectIds,
      }),
    });
    const j = await res.json();
    setBusy(false);
    if (j.error) return setErr(j.error);
    reset();
    setOpen(false);
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
    <div className="w-full">
      <PageHeader
        title="Invoices"
        description="Itemized invoices for custom work and one-off deals. Create one, send the link, and it is marked paid the moment the client pays."
        actions={
          <Button variant="brand" icon={<Plus />} onClick={() => setOpen(true)}>
            New invoice
          </Button>
        }
      />

      <Modal open={open} onClose={() => setOpen(false)} title="New invoice" maxWidth="max-w-3xl">
        <form onSubmit={create} className="grid gap-4">
          {/* who it is for: picked once, never typed again */}
          <Field
            label="Client"
            required
            hint="Add them under Clients first if they are not here yet. Their name, email and company come with them."
          >
            <Select
              value={customerEmail}
              onChange={(e) => {
                setCustomerEmail(e.target.value);
                setProjectIds([]);
              }}
            >
              <option value="">Pick a client</option>
              {customers.map((c) => (
                <option key={c.id} value={c.email}>
                  {c.company || c.name || c.email}
                </option>
              ))}
            </Select>
          </Field>

          {chosen && (
            <p className="-mt-2 text-body-sm text-muted">
              Billing <span className="text-ink">{chosen.name || chosen.email}</span>
              {chosen.company ? ` at ${chosen.company}` : ""} / {chosen.email}
            </p>
          )}

          {/* what it bills: any number of their jobs */}
          {theirProjects.length > 0 && (
            <Field
              label="Custom projects on this invoice"
              hint="Tick every job this bill covers. One invoice can carry several."
            >
              <div className="grid gap-1.5">
                {theirProjects.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-body-sm text-muted">
                    <input
                      type="checkbox"
                      checked={projectIds.includes(p.id)}
                      onChange={(e) =>
                        setProjectIds(
                          e.target.checked
                            ? [...projectIds, p.id]
                            : projectIds.filter((x) => x !== p.id),
                        )
                      }
                      className="h-4 w-4 accent-[var(--gold)]"
                    />
                    <span className="text-ink">{p.title}</span>
                  </label>
                ))}
              </div>
            </Field>
          )}

          {/* the lines */}
          <div>
            <span className={fLab}>Lines</span>
            <div className="mt-2 grid gap-2">
              <div className="hidden gap-2 sm:grid sm:grid-cols-[minmax(0,1fr)_5rem_7rem_6rem_2rem]">
                <span className={fLab}>What</span>
                <span className={fLab}>Qty</span>
                <span className={fLab}>Unit price</span>
                <span className={`${fLab} text-right`}>Line</span>
                <span />
              </div>
              {rows.map((r, i) => (
                <div
                  key={i}
                  className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_5rem_7rem_6rem_2rem] sm:items-center"
                >
                  <Input
                    value={r.description}
                    onChange={(e) => {
                      const next = [...rows];
                      next[i] = { ...r, description: e.target.value };
                      setRows(next);
                    }}
                    placeholder="Vertical reel, 30 seconds"
                    aria-label="What"
                  />
                  <Input
                    type="number"
                    min="1"
                    value={r.quantity}
                    onChange={(e) => {
                      const next = [...rows];
                      next[i] = { ...r, quantity: e.target.value };
                      setRows(next);
                    }}
                    aria-label="Quantity"
                  />
                  <Input
                    type="number"
                    value={r.unit}
                    onChange={(e) => {
                      const next = [...rows];
                      next[i] = { ...r, unit: e.target.value };
                      setRows(next);
                    }}
                    placeholder="1500"
                    aria-label="Unit price in dollars"
                  />
                  <span className="text-right font-mono text-body-sm tabular-nums text-ink">
                    {money(cents(r.unit) * qty(r.quantity))}
                  </span>
                  {rows.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setRows(rows.filter((_, x) => x !== i))}
                      aria-label="Remove this line"
                      className="tap justify-self-end text-dim transition-colors hover:text-error"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
              <div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setRows([...rows, { ...EMPTY_ROW }])}
                >
                  Add a line
                </Button>
              </div>
            </div>
          </div>

          {/* the discount */}
          <div className="grid gap-4 sm:grid-cols-[10rem_10rem_minmax(0,1fr)] sm:items-end">
            <Field label="Discount" hint="Optional.">
              <Select
                value={discountKind}
                onChange={(e) => setDiscountKind(e.target.value as "" | "percent" | "flat")}
              >
                <option value="">None</option>
                <option value="percent">Percentage</option>
                <option value="flat">Flat amount</option>
              </Select>
            </Field>
            {discountKind && (
              <Field label={discountKind === "percent" ? "Percent off" : "Dollars off"} hint=" ">
                <Input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountKind === "percent" ? "10" : "250"}
                />
              </Field>
            )}
            <div className="text-right">
              <p className="font-mono text-label uppercase text-dim">
                Subtotal {money(subtotal)}
                {discountCents > 0 ? ` / less ${money(discountCents)}` : ""}
              </p>
              <p className="font-display text-h4 tabular-nums text-gold">{money(total)}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Due date" hint="Optional.">
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
            <Field label="Note on the invoice" hint="The client reads this.">
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>

          {orders.length > 0 && (
            <Field
              label="Extra work on an existing order"
              hint="Optional. Links this bill to something already bought."
            >
              <Select value={parentOrderId} onChange={(e) => setParentOrderId(e.target.value)}>
                <option value="">Not extra work</option>
                {orders
                  .filter(
                    (o) =>
                      !customerEmail ||
                      o.customer_email.toLowerCase() === customerEmail.toLowerCase(),
                  )
                  .slice(0, 40)
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.product?.name ?? "Order"} / {o.customer_email} / {when(o.created_at)}
                    </option>
                  ))}
              </Select>
            </Field>
          )}

          {err && <p className="text-body-sm text-error">{err}</p>}

          <div className="flex justify-end gap-2 border-t border-hair pt-4">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              disabled={busy || !customerEmail || total < 50}
              onClick={(e) => create(e as unknown as React.FormEvent)}
            >
              {busy ? "Creating..." : `Create invoice for ${money(total)}`}
            </Button>
          </div>
        </form>
      </Modal>


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
              className={`rounded-[12px] border border-hair bg-surface p-4 ${inv.status === "void" ? "opacity-60" : ""}`}
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
                {inv.dueDate ? ` / due ${inv.dueDate}` : ""}
                {inv.sentAt ? " / sent" : ""}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <CopyField url={`${SITE}/invoice/${inv.token}/`} />
                <a
                  href={`/invoice/${inv.token}/`}
                  target="_blank"
                  rel="noopener"
                  className="tap shrink-0 rounded-[8px] border border-hair px-3.5 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
                >
                  View
                </a>
                {inv.status === "open" ? (
                  <>
                    {!inv.sentAt ? (
                      <button
                        type="button"
                        onClick={() => act(inv.id, "sent")}
                        className="tap shrink-0 rounded-[8px] border border-hair px-3.5 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
                      >
                        Mark sent
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => act(inv.id, "void")}
                      className="tap shrink-0 rounded-[8px] border border-hair px-3.5 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-error/60 hover:text-error"
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
