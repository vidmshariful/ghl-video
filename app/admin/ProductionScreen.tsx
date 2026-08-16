"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, money, when } from "./client";
import { authHeader } from "./client";
import { ProductionJob } from "./ProductionJob";
import { StudioQueue } from "./StudioQueue";
import type { View } from "./nav";

/*
 * The production pipeline: every paid order that still needs work, grouped
 * by fulfillment stage, so the producer runs the day from one screen. Move
 * a card forward or back, jump to the full order in Orders, or open the
 * client's chat. Moving a card to Delivered fires the real delivery email
 * and bell (the fulfillment route's exactly-once flip), so that move means
 * "the client has their files".
 */

type Row = {
  id: string;
  customer_email: string;
  amount_cents: number;
  currency: string;
  fulfillment_stage: string;
  intake_completed: boolean;
  assigned_manager: string | null;
  assigned_admin_email: string | null;
  created_at: string;
  stage_changed_at: string;
  customers: { name: string | null } | null;
  products: { name: string; sku: string; metadata: Record<string, unknown> | null } | null;
};

const STAGES = [
  { key: "paid", label: "Paid" },
  { key: "intake", label: "Intake" },
  { key: "production", label: "In production" },
  { key: "review", label: "Review" },
  { key: "delivered", label: "Delivered" },
] as const;

/* what was bought, said plainly (mirrors the email label) */
function label(p: Row["products"]): string {
  if (!p) return "Order";
  const md = p.metadata ?? {};
  const kind = typeof md.kind === "string" ? md.kind : null;
  const vt =
    typeof md.video_type === "string" && md.video_type
      ? md.video_type
      : typeof md.category === "string"
        ? (md.category as string)
        : null;
  if (kind === "video") return `${vt ? `${vt} ` : ""}Video: ${p.name}`;
  if (kind === "pack") return `${vt ? `${vt} ` : "Video "}Pack: ${p.name}`;
  if (kind === "bundle") return `Bundle: ${p.name}`;
  return p.name;
}

