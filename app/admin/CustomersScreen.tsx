"use client";

import { useEffect, useState } from "react";
import { money, supabase, when } from "./client";

type COrder = {
  id: string;
  amount_cents: number;
  status: string;
  created_at: string;
  products: { name: string; sku: string; metadata: { code?: string } | null } | null;
};

type CustomerRow = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  created_at: string;
  orders: COrder[];
};

const STATUS_CLS: Record<string, string> = {
  paid: "text-green",
  pending: "text-gold",
  failed: "text-error",
  refunded: "text-dim",
};

export function CustomersScreen() {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("customers")
      .select(
        "id,email,name,company,phone,created_at, orders(id,amount_cents,status,created_at, products(name,sku,metadata))",
      )
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setErr(error.message);
        // products is a to-one embed (single object at runtime); the client
        // infers it as an array, so cast through unknown.
        else setRows(data as unknown as CustomerRow[]);
        setLoaded(true);
      });
  }, []);

  if (!loaded) return <p className="text-body text-muted">Loading customers...</p>;

  const openCustomer = rows.find((c) => c.id === open) ?? null;

  // Full-page customer detail: contact, spend, and every order.
  if (openCustomer) {
    const c = openCustomer;
    const paid = c.orders.filter((o) => o.status === "paid");
    const spent = paid.reduce((s, o) => s + o.amount_cents, 0);
    const contact: [string, string | null][] = [
      ["Email", c.email],
      ["Phone", c.phone],
      ["Company", c.company],
      ["Joined", when(c.created_at)],
    ];
    const stats: [string, string, string][] = [
      ["Total spent", money(spent), "text-gold"],
      ["Paid orders", String(paid.length), "text-green"],
      ["All orders", String(c.orders.length), "text-muted"],
    ];
    return (
      <div className="max-w-4xl">
        <button
          type="button"
          onClick={() => setOpen(null)}
          className="tap font-mono text-label uppercase text-muted transition-colors hover:text-gold"
        >
          &larr; Customers
        </button>
        <div className="mt-4 border-b border-hair pb-5">
          <h1 className="font-display text-h3 text-ink">{c.name || c.email}</h1>
          {c.company && <p className="mt-1 text-body text-muted">{c.company}</p>}
        </div>

        <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-card border border-hair bg-hair">
          {stats.map(([label, val, cls]) => (
            <div key={label} className="bg-surface px-5 py-4">
              <p className="font-mono text-label uppercase text-dim">{label}</p>
              <p className={`mt-1 font-display text-h4 [font-variant-numeric:tabular-nums] ${cls}`}>
                {val}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-8 font-mono text-label uppercase text-dim">Contact</p>
        <div className="mt-2 grid gap-x-8 gap-y-2 sm:grid-cols-2">
          {contact
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="flex gap-2 text-body-sm">
                <span className="shrink-0 font-mono text-label uppercase text-dim">{k}:</span>
                <span className="break-all font-mono text-muted">{v}</span>
              </div>
            ))}
        </div>

        <p className="mt-8 font-mono text-label uppercase text-dim">
          Orders ({c.orders.length})
        </p>
        {c.orders.length === 0 ? (
          <p className="mt-2 text-body-sm text-muted">No orders yet.</p>
        ) : (
          <ul className="mt-2 overflow-hidden rounded-card border border-hair">
            {[...c.orders]
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .map((o) => (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-hair bg-surface px-5 py-3 first:border-t-0"
                >
                  <div className="min-w-0">
                    <p className="text-body-sm text-ink">
                      {o.products?.metadata?.code ? (
                        <span className="font-mono text-gold/80">
                          {o.products.metadata.code}{" "}
                        </span>
                      ) : null}
                      {o.products?.name ?? "Order"}
                    </p>
                    <p className="mt-0.5 font-mono text-label uppercase text-dim">
                      {when(o.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <span className={`font-mono text-label uppercase ${STATUS_CLS[o.status] ?? "text-muted"}`}>
                      {o.status}
                    </span>
                    <span className="font-mono text-body-sm font-bold text-ink [font-variant-numeric:tabular-nums]">
                      {money(o.amount_cents)}
                    </span>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-h3 text-ink">Customers</h1>
      <p className="mt-2 text-body text-muted">
        Everyone who has started a checkout. {rows.length} total.
      </p>
      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}

      {rows.length === 0 ? (
        <p className="mt-8 text-body text-muted">No customers yet.</p>
      ) : (
        <ul className="mt-6 overflow-hidden rounded-card border border-hair">
          {rows.map((c) => {
            const paid = c.orders.filter((o) => o.status === "paid");
            const spent = paid.reduce((s, o) => s + o.amount_cents, 0);
            return (
              <li key={c.id} className="border-t border-hair first:border-t-0">
                <button
                  type="button"
                  onClick={() => setOpen(c.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-2 bg-surface px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
                >
                  <div className="min-w-0">
                    <p className="text-body font-semibold text-ink">
                      {c.name || c.email}
                      {c.company && (
                        <span className="ml-3 font-mono text-body-sm text-muted">{c.company}</span>
                      )}
                    </p>
                    <p className="mt-0.5 font-mono text-label uppercase text-dim">{c.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <span className="font-mono text-label uppercase text-dim">
                      {paid.length} paid / {c.orders.length} order{c.orders.length === 1 ? "" : "s"}
                    </span>
                    <span className="font-mono text-price font-bold text-gold [font-variant-numeric:tabular-nums]">
                      {money(spent)}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
