"use client";

import { useEffect, useState } from "react";
import { money, supabase, when } from "./client";

type SubRow = {
  id: string;
  customer_email: string;
  plan_name: string | null;
  status: string;
  amount_cents: number;
  currency: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  customer: { name: string | null } | null;
};

const STATUS_STYLE: Record<string, string> = {
  active: "border-green/40 text-green",
  trialing: "border-gold/40 text-gold",
  past_due: "border-error/40 text-error",
  incomplete: "border-hair text-dim",
  canceled: "border-hair text-dim",
  unpaid: "border-error/40 text-error",
};

export function SubscriptionsScreen() {
  const [rows, setRows] = useState<SubRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase
      .from("subscriptions")
      .select("*, customer:customers(name)")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setErr(error.message);
        else setRows(data as SubRow[]);
        setLoaded(true);
      });
  }, []);

  if (!loaded) return <p className="text-body text-muted">Loading subscriptions...</p>;

  const active = rows.filter((r) => r.status === "active");
  const mrr = active.reduce((s, r) => s + r.amount_cents, 0);
  const summary: [string, string, string][] = [
    ["MRR", money(mrr), "text-gold"],
    ["Active", String(active.length), "text-green"],
    ["Total", String(rows.length), "text-muted"],
  ];

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-h3 text-ink">Subscriptions</h1>
      <p className="mt-2 text-body text-muted">Editing plans, newest first. {rows.length} total.</p>

      <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-card border border-hair bg-hair">
        {summary.map(([label, val, cls]) => (
          <div key={label} className="bg-surface px-5 py-4">
            <p className="font-mono text-label uppercase text-dim">{label}</p>
            <p className={`mt-1 font-display text-h4 [font-variant-numeric:tabular-nums] ${cls}`}>{val}</p>
          </div>
        ))}
      </div>

      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}

      {rows.length === 0 ? (
        <p className="mt-8 text-body text-muted">No subscriptions yet.</p>
      ) : (
        <ul className="mt-6 overflow-hidden rounded-card border border-hair">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-hair bg-surface px-5 py-4 first:border-t-0"
            >
              <div className="min-w-0">
                <p className="text-body font-semibold text-ink">
                  {r.customer?.name || r.customer_email}
                  <span className="ml-3 font-mono text-body-sm text-muted">{r.plan_name}</span>
                </p>
                <p className="mt-0.5 font-mono text-label uppercase text-dim">
                  {r.customer_email}
                  {r.current_period_end
                    ? ` / ${r.cancel_at_period_end ? "ends" : "renews"} ${when(r.current_period_end)}`
                    : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={`rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${STATUS_STYLE[r.status] ?? "border-hair text-dim"}`}
                >
                  {r.status}
                </span>
                <span className="font-mono text-price font-bold text-ink [font-variant-numeric:tabular-nums]">
                  {money(r.amount_cents, r.currency)}/mo
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
