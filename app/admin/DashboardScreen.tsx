"use client";

import { useEffect, useState } from "react";
import { money, supabase, when } from "./client";
import type { View } from "./nav";

type DashOrder = {
  id: string;
  customer_email: string;
  amount_cents: number;
  currency: string;
  status: string;
  highlevel_opportunity_id: string | null;
  created_at: string;
  product: { name: string } | null;
  customer: { name: string | null } | null;
};

export function DashboardScreen({ onNavigate }: { onNavigate: (v: View) => void }) {
  const [orders, setOrders] = useState<DashOrder[]>([]);
  const [customerCount, setCustomerCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select(
          "id,customer_email,amount_cents,currency,status,highlevel_opportunity_id,created_at, product:products(name), customer:customers(name)",
        )
        .order("created_at", { ascending: false });
      const { count } = await supabase
        .from("customers")
        .select("id", { count: "exact", head: true });
      // supabase types a to-one join as an array; at runtime it is a single
      // object, so cast through unknown.
      setOrders((data as unknown as DashOrder[]) ?? []);
      setCustomerCount(count ?? 0);
      setLoaded(true);
    })();
  }, []);

  if (!loaded) return <p className="text-body text-muted">Loading...</p>;

  const paid = orders.filter((o) => o.status === "paid");
  const revenue = paid.reduce((s, o) => s + o.amount_cents, 0);
  const pending = orders.filter((o) => o.status === "pending").length;
  const needsAttention = orders.filter(
    (o) => o.status === "paid" && !o.highlevel_opportunity_id,
  ).length;
  const recent = orders.slice(0, 6);

  const stats: [string, string, string][] = [
    ["Revenue", money(revenue), "text-gold"],
    ["Paid orders", String(paid.length), "text-green"],
    ["Customers", String(customerCount), "text-ink"],
    ["Pending", String(pending), "text-muted"],
  ];

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-h3 text-ink">Dashboard</h1>
      <p className="mt-2 text-body text-muted">The business at a glance.</p>

      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-hair bg-hair sm:grid-cols-4">
        {stats.map(([label, val, cls]) => (
          <div key={label} className="bg-surface px-5 py-5">
            <p className="font-mono text-label uppercase text-dim">{label}</p>
            <p className={`mt-1 font-display text-h3 [font-variant-numeric:tabular-nums] ${cls}`}>
              {val}
            </p>
          </div>
        ))}
      </div>

      {needsAttention > 0 && (
        <button
          type="button"
          onClick={() => onNavigate("orders")}
          className="mt-4 block w-full rounded-[8px] border border-error/40 bg-error/[0.06] px-4 py-3 text-left text-body-sm text-muted transition-colors hover:border-error/70"
        >
          {needsAttention} paid order{needsAttention > 1 ? "s" : ""}{" "}
          {needsAttention > 1 ? "have" : "has"} not synced to HighLevel. Open
          Orders to re-sync.
        </button>
      )}

      <div className="mt-8 flex items-baseline justify-between">
        <h2 className="font-display text-h4 font-semibold text-ink">Recent orders</h2>
        <button
          type="button"
          onClick={() => onNavigate("orders")}
          className="font-mono text-label uppercase text-muted transition-colors hover:text-gold"
        >
          View all &rarr;
        </button>
      </div>

      {recent.length === 0 ? (
        <p className="mt-4 text-body text-muted">No orders yet.</p>
      ) : (
        <ul className="mt-3 overflow-hidden rounded-card border border-hair">
          {recent.map((o) => (
            <li
              key={o.id}
              className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-hair bg-surface px-5 py-3.5 first:border-t-0"
            >
              <div className="min-w-0">
                <p className="text-body font-semibold text-ink">
                  {o.customer?.name || o.customer_email}
                  <span className="ml-3 font-mono text-body-sm text-muted">
                    {o.product?.name ?? ""}
                  </span>
                </p>
                <p className="mt-0.5 font-mono text-label uppercase text-dim">{when(o.created_at)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-mono text-label uppercase text-dim">{o.status}</span>
                <span className="font-mono text-price font-bold text-ink [font-variant-numeric:tabular-nums]">
                  {money(o.amount_cents, o.currency)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
