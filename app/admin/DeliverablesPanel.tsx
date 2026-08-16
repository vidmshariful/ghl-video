"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authHeader } from "./client";
import {
  DELIVERABLE_STATUSES,
  STATUS_LABEL,
  type DeliverableStatus,
} from "@/lib/deliverable-status";
import type { Deliverable } from "@/lib/deliverables";

/*
 * The studio's control room for one order.
 *
 * A pack order owes nine videos. Before this, the whole order had one status
 * and one link, so "which of the nine is done" lived in somebody's head. Here
 * each video gets its own state and its own HighLevel link, and the client's
 * My Videos tab reads exactly what is set here.
 *
 * Status saves the moment it is picked, because that is the action taken
 * dozens of times a day. A link is typed, so it saves on its own button.
 */

/* one accent per state, so the board reads at a glance */
const TONE: Record<DeliverableStatus, string> = {
  queued: "border-hair text-dim",
  in_production: "border-gold/50 text-gold",
  ready: "border-blue/50 text-blue",
  revisions: "border-error/50 text-error",
  approved: "border-green/50 text-green",
};

export function DeliverablesPanel({
  orderId,
  title,
  customer,
  onClose,
  onChanged,
}: {
  orderId: string;
  title: string;
  customer: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<Deliverable[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const closeRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    setErr("");
    try {
      const r = await fetch(`/api/admin/orders/${orderId}/deliverables`, {
        headers: await authHeader(),
      });
      const j = await r.json();
      if (!r.ok) return setErr(j.error ?? "Could not load the videos.");
      apply(j.deliverables as Deliverable[]);
    } catch {
      setErr("Could not load the videos.");
    }
  }, [orderId]);

  function apply(list: Deliverable[]) {
    setRows(list);
    setLinks(Object.fromEntries(list.map((d) => [d.id, d.video_url ?? ""])));
  }

  useEffect(() => {
    load();
  }, [load]);

  // Escape closes, and focus starts on the close button so the panel is
  // usable without a mouse.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save(id: string, patch: Record<string, unknown>) {
    setBusy(id);
    setErr("");
    try {
      const r = await fetch(`/api/admin/orders/${orderId}/deliverables`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ deliverableId: id, ...patch }),
      });
      const j = await r.json();
      if (!r.ok) setErr(j.error ?? "Could not save.");
      else {
        apply(j.deliverables as Deliverable[]);
        onChanged?.();
      }
    } catch {
      setErr("Could not save.");
    }
    setBusy(null);
  }

  const done = (rows ?? []).filter((d) => d.status === "ready" || d.status === "approved").length;
  const total = rows?.length ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-canvas/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Videos for ${title}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-full w-full max-w-[720px] flex-col border-l border-hair bg-surface">
        <div className="flex items-start justify-between gap-4 border-b border-hair px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="font-display text-h4 leading-tight text-ink">{title}</h2>
            <p className="mt-1 truncate text-body-sm text-muted">{customer}</p>
            {total > 0 && (
              <p className="mt-1.5 font-mono text-label uppercase tracking-[0.1em] text-dim">
                {done} of {total} ready
              </p>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="tap shrink-0 rounded-[8px] border border-hair px-3 py-1.5 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
          >
            Close
          </button>
        </div>

        {err && <p className="px-5 pt-4 text-body-sm text-error sm:px-6">{err}</p>}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {rows === null ? (
            <p className="text-body text-muted">Loading the videos...</p>
          ) : rows.length === 0 ? (
            <p className="text-body text-muted">
              This order has no videos listed yet. That happens when the product is
              not in the catalog, an invoice for example.
            </p>
          ) : (
            <ol className="grid gap-3">
              {rows.map((d, i) => (
                <li key={d.id} className="rounded-[12px] border border-hair bg-card p-4">
                  {/* Wraps rather than squeezes: on a phone "Revisions requested"
                      is nearly as wide as the card, and holding it on the title's
                      line shrank the title to a four line column. */}
                  <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                    <span className="mt-0.5 font-mono text-label font-bold text-gold/70">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-[12rem] flex-1">
                      <p className="text-body-sm font-semibold leading-snug text-ink">{d.title}</p>
                      <p className="mt-1 font-mono text-label uppercase tracking-[0.1em] text-dim">
                        {d.catalog_code ? d.catalog_code.toUpperCase() : "Not chosen yet"}
                        {d.group_label ? ` / ${d.group_label}` : ""}
                        {d.revision_round > 0
                          ? ` / round ${d.revision_round + 1}`
                          : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${TONE[d.status]}`}
                    >
                      {STATUS_LABEL[d.status]}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,180px)_1fr]">
                    <label className="grid gap-1">
                      <span className="font-mono text-label uppercase tracking-[0.1em] text-dim">
                        Status
                      </span>
                      <select
                        value={d.status}
                        disabled={busy === d.id}
                        onChange={(e) => save(d.id, { status: e.target.value })}
                        className="tap rounded-[8px] border border-hair bg-surface px-3 py-2 text-body-sm text-ink disabled:opacity-50"
                      >
                        {DELIVERABLE_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-1">
                      <span className="font-mono text-label uppercase tracking-[0.1em] text-dim">
                        Video link
                      </span>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          inputMode="url"
                          placeholder="https://... the HighLevel mp4"
                          value={links[d.id] ?? ""}
                          disabled={busy === d.id}
                          onChange={(e) =>
                            setLinks((p) => ({ ...p, [d.id]: e.target.value }))
                          }
                          className="tap min-w-0 flex-1 rounded-[8px] border border-hair bg-surface px-3 py-2 text-body-sm text-ink placeholder:text-dim disabled:opacity-50"
                        />
                        <button
                          type="button"
                          disabled={busy === d.id || (links[d.id] ?? "") === (d.video_url ?? "")}
                          onClick={() => save(d.id, { videoUrl: links[d.id] ?? "" })}
                          className="tap shrink-0 rounded-[8px] border border-hair px-3 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-40"
                        >
                          Save
                        </button>
                      </div>
                    </label>
                  </div>

                  {d.video_url && (
                    <a
                      href={d.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block font-mono text-label uppercase tracking-[0.1em] text-blue hover:underline"
                    >
                      Open the video
                    </a>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
