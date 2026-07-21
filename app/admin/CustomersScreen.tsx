"use client";

import { useEffect, useState } from "react";
import { money, supabase, when } from "./client";

type CustomerRow = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  created_at: string;
  orders: { id: string; amount_cents: number; status: string; created_at: string }[];
};

export function CustomersScreen() {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("customers")
      .select("id,email,name,company,phone,created_at, orders(id,amount_cents,status,created_at)")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setErr(error.message);
        else setRows(data as CustomerRow[]);
        setLoaded(true);
      });
  }, []);

  if (!loaded) return <p className="text-body text-muted">Loading customers...</p>;

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
            const isOpen = open === c.id;
            return (
              <li key={c.id} className="border-t border-hair first:border-t-0">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : c.id)}
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
                {isOpen && (
                  <div className="border-t border-hair bg-canvas px-5 py-4">
                    {c.phone && (
                      <p className="mb-3 text-body-sm text-muted">
                        <span className="font-mono text-label uppercase text-dim">Phone: </span>
                        {c.phone}
                      </p>
                    )}
                    {c.orders.length === 0 ? (
                      <p className="text-body-sm text-muted">No orders.</p>
                    ) : (
                      <ul className="grid gap-1.5">
                        {[...c.orders]
                          .sort((a, b) => b.created_at.localeCompare(a.created_at))
                          .map((o) => (
                            <li key={o.id} className="flex items-baseline gap-3 text-body-sm">
                              <span className="w-32 shrink-0 font-mono text-dim">{when(o.created_at)}</span>
                              <span className="w-20 font-mono uppercase text-muted">{o.status}</span>
                              <span className="font-mono text-muted [font-variant-numeric:tabular-nums]">
                                {money(o.amount_cents)}
                              </span>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
