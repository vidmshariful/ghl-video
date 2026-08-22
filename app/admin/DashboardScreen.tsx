"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  BadgeDollarSign,
  CalendarClock,
  ClipboardList,
  Clock3,
  MessageSquare,
  Repeat,
  ShoppingCart,
  Sparkles,
  Users,
} from "lucide-react";
import { authHeader, money, when } from "./client";
import type { View } from "./nav";

/*
 * The whole business at a glance, in three layers.
 *
 * It used to show money only, which meant the studio's real state, what is
 * sitting with a client, what has been paid for with no brief, what is
 * late, lived on five other screens and got found by accident. Now the
 * first thing on the page is what needs a person today, and it is only
 * there when something actually does.
 *
 * Everything is computed by /api/admin/dashboard in one call, rather than
 * pulling every order into the browser and adding them up here.
 */

type Dash = {
  needs: {
    withClient: number;
    projectsWithClient: number;
    noBrief: number;
    newEnquiries: number;
    unreadMessages: number;
    alarms: number;
    emailFails: number;
    lateProjects: number;
    lateVideos: number;
  };
  money: {
    allTimeCents: number;
    monthCents: number;
    mrrCents: number;
    owedCents: number;
    pipelineCents: number;
    openInvoices: number;
    liveSubscriptions: number;
  };
  work: {
    inProduction: number;
    revisions: number;
    queued: number;
    openProjects: number;
    byStage: { key: string; label: string; count: number }[];
    dueSoon: { kind: "project" | "video"; id: string; title: string; who: string; at: string }[];
  };
  people: { customers: number; newThisMonth: number };
  days: { key: string; label: string; cents: number }[];
  paidOrders: number;
  recentOrders: {
    id: string;
    email: string;
    name: string | null;
    product: string | null;
    amountCents: number;
    currency: string;
    status: string;
    at: string;
  }[];
  feedback: {
    id: string;
    video_title: string;
    verdict: string;
    note: string | null;
    customer_email: string;
    created_at: string;
  }[];
};

