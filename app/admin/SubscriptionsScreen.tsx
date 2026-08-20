"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Card, Chip, PageHeader } from "@/components/portal/ui";
import { money, supabase, when } from "./client";
import { SubscriptionDetail } from "./SubscriptionDetail";

/*
 * Every recurring plan, and nothing else.
 *
 * This screen is the commercial record for subscriptions, the way Orders is
 * for one-time sales. It used to also carry the studio's queue of editing
 * requests, which was the wrong home for it: a video request is production
 * work, so it lives on the Production board under Editing with the rest of
 * the work. Money here, work there, and neither screen makes you scroll past
 * the other's job to do your own.
 */

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

const TONE: Record<string, "good" | "warn" | "bad" | "neutral"> = {
  active: "good",
  trialing: "warn",
  past_due: "bad",
  unpaid: "bad",
  canceled: "neutral",
  incomplete: "neutral",
};

export function SubscriptionsScreen() {
  const [rows, setRows] = useState<SubRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  async function load() {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*, customer:customers(name)")
      .order("created_at", { ascending: false });
    if (error) setErr(error.message);
    else setRows(data as SubRow[]);
    setLoaded(true);
  }

  useEffect(() => {
    void load();
  }, []);

  /* A plan takes over the screen rather than opening a drawer: it carries
     the pack, every charge and every month, which never fitted in one. */
  if (open) {
    return (
      <SubscriptionDetail
        id={open}
        onBack={() => {
          setOpen(null);
          void load();
        }}
      />
    );
  }

  if (!loaded) return <p className="text-body text-muted">Loading subscriptions...</p>;

  const active = rows.filter((r) => r.status === "active");
  const mrr = active.reduce((s, r) => s + r.amount_cents, 0);

  return (
    <div className="w-full">
      <PageHeader
        title="Subscriptions"
        description="Recurring plans and their billing. Open one for the pack, the charges and the months. The editing work is in Production."
      />

      <div className="grid grid-cols-3 gap-3">
        {(
          [
            ["Recurring, per month", money(mrr), "text-gold"],
            ["Active", String(active.length), "text-green"],
            ["All time", String(rows.length), "text-ink"],
          ] as const
        ).map(([label, val, cls]) => (
          <Card key={label}>
            <p className="font-mono text-label uppercase text-dim">{label}</p>
            <p className={`mt-2 font-display text-h3 tabular-nums ${cls}`}>{val}</p>
          </Card>
        ))}
      </div>

      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}

      {rows.length === 0 ? (
        <p className="mt-8 text-body text-muted">No subscriptions yet.</p>
      ) : (
        <ul className="mt-3 overflow-hidden rounded-[12px] border border-hair">
          {rows.map((r) => (
            <li key={r.id} className="border-t border-hair first:border-t-0">
              <button
                type="button"
                onClick={() => setOpen(r.id)}
                className="tap flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-2 bg-surface px-5 py-4 text-left transition-colors hover:bg-card"
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
                  <Chip tone={TONE[r.status] ?? "neutral"}>{r.status.replace(/_/g, " ")}</Chip>
                  <span className="font-mono text-price font-bold tabular-nums text-ink">
                    {money(r.amount_cents, r.currency)}/mo
                  </span>
                  <ChevronRight size={16} className="text-dim" aria-hidden="true" />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
