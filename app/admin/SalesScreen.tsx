"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Chip, PageHeader, Table, Td, Th, Toolbar } from "@/components/portal/ui";
import { authHeader, money, when } from "./client";

/*
 * Every money number, and the only screen that carries them.
 *
 * They used to be spread across the client list, the custom video board and
 * the main dashboard, which is how two screens end up disagreeing and how
 * business figures land in front of somebody who opened a screen to do a job.
 * Per-client and per-project money stays where it is, because that is about
 * one client or one piece of work. Aggregates live here.
 */

type Stream = "all" | "premade" | "addon" | "custom" | "subscription";

type Data = {
  totals: {
    allTimeCents: number;
    premadeCents: number;
    addOnCents: number;
    customCents: number;
    subscriptionCents: number;
    mrrCents: number;
    outstandingCents: number;
    pipelineCents: number;
    refundedCents: number;
  };
  counts: {
    premade: number;
    addon: number;
    custom: number;
    liveSubscriptions: number;
    openProjects: number;
  };
  plans: { name: string; mrrCents: number; live: number }[];
  months: { key: string; label: string; premade: number; addon: number; custom: number }[];
  recent: { kind: string; amountCents: number; at: string; email: string; name: string }[];
};

const STREAMS: { key: Stream; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "premade", label: "Premade" },
  { key: "custom", label: "Custom" },
  { key: "addon", label: "Add-ons" },
  { key: "subscription", label: "Subscriptions" },
];

const KIND_TONE: Record<string, "info" | "warn" | "good"> = {
  premade: "info",
  addon: "warn",
  custom: "good",
};