const daysIn = (iso: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

export function ProductionScreen({ onNavigate }: { onNavigate: (v: View) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [openJob, setOpenJob] = useState<string | null>(null);
  const [view, setView] = useState<"queue" | "board">("queue");
  const [q, setQ] = useState("");
  const [mine, setMine] = useState(false);
  const [me, setMe] = useState("");
  // videos done / owed per order, for the chip on each card
  const [videos, setVideos] = useState<Record<string, { done: number; total: number }>>({});

  const load = useCallback(async () => {
    // active work plus the last two weeks of deliveries for a done column
    const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, customer_email, amount_cents, currency, fulfillment_stage, intake_completed, assigned_manager, assigned_admin_email, created_at, stage_changed_at, customers(name), products(name, sku, metadata)",
      )
      .eq("status", "paid")
      .or(`fulfillment_stage.neq.delivered,stage_changed_at.gte.${since}`)
      .neq("archived", true)
      .order("created_at", { ascending: true });
    if (error) {
      setErr(error.message);
      return;
    }
    const list = (data ?? []) as unknown as Row[];
    setRows(list);

    // One query for every card's video counts rather than one per card.
    const { data: ds } = await supabase
      .from("order_deliverables")
      .select("order_id, status")
      .in("order_id", list.map((r) => r.id));
    const tally: Record<string, { done: number; total: number }> = {};
    for (const d of ds ?? []) {
      const t = (tally[d.order_id as string] ??= { done: 0, total: 0 });
      t.total++;
      if (d.status === "ready" || d.status === "approved") t.done++;
    }
    setVideos(tally);
  }, []);

  useEffect(() => {
    load();
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.email ?? ""));
  }, [load]);

  async function move(row: Row, dir: 1 | -1) {
    const idx = STAGES.findIndex((s) => s.key === row.fulfillment_stage);
    const next = STAGES[idx + dir];
    if (!next) return;
    if (
      next.key === "delivered" &&
      !confirm(
        `Deliver ${label(row.products)} to ${row.customers?.name ?? row.customer_email}? This sends the delivery email.`,
      )
    )
      return;
    setBusyId(row.id);
    setErr("");
    try {
      const r = await fetch(`/api/admin/orders/${row.id}/fulfillment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ stage: next.key }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErr(j.error ?? "Could not move the order.");
      } else await load();
    } catch {
      setErr("Could not move the order.");
    }
    setBusyId(null);
  }

  /* Search covers the things somebody actually remembers: the client, the
     invoice they were sent, and what they bought. */
  const term = q.trim().toLowerCase();
  const visible = (rows ?? []).filter((r) => {
    if (mine && r.assigned_admin_email !== me) return false;
    if (!term) return true;
    return [
      r.customers?.name,
      r.customer_email,
      r.products?.name,
      r.products?.sku,
      r.assigned_manager,
    ]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(term));
  });
  const byStage = (key: string) => visible.filter((r) => r.fulfillment_stage === key);

  // A job takes over the screen rather than opening in a drawer: it carries
  // the brief, every video, and the client timeline, and phase 6 adds feedback
  // threads on top of that.
  if (openJob) {
    return (
      <ProductionJob
        id={openJob}
        onBack={() => {
          setOpenJob(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-h2 text-ink">Production</h1>
          <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
            Every paid order that needs work. Open a job to set each video and
            post updates. Stages follow the videos on their own; delivering is
            the one step somebody presses.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("orders")}
          className="tap rounded-[8px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
        >
          Full order records
        </button>
      </div>

      <div className="mt-6 flex gap-1 border-b border-hair">
        {(
          [
            { key: "queue", label: "What needs us" },
            { key: "board", label: "The board" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setView(t.key)}
            className={`tap rounded-t-[8px] px-4 py-2.5 text-body-sm transition-colors ${
              view === t.key
                ? "border border-b-0 border-hair bg-surface font-semibold text-gold"
                : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === "queue" ? (
        <div className="mt-6">
          <StudioQueue onOpenJob={setOpenJob} />
        </div>
      ) : (
        <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find a client, invoice or product"
          className="tap min-w-[16rem] flex-1 rounded-[8px] border border-hair bg-canvas px-3 py-2 text-body-sm text-ink placeholder:text-dim"
        />
        <button
          type="button"
          onClick={() => setMine((m) => !m)}
          className={`tap rounded-[8px] border px-3.5 py-2 font-mono text-label uppercase transition-colors ${
            mine ? "border-gold text-gold" : "border-hair text-muted hover:border-gold/60 hover:text-gold"
          }`}
        >
          Only my jobs
        </button>
        {(term || mine) && (
          <span className="font-mono text-label uppercase tracking-[0.1em] text-dim">
            {visible.length} of {(rows ?? []).length}
          </span>
        )}
      </div>

      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}
      {rows === null ? (
        <p className="mt-8 text-body text-muted">Loading the board...</p>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {STAGES.map((s) => {
            const items = byStage(s.key);
            return (
              <div key={s.key} className="min-w-0">
                <div className="flex items-center justify-between rounded-t-[12px] border border-hair bg-surface px-4 py-2.5">
                  <span className="font-mono text-label font-bold uppercase tracking-[0.1em] text-muted">
                    {s.label}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-label font-bold leading-none ${
                      items.length > 0 && s.key !== "delivered"
                        ? "bg-gold text-canvas"
                        : "bg-hair/60 text-muted"
                    }`}
                  >
                    {items.length}
                  </span>
                </div>
                <div className="grid gap-2 rounded-b-[12px] border border-t-0 border-hair bg-canvas/40 p-2">
                  {items.length === 0 ? (
                    <p className="px-2 py-6 text-center text-body-sm text-dim">Empty</p>
                  ) : (
                    items.map((r) => (
                      <div key={r.id} className="rounded-[8px] border border-hair bg-surface p-3.5">
                        <p className="font-mono text-label uppercase tracking-[0.1em] text-gold/80">
                          {(r.products?.metadata?.code as string) ?? r.products?.sku?.toUpperCase()}
                        </p>
                        <button
                          type="button"
                          onClick={() => setOpenJob(r.id)}
                          className="tap mt-0.5 block w-full text-left text-body-sm font-semibold leading-snug text-ink transition-colors hover:text-gold"
                        >
                          {label(r.products)}
                        </button>
                        <p className="mt-1 truncate text-body-sm text-muted">
                          {r.customers?.name || r.customer_email}
                        </p>
                        <p className="mt-1 font-mono text-label uppercase text-dim">
                          {money(r.amount_cents, r.currency)} / {when(r.created_at)}
                          {s.key !== "delivered" && daysIn(r.stage_changed_at) >= 3
                            ? ` / ${daysIn(r.stage_changed_at)}d in stage`
                            : ""}
                        </p>
                        {s.key === "intake" ? (
                          <p
                            className={`mt-1.5 inline-flex rounded-full border px-2 py-0.5 font-mono text-label uppercase ${
                              r.intake_completed
                                ? "border-green/40 text-green"
                                : "border-gold/40 text-gold"
                            }`}
                          >
                            {r.intake_completed ? "Brief in" : "Waiting on brief"}
                          </p>
                        ) : null}
                        {videos[r.id]?.total ? (
                          <button
                            type="button"
                            onClick={() => setOpenJob(r.id)}
                            className={`tap mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-label uppercase transition-colors ${
                              videos[r.id].done === videos[r.id].total
                                ? "border-green/40 text-green hover:border-green"
                                : "border-hair text-muted hover:border-gold/60 hover:text-gold"
                            }`}
                          >
                            {videos[r.id].done}/{videos[r.id].total} videos ready
                          </button>
                        ) : null}
                        <div className="mt-2.5 flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={busyId === r.id || s.key === "paid"}
                            onClick={() => move(r, -1)}
                            aria-label="Move back a stage"
                            className="tap rounded-[8px] border border-hair px-2 py-1 font-mono text-label text-muted transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-40"
                          >
                            &#8592;
                          </button>
                          <button
                            type="button"
                            disabled={busyId === r.id || s.key === "delivered"}
                            onClick={() => move(r, 1)}
                            aria-label="Move forward a stage"
                            className="tap rounded-[8px] border border-hair px-2 py-1 font-mono text-label text-muted transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-40"
                          >
                            &#8594;
                          </button>
                          <button
                            type="button"
                            onClick={() => onNavigate("messages")}
                            className="tap ml-auto rounded-[8px] border border-hair px-2.5 py-1 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
                          >
                            Chat
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}
    </div>
  );
}