const STATUS_STYLE: Record<string, string> = {
  paid: "border-green/40 text-green",
  pending: "border-gold/40 text-gold",
  failed: "border-error/40 text-error",
  refunded: "border-hair text-dim",
};

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function DashboardScreen({ onNavigate }: { onNavigate: (v: View) => void }) {
  const [d, setD] = useState<Dash | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/dashboard", { headers: await authHeader() });
      const j = await r.json();
      if (!r.ok) return setErr(j.error ?? "Could not load the dashboard.");
      setD(j as Dash);
    } catch {
      setErr("Could not load the dashboard.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (err) return <p className="text-body text-error">{err}</p>;
  if (!d) return <p className="text-body text-muted">Loading...</p>;

  /* the action layer: only the rows that are actually true today */
  const needs = ([
    { label: "waiting on a client's approval", n: d.needs.withClient, to: "production", tone: "warn" },
    { label: "paid with no brief yet", n: d.needs.noBrief, to: "orders", tone: "bad" },
    { label: "past their due date", n: d.needs.lateVideos + d.needs.lateProjects, to: "production", tone: "bad" },
    { label: "new enquiries to answer", n: d.needs.newEnquiries, to: "custom", tone: "warn" },
    { label: "unread client messages", n: d.needs.unreadMessages, to: "messages", tone: "warn" },
    { label: "emails that failed to send", n: d.needs.emailFails, to: "emails", tone: "bad" },
    { label: "alarms nobody has cleared", n: d.needs.alarms, to: "health", tone: "bad" },
  ] as { label: string; n: number; to: View; tone: "warn" | "bad" }[]).filter((x) => x.n > 0);

  const stats = [
    {
      label: "Revenue, all time",
      value: money(d.money.allTimeCents),
      icon: <BadgeDollarSign />,
      chip: "bg-gold/10 text-gold",
      tone: "text-gold",
      to: "sales" as View,
    },
    {
      label: "Recurring, per month",
      value: money(d.money.mrrCents),
      icon: <Repeat />,
      chip: "bg-green/10 text-green",
      tone: "text-green",
      sub: `${d.money.liveSubscriptions} plan${d.money.liveSubscriptions === 1 ? "" : "s"} live`,
      to: "subscriptions" as View,
    },
    {
      label: "Invoiced, unpaid",
      value: money(d.money.owedCents),
      icon: <ShoppingCart />,
      chip: "bg-blue/10 text-blue",
      tone: d.money.owedCents ? "text-error" : "text-ink",
      sub: `${d.money.openInvoices} open`,
      to: "invoices" as View,
    },
    {
      label: "Agreed, not yet paid",
      value: money(d.money.pipelineCents),
      icon: <Clock3 />,
      chip: "bg-blue/10 text-blue",
      tone: "text-ink",
      sub: `${d.work.openProjects} custom job${d.work.openProjects === 1 ? "" : "s"}`,
      to: "custom" as View,
    },
  ];

  const max = Math.max(1, ...d.days.map((x) => x.cents));

  return (
    <div className="w-full">
      <h1 className="font-display text-h3 text-ink">Dashboard</h1>
      <p className="mt-0.5 text-body-sm text-muted">
        The business at a glance: what needs you, what the money is doing, and
        what the studio is making.
      </p>

      {/* ---- 1. what needs a person today ---- */}
      {needs.length > 0 && (
        <div className="mt-5 rounded-[12px] border border-gold/30 bg-gold/[0.04] p-4">
          <p className="font-mono text-label uppercase tracking-[0.08em] text-gold">
            Needs you today
          </p>
          <div className="mt-3 grid gap-1.5">
            {needs.map((x) => (
              <button
                key={x.label}
                type="button"
                onClick={() => onNavigate(x.to)}
                className="tap flex w-full items-center justify-between gap-3 rounded-[8px] px-2 py-1.5 text-left transition-colors hover:bg-surface"
              >
                <span className="flex min-w-0 items-baseline gap-2.5">
                  <span
                    className={`font-display text-h4 tabular-nums ${x.tone === "bad" ? "text-error" : "text-gold"}`}
                  >
                    {x.n}
                  </span>
                  <span className="truncate text-body-sm text-ink">{x.label}</span>
                </span>
                <ArrowUpRight size={14} className="shrink-0 text-dim" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---- 2. the money ---- */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onNavigate(s.to)}
            className="tap rounded-[12px] border border-hair bg-surface p-5 text-left transition-colors hover:border-gold/40"
          >
            <span className="flex items-center gap-2.5">
              <span
                className={`grid h-8 w-8 place-items-center rounded-[8px] ${s.chip} [&>svg]:h-[16px] [&>svg]:w-[16px]`}
              >
                {s.icon}
              </span>
              <span className="font-mono text-label uppercase text-dim">{s.label}</span>
            </span>
            <span className={`mt-3 block font-display text-h2 tabular-nums ${s.tone}`}>
              {s.value}
            </span>
            {s.sub && <span className="mt-1 block text-body-sm text-muted">{s.sub}</span>}
          </button>
        ))}
      </div>

      {/* ---- 3. thirty days ---- */}
      <div className="mt-3 rounded-[12px] border border-hair bg-surface p-5 md:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-h4 font-semibold text-ink">Last 30 days</h2>
          <p className="text-body-sm text-muted">
            <span className="font-semibold text-ink">{money(d.money.monthCents)}</span> across{" "}
            <span className="font-semibold text-ink">{d.paidOrders}</span> paid order
            {d.paidOrders === 1 ? "" : "s"} all time
          </p>
        </div>
        {d.money.monthCents === 0 ? (
          <p className="mt-4 text-body-sm text-dim">
            No paid orders in the last 30 days yet. New sales draw themselves here.
          </p>
        ) : (
          <div className="mt-5 flex h-28 items-end gap-[3px]" aria-hidden="true">
            {d.days.map((x) => (
              <div
                key={x.key}
                title={`${x.label}: ${money(x.cents)}`}
                className="flex-1 rounded-t-[3px] bg-gold/80"
                style={{
                  height: `${Math.max(2, (x.cents / max) * 100)}%`,
                  opacity: x.cents ? 1 : 0.15,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ---- 4. what the studio is making ---- */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-[12px] border border-hair bg-surface p-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-[8px] bg-blue/10 text-blue [&>svg]:h-[16px] [&>svg]:w-[16px]">
              <ClipboardList />
            </span>
            <h2 className="font-display text-h4 font-semibold text-ink">In the studio</h2>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { n: d.work.inProduction, l: "being made" },
              { n: d.work.revisions, l: "in revisions" },
              { n: d.work.queued, l: "queued" },
            ].map((x) => (
              <div key={x.l} className="rounded-[8px] border border-hair bg-canvas p-3">
                <p className="font-display text-h3 tabular-nums text-ink">{x.n}</p>
                <p className="font-mono text-label uppercase text-dim">{x.l}</p>
              </div>
            ))}
          </div>

          {d.work.byStage.length > 0 && (
            <div className="mt-4">
              <p className="font-mono text-label uppercase text-dim">Custom jobs by stage</p>
              <div className="mt-2 grid gap-1.5">
                {d.work.byStage.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => onNavigate("custom")}
                    className="tap flex items-center justify-between gap-3 rounded-[8px] border border-hair bg-canvas px-3 py-2 text-left transition-colors hover:border-gold/40"
                  >
                    <span className="text-body-sm text-ink">{s.label}</span>
                    <span className="font-mono text-label tabular-nums text-muted">{s.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => onNavigate("production")}
            className="tap mt-4 inline-flex items-center gap-1.5 font-mono text-label uppercase text-muted transition-colors hover:text-gold"
          >
            Open the studio board <ArrowUpRight size={13} aria-hidden="true" />
          </button>
        </div>

        <div className="rounded-[12px] border border-hair bg-surface p-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-[8px] bg-gold/10 text-gold [&>svg]:h-[16px] [&>svg]:w-[16px]">
              <CalendarClock />
            </span>
            <h2 className="font-display text-h4 font-semibold text-ink">Due in the next week</h2>
          </div>
          {d.work.dueSoon.length === 0 ? (
            <p className="mt-4 text-body-sm text-dim">
              Nothing promised in the next seven days.
            </p>
          ) : (
            <ul className="mt-4 grid gap-1.5">
              {d.work.dueSoon.map((x) => (
                <li
                  key={`${x.kind}-${x.id}`}
                  className="flex items-center justify-between gap-3 rounded-[8px] border border-hair bg-canvas px-3 py-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {x.kind === "project" ? (
                      <Sparkles size={13} className="shrink-0 text-gold" aria-hidden="true" />
                    ) : (
                      <ClipboardList size={13} className="shrink-0 text-blue" aria-hidden="true" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-body-sm text-ink">{x.title}</span>
                      {x.who && (
                        <span className="block truncate font-mono text-label uppercase text-dim">
                          {x.who}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-label uppercase text-muted">
                    {day(x.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ---- 5. people, and what they say ---- */}
      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="rounded-[12px] border border-hair bg-surface p-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-[8px] bg-green/10 text-green [&>svg]:h-[16px] [&>svg]:w-[16px]">
              <Users />
            </span>
            <h2 className="font-display text-h4 font-semibold text-ink">Clients</h2>
          </div>
          <p className="mt-3 font-display text-h2 tabular-nums text-ink">{d.people.customers}</p>
          <p className="mt-1 text-body-sm text-muted">
            {d.people.newThisMonth} new in the last 30 days
          </p>
          <button
            type="button"
            onClick={() => onNavigate("customers")}
            className="tap mt-3 inline-flex items-center gap-1.5 font-mono text-label uppercase text-muted transition-colors hover:text-gold"
          >
            Open clients <ArrowUpRight size={13} aria-hidden="true" />
          </button>
        </div>

        <div className="rounded-[12px] border border-hair bg-surface p-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-[8px] bg-gold/10 text-gold [&>svg]:h-[16px] [&>svg]:w-[16px]">
              <MessageSquare />
            </span>
            <h2 className="font-display text-h4 font-semibold text-ink">What clients say</h2>
          </div>
          {d.feedback.length === 0 ? (
            <p className="mt-4 text-body-sm text-dim">
              No answers to the one-question ask yet.
            </p>
          ) : (
            <ul className="mt-4 grid gap-2">
              {d.feedback.map((f) => (
                <li key={f.id} className="border-l border-hair pl-3">
                  <p className="text-body-sm text-ink">
                    {f.note || (f.verdict === "yes" ? "Happy with it." : "Not happy with it.")}
                  </p>
                  <p className="mt-0.5 font-mono text-label uppercase text-dim">
                    {f.video_title} / {f.customer_email} / {when(f.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ---- 6. recent orders ---- */}
      <div className="mt-3 rounded-[12px] border border-hair bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-h4 font-semibold text-ink">Recent orders</h2>
          <button
            type="button"
            onClick={() => onNavigate("orders")}
            className="tap inline-flex items-center gap-1.5 font-mono text-label uppercase text-muted transition-colors hover:text-gold"
          >
            View all <ArrowUpRight size={13} aria-hidden="true" />
          </button>
        </div>
        {d.recentOrders.length === 0 ? (
          <p className="mt-4 text-body-sm text-dim">No orders yet.</p>
        ) : (
          <ul className="mt-3 grid gap-1.5">
            {d.recentOrders.map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-hair bg-canvas px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-body-sm text-ink">
                    {o.name || o.email}
                    {o.product ? <span className="ml-2 text-dim">{o.product}</span> : null}
                  </span>
                  <span className="block font-mono text-label uppercase text-dim">
                    {when(o.at)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2.5">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${STATUS_STYLE[o.status] ?? "border-hair text-dim"}`}
                  >
                    {o.status}
                  </span>
                  <span className="font-mono text-body-sm font-bold tabular-nums text-ink">
                    {money(o.amountCents, o.currency)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