export function SalesScreen() {
  const [data, setData] = useState<Data | null>(null);
  const [stream, setStream] = useState<Stream>("all");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/sales", { headers: await authHeader() });
      const j = await r.json();
      if (!r.ok) return setErr(j.error ?? "Could not load sales.");
      setData(j as Data);
    } catch {
      setErr("Could not load sales.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /* the bars, filtered to whichever stream is selected */
  const bars = useMemo(() => {
    if (!data) return [];
    return data.months.map((m) => ({
      label: m.label,
      cents:
        stream === "all"
          ? m.premade + m.addon + m.custom
          : stream === "subscription"
            ? 0
            : (m[stream as "premade" | "addon" | "custom"] ?? 0),
    }));
  }, [data, stream]);

  if (err) return <p className="text-body text-error">{err}</p>;
  if (!data) return <p className="text-body text-muted">Loading...</p>;

  const t = data.totals;
  const headline =
    stream === "all"
      ? t.allTimeCents
      : stream === "premade"
        ? t.premadeCents
        : stream === "addon"
          ? t.addOnCents
          : stream === "custom"
            ? t.customCents
            : t.subscriptionCents;

  const max = Math.max(1, ...bars.map((b) => b.cents));
  const recent =
    stream === "all" || stream === "subscription"
      ? data.recent
      : data.recent.filter((r) => r.kind === stream);

  return (
    <div className="w-full">
      <PageHeader
        title="Sales"
        description="What the business has made, and what it is still owed. The only screen that keeps these."
      />

      <Toolbar
        right={
          <div className="flex flex-wrap gap-1.5">
            {STREAMS.map((s) => (
              <Button
                key={s.key}
                size="sm"
                variant={stream === s.key ? "primary" : "secondary"}
                onClick={() => setStream(s.key)}
              >
                {s.label}
              </Button>
            ))}
          </div>
        }
      >
        <p className="text-body-sm text-muted">
          {stream === "all" ? "Every stream together." : `Filtered to ${stream}.`}
        </p>
      </Toolbar>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="font-mono text-label uppercase text-dim">
            {stream === "all" ? "Billed, all time" : "Billed in this stream"}
          </p>
          <p className="mt-2 font-display text-h2 tabular-nums text-gold">{money(headline)}</p>
          {t.refundedCents > 0 && stream === "all" && (
            <p className="mt-1 text-body-sm text-muted">{money(t.refundedCents)} refunded</p>
          )}
        </Card>
        <Card>
          <p className="font-mono text-label uppercase text-dim">Recurring, per month</p>
          <p className="mt-2 font-display text-h2 tabular-nums text-green">{money(t.mrrCents)}</p>
          <p className="mt-1 text-body-sm text-muted">
            {data.counts.liveSubscriptions} plan
            {data.counts.liveSubscriptions === 1 ? "" : "s"} live
          </p>
        </Card>
        <Card>
          <p className="font-mono text-label uppercase text-dim">Agreed, not yet paid</p>
          <p className="mt-2 font-display text-h2 tabular-nums text-ink">
            {money(t.pipelineCents)}
          </p>
          <p className="mt-1 text-body-sm text-muted">
            {data.counts.openProjects} custom project
            {data.counts.openProjects === 1 ? "" : "s"} open
          </p>
        </Card>
        <Card>
          <p className="font-mono text-label uppercase text-dim">Invoiced, unpaid</p>
          <p
            className={`mt-2 font-display text-h2 tabular-nums ${t.outstandingCents ? "text-error" : "text-ink"}`}
          >
            {money(t.outstandingCents)}
          </p>
          <p className="mt-1 text-body-sm text-muted">
            {t.outstandingCents ? "worth chasing" : "nothing outstanding"}
          </p>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_20rem] lg:items-start">
        <Card title="Twelve months">
          {bars.every((b) => b.cents === 0) ? (
            <p className="text-body-sm text-muted">
              {stream === "subscription"
                ? "Subscription revenue is recurring, so it is not charted by month here. The figures above cover it."
                : "Nothing billed in this stream yet."}
            </p>
          ) : (
            <>
              {/* the bar's percentage height needs a parent with a real height,
                  so the column stretches and the label sits outside it */}
              <div className="flex items-end gap-1.5" aria-hidden="true">
                {bars.map((b) => (
                  <div key={b.label} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="flex h-32 w-full items-end">
                      <div
                        title={`${b.label}: ${money(b.cents)}`}
                        className="w-full rounded-t-[3px] bg-gold/80"
                        style={{
                          height: `${Math.max(2, (b.cents / max) * 100)}%`,
                          opacity: b.cents ? 1 : 0.15,
                        }}
                      />
                    </div>
                    <span className="font-mono text-label uppercase text-dim">{b.label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-body-sm text-muted">
                Best month {money(max)}. One-time sales are dated by when they were paid.
              </p>
            </>
          )}
        </Card>

        <div className="grid gap-3">
          <Card title="Where it comes from">
            <div className="grid gap-2 text-body-sm">
              {[
                ["Premade", t.premadeCents, data.counts.premade],
                ["Custom", t.customCents, data.counts.custom],
                ["Add-ons", t.addOnCents, data.counts.addon],
                ["Subscriptions", t.subscriptionCents, data.counts.liveSubscriptions],
              ].map(([label, cents, count]) => (
                <span key={String(label)} className="flex items-baseline justify-between gap-3">
                  <span className="text-muted">
                    {label}
                    <span className="ml-1.5 font-mono text-label text-dim">{count}</span>
                  </span>
                  <span className="tabular-nums text-ink">{money(Number(cents))}</span>
                </span>
              ))}
            </div>
          </Card>

          {data.plans.length > 0 && (
            <Card title="Plans">
              <div className="grid gap-2 text-body-sm">
                {data.plans.map((p) => (
                  <span key={p.name} className="flex items-baseline justify-between gap-3">
                    <span className="text-muted">
                      {p.name}
                      <span className="ml-1.5 font-mono text-label text-dim">{p.live}</span>
                    </span>
                    <span className="tabular-nums text-ink">{money(p.mrrCents)}</span>
                  </span>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      <div className="mt-3">
        <Card title="Recent sales" padded={false}>
          <div className="px-5 pb-5">
            {recent.length === 0 ? (
              <p className="py-3 text-body-sm text-muted">Nothing in this stream yet.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>What</Th>
                    <Th>Stream</Th>
                    <Th align="right">Amount</Th>
                    <Th align="right">Paid</Th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r, i) => (
                    <tr key={`${r.at}-${i}`}>
                      <Td strong>
                        {r.name}
                        <span className="block font-mono text-label uppercase text-dim">
                          {r.email}
                        </span>
                      </Td>
                      <Td>
                        <Chip tone={KIND_TONE[r.kind] ?? "neutral"}>{r.kind}</Chip>
                      </Td>
                      <Td align="right">{money(r.amountCents)}</Td>
                      <Td align="right">{when(r.at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
