"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, BadgeDollarSign, Clock3, ShoppingCart, Users } from "lucide-react";
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

const STATUS_STYLE: Record<string, string> = {
  paid: "border-green/40 text-green",
  pending: "border-gold/40 text-gold",
  failed: "border-error/40 text-error",
  refunded: "border-hair text-dim",
};

type DayPoint = { key: string; label: string; cents: number };

export function DashboardScreen({ onNavigate }: { onNavigate: (v: View) => void }) {
  const [orders, setOrders] = useState<DashOrder[]>([]);
  const [customerCount, setCustomerCount] = useState(0);
  const [chart, setChart] = useState<{ days: DayPoint[]; monthCents: number; monthOrders: number }>(
    { days: [], monthCents: 0, monthOrders: 0 },
  );
  const [loaded, setLoaded] = useState(false);
  const [feedback, setFeedback] = useState<
    { id: string; video_title: string; verdict: string; note: string | null; customer_email: string; created_at: string }[]
  >([]);

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
      /* the one-question ask's answers; skips are silence and stay out */
      const { data: fb } = await supabase
        .from("video_feedback")
        .select("id, video_title, verdict, note, customer_email, created_at")
        .neq("verdict", "skipped")
        .order("created_at", { ascending: false })
        .limit(5);
      setFeedback((fb as typeof feedback) ?? []);
      // supabase types a to-one join as an array; at runtime it is a single
      // object, so cast through unknown.
      const rows = (data as unknown as DashOrder[]) ?? [];
      setOrders(rows);
      setCustomerCount(count ?? 0);

      /* last 30 days of PAID revenue, day by day (computed here at load
         time, not in render, to keep render pure for the compiler) */
      const paidRows = rows.filter((o) => o.status === "paid");
      const days: DayPoint[] = [];
      const now = new Date();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        days.push({
          key: d.toDateString(),
          label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          cents: 0,
        });
      }
      for (const o of paidRows) {
        const key = new Date(o.created_at).toDateString();
        const slot = days.find((d) => d.key === key);
        if (slot) slot.cents += o.amount_cents;
      }
      setChart({
        days,
        monthCents: days.reduce((s, d) => s + d.cents, 0),
        monthOrders: paidRows.filter(
          (o) => now.getTime() - new Date(o.created_at).getTime() < 30 * 86_400_000,
        ).length,
      });
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
  const recent = orders.slice(0, 7);
  const { days, monthCents, monthOrders } = chart;
  const maxDay = Math.max(1, ...days.map((d) => d.cents));

  const stats = [
    {
      label: "Revenue, all time",
      value: money(revenue),
      icon: <BadgeDollarSign />,
      tone: "text-gold",
      chip: "bg-gold/12 text-gold",
    },
    {
      label: "Paid orders",
      value: String(paid.length),
      icon: <ShoppingCart />,
      tone: "text-green",
      chip: "bg-green/12 text-green",
    },
    {
      label: "Customers",
      value: String(customerCount),
      icon: <Users />,
      tone: "text-ink",
      chip: "bg-blue/12 text-blue",
    },
    {
      // pending is money in flight, not a disabled state: it gets gold
      label: "Pending orders",
      value: String(pending),
      icon: <Clock3 />,
      tone: "text-gold",
      chip: "bg-gold/12 text-gold",
    },
  ];

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-h2 text-ink">Dashboard</h1>
          <p className="mt-1 text-body text-muted">The business at a glance.</p>
        </div>
      </div>

      {/* stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-[12px] border border-hair bg-surface p-6">
            <div className="flex items-center gap-2.5">
              <span
                className={`grid h-8 w-8 place-items-center rounded-[8px] ${s.chip} [&>svg]:h-[16px] [&>svg]:w-[16px]`}
              >
                {s.icon}
              </span>
              <p className="font-mono text-label uppercase text-dim">{s.label}</p>
            </div>
            <p
              className={`mt-3 font-display text-h2 [font-variant-numeric:tabular-nums] ${s.tone}`}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {needsAttention > 0 && (
        <button
          type="button"
          onClick={() => onNavigate("orders")}
          className="mt-4 flex w-full flex-wrap items-center justify-between gap-3 rounded-[12px] border border-error/40 bg-error/[0.06] px-4 py-3 text-left text-body-sm text-ink transition-colors hover:border-error/70"
        >
          <span>
            {needsAttention} paid order{needsAttention > 1 ? "s" : ""}{" "}
            {needsAttention > 1 ? "have" : "has"} not synced to HighLevel.
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-[8px] border border-error/50 px-3 py-1.5 font-mono text-label font-bold uppercase text-error">
            Open Orders <ArrowUpRight size={13} />
          </span>
        </button>
      )}

      {/* last 30 days */}
      <div className="mt-6 rounded-[12px] border border-hair bg-surface p-5 md:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-h4 font-semibold text-ink">Last 30 days</h2>
          <p className="text-body-sm text-muted">
            <span className="font-semibold text-ink">{money(monthCents)}</span> across{" "}
            <span className="font-semibold text-ink">{monthOrders}</span> paid order
            {monthOrders === 1 ? "" : "s"}
          </p>
        </div>
        {monthCents === 0 ? (
          <p className="mt-4 text-body-sm text-dim">
            No paid orders in the last 30 days yet. New sales draw themselves here.
          </p>
        ) : (
          <div className="mt-5 flex h-28 items-end gap-[3px]" aria-hidden="true">
            {days.map((d) => (
              <div
                key={d.key}
                title={`${d.label}: ${money(d.cents)}`}
                className="flex-1 rounded-t-[3px] bg-gold/80"
                style={{
                  height: `${Math.max(3, (d.cents / maxDay) * 100)}%`,
                  opacity: d.cents ? 1 : 0.16,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* what clients said when we asked whether the video performed */}
      {feedback.length > 0 && (
        <div className="mt-6 rounded-[12px] border border-hair bg-surface">
          <div className="border-b border-hair px-5 py-4">
            <h2 className="font-display text-h4 font-semibold text-ink">What clients say</h2>
            <p className="mt-0.5 text-body-sm text-muted">
              Answers to the after-delivery question. The good ones are
              testimonials waiting for permission.
            </p>
          </div>
          <ul>
            {feedback.map((f) => (
              <li
                key={f.id}
                className="border-t border-hair px-5 py-3.5 first:border-t-0"
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${
                      f.verdict === "working"
                        ? "border-green/50 text-green"
                        : f.verdict === "not_really"
                          ? "border-error/50 text-error"
                          : "border-hair text-dim"
                    }`}
                  >
                    {f.verdict === "working"
                      ? "It's working"
                      : f.verdict === "not_really"
                        ? "Not really"
                        : "Too early"}
                  </span>
                  <span className="text-body-sm font-semibold text-ink">{f.video_title}</span>
                  <span className="font-mono text-label text-dim">{f.customer_email}</span>
                  <span className="ml-auto font-mono text-label uppercase text-dim">
                    {when(f.created_at)}
                  </span>
                </div>
                {f.note && <p className="mt-1.5 text-body-sm text-muted">{f.note}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* recent orders */}
      <div className="mt-6 rounded-[12px] border border-hair bg-surface">
        <div className="flex items-baseline justify-between border-b border-hair px-5 py-4">
          <h2 className="font-display text-h4 font-semibold text-ink">Recent orders</h2>
          <button
            type="button"
            onClick={() => onNavigate("orders")}
            className="tap inline-flex items-center gap-1 font-mono text-label uppercase text-muted transition-colors hover:text-gold"
          >
            View all <ArrowUpRight size={13} />
          </button>
        </div>
        {recent.length === 0 ? (
          <p className="px-5 py-6 text-body text-muted">No orders yet.</p>
        ) : (
          <ul>
            {recent.map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-hair px-5 py-3.5 first:border-t-0"
              >
                <div className="min-w-0">
                  <p className="text-body font-semibold text-ink">
                    {o.customer?.name || o.customer_email}
                    <span className="ml-3 font-mono text-body-sm text-muted">
                      {o.product?.name ?? ""}
                    </span>
                  </p>
                  <p className="mt-0.5 font-mono text-label uppercase text-dim">
                    {when(o.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${STATUS_STYLE[o.status] ?? "border-hair text-dim"}`}
                  >
                    {o.status}
                  </span>
                  <span className="font-mono text-price font-bold text-ink [font-variant-numeric:tabular-nums]">
                    {money(o.amount_cents, o.currency)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
