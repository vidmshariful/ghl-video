"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, money, when } from "./client";
import { authHeader } from "./client";
import { ProductionJob } from "./ProductionJob";
import { StudioQueue } from "./StudioQueue";
import type { View } from "./nav";
import { BOARD_COLUMNS, boardColumn, type BoardColumn } from "@/lib/premade-board";

/*
 * The production pipeline: every paid order that still needs work, in
 * columns read from the work itself (the brief, the videos, delivered), so
 * the producer runs the day from one screen. Nothing on a card moves it by
 * hand any more: the arrows and the stage dropdown wrote one record from two
 * places (Premade review, 16 September 2026). A card in "Waiting on brief"
 * can be nudged or have its emailed brief entered; one in "With the client"
 * can be nudged or approved for them.
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
  customers: { id: string; name: string | null } | null;
  products: { name: string; sku: string; metadata: Record<string, unknown> | null } | null;
};

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

export function ProductionScreen({
  onNavigate,
  onOpenProject,
  onOpenEditing,
}: {
  onNavigate: (v: View) => void;
  /* the studio queue lists custom and plan work too, and those open on
     screens this one does not own */
  onOpenProject: (projectId: string) => void;
  onOpenEditing: (slug: string) => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [openJob, setOpenJob] = useState<string | null>(null);
  const [view, setView] = useState<"queue" | "board">("queue");
  const [q, setQ] = useState("");
  const [mine, setMine] = useState(false);
  const [me, setMe] = useState("");
  // videos done / owed per order, for the chip on each card
  const [videos, setVideos] = useState<Record<string, { done: number; total: number; signed: number }>>({});

  const load = useCallback(async () => {
    // active work plus the last two weeks of deliveries for a done column
    const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, customer_email, amount_cents, currency, fulfillment_stage, intake_completed, assigned_manager, assigned_admin_email, created_at, stage_changed_at, customers(id, name), products(name, sku, metadata)",
      )
      .eq("status", "paid")
      .or(`fulfillment_stage.neq.delivered,stage_changed_at.gte.${since}`)
      .neq("archived", true)
      .order("created_at", { ascending: true });
    if (error) {
      setErr(error.message);
      return;
    }
    /* an invoice payment is money, not a job: the work it paid for lives on
       its projects, and it has no place on this board */
    const list = ((data ?? []) as unknown as Row[]).filter(
      (r) => !(r.products?.metadata as { invoice?: unknown } | null)?.invoice,
    );
    setRows(list);

    // One query for every card's video counts rather than one per card.
    const { data: ds } = await supabase
      .from("order_deliverables")
      .select("order_id, status")
      .in("order_id", list.map((r) => r.id));
    const tally: Record<string, { done: number; total: number; signed: number }> = {};
    for (const d of ds ?? []) {
      const t = (tally[d.order_id as string] ??= { done: 0, total: 0, signed: 0 });
      t.total++;
      if (d.status === "ready" || d.status === "approved") t.done++;
      if (d.status === "approved") t.signed++;
    }
    setVideos(tally);
  }, []);

  useEffect(() => {
    load();
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.email ?? ""));
  }, [load]);

  /* one line of feedback under the card that was acted on */
  const [flash, setFlash] = useState<{ id: string; text: string; bad?: boolean } | null>(null);

  /* a nudge or an approval from the card, through the same route the queue
     uses, counting against the same two reminders the sweep may send */
  async function act(row: Row, action: "nudge-brief" | "nudge-review" | "approve") {
    if (
      action === "approve" &&
      !confirm(`Approve every video with the client on ${label(row.products)} for ${row.customers?.name ?? row.customer_email}? They are told, and can ask to reopen it.`)
    )
      return;
    setBusyId(row.id);
    setFlash(null);
    try {
      const r = await fetch(`/api/admin/orders/${row.id}/chase/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ action }),
      });
      const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) setFlash({ id: row.id, text: String(j.error ?? "Could not do that."), bad: true });
      else {
        setFlash({
          id: row.id,
          text:
            action === "nudge-brief"
              ? `Reminder sent, ${j.sent} of ${j.of}.`
              : action === "nudge-review"
                ? `Reminder sent for ${(j.nudged as string[] | undefined)?.join(", ") ?? "the videos with them"}.`
                : `Approved for them: ${(j.approved as string[] | undefined)?.join(", ") ?? ""}.`,
        });
        await load();
      }
    } catch {
      setFlash({ id: row.id, text: "Could not do that.", bad: true });
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
  const byColumn = (key: BoardColumn) =>
    visible.filter((r) => boardColumn(r.fulfillment_stage, r.intake_completed) === key);

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
          <h1 className="font-display text-h3 text-ink">Premade</h1>
          <p className="mt-0.5 max-w-[var(--measure-body)] text-body-sm text-muted">
            Every paid order that needs work. Open a job to set each video and
            post updates. The columns follow the work on their own, and an
            order finishes itself when the client approves the last video.
            Custom and Editing have boards of their own.
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
          {/* this is the premade board, so its queue is premade work; a
              custom note belongs on the Custom board, not here as well */}
          <StudioQueue
            kind="purchase"
            onOpenJob={setOpenJob}
            onOpenProject={onOpenProject}
            onOpenEditing={onOpenEditing}
          />
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
          {BOARD_COLUMNS.map((s) => {
            const items = byColumn(s.key);
            return (
              <div key={s.key} className="min-w-0">
                <div className="flex items-center justify-between rounded-t-[12px] border border-hair bg-surface px-4 py-2.5">
                  <span className="font-mono text-label font-bold uppercase tracking-[0.1em] text-muted">
                    {s.label}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-label font-bold leading-none ${
                      items.length > 0 && s.key !== "done"
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
                          {r.customers?.id ? (
                            /* the client behind the job, one click away */
                            <a
                              href={`/admin/customers/${r.customers.id}/`}
                              className="hover:text-gold"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {r.customers.name || r.customer_email}
                            </a>
                          ) : (
                            r.customer_email
                          )}
                        </p>
                        <p className="mt-1 font-mono text-label uppercase text-dim">
                          {money(r.amount_cents, r.currency)} / {when(r.created_at)}
                          {s.key === "brief"
                            ? ` / ${daysIn(r.created_at)}d without a brief`
                            : s.key !== "done" && daysIn(r.stage_changed_at) >= 3
                              ? ` / ${daysIn(r.stage_changed_at)}d here`
                              : ""}
                        </p>
                        {videos[r.id]?.total ? (
                          <button
                            type="button"
                            onClick={() => setOpenJob(r.id)}
                            className={`tap mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-label uppercase transition-colors ${
                              videos[r.id].signed === videos[r.id].total
                                ? "border-green/40 text-green hover:border-green"
                                : "border-hair text-muted hover:border-gold/60 hover:text-gold"
                            }`}
                          >
                            {/* Sent and signed off are opposite situations:
                                one is waiting on them, the other is done. */}
                            {videos[r.id].signed === videos[r.id].total
                              ? `all ${videos[r.id].total} approved`
                              : videos[r.id].signed > 0
                                ? `${videos[r.id].signed} approved, ${videos[r.id].done}/${videos[r.id].total} sent`
                                : `${videos[r.id].done}/${videos[r.id].total} sent`}
                          </button>
                        ) : null}
                        {s.key === "brief" ? (
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              disabled={busyId === r.id}
                              onClick={() => act(r, "nudge-brief")}
                              className="tap rounded-[8px] border border-hair px-2.5 py-1 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-40"
                            >
                              Nudge
                            </button>
                            <a
                              href={`/checkout/intake/${r.id}/?by=studio`}
                              target="_blank"
                              rel="noopener"
                              className="tap rounded-[8px] border border-gold/50 px-2.5 py-1 font-mono text-label uppercase text-gold transition-colors hover:bg-gold hover:text-canvas"
                            >
                              Enter it for them
                            </a>
                          </div>
                        ) : s.key === "client" ? (
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              disabled={busyId === r.id}
                              onClick={() => act(r, "nudge-review")}
                              className="tap rounded-[8px] border border-hair px-2.5 py-1 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-40"
                            >
                              Nudge
                            </button>
                            <button
                              type="button"
                              disabled={busyId === r.id}
                              onClick={() => act(r, "approve")}
                              className="tap rounded-[8px] border border-hair px-2.5 py-1 font-mono text-label uppercase text-muted transition-colors hover:border-green/60 hover:text-green disabled:opacity-40"
                            >
                              Approve for them
                            </button>
                          </div>
                        ) : null}
                        {flash?.id === r.id && (
                          <p className={`mt-2 text-body-sm ${flash.bad ? "text-error" : "text-green"}`}>{flash.text}</p>
                        )}
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
