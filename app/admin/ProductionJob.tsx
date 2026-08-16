"use client";

import { useCallback, useEffect, useState } from "react";
import { authHeader, when } from "./client";
import { BrandingBrief } from "./BrandingBrief";
import {
  DELIVERABLE_STATUSES,
  STATUS_LABEL,
  type DeliverableStatus,
} from "@/lib/deliverable-status";
import type { Deliverable } from "@/lib/deliverables";

/*
 * One production job, on a full page.
 *
 * This replaces the slide-over panel. A pack job carries nine videos, a brief
 * with colours and screenshots, a client timeline and soon a feedback thread
 * per video: that never fitted in a drawer, and phase 6 needs the room.
 *
 * The split it belongs to: Orders is the commercial record (paid, invoiced,
 * refunded) and Production is the work. Nothing about money is editable here,
 * and nothing about the work is editable in Orders.
 */

const TONE: Record<DeliverableStatus, string> = {
  queued: "border-hair text-dim",
  in_production: "border-gold/50 text-gold",
  ready: "border-blue/50 text-blue",
  revisions: "border-error/50 text-error",
  approved: "border-green/50 text-green",
};

const STAGE_LABEL: Record<string, string> = {
  paid: "Paid",
  intake: "Intake",
  production: "In production",
  review: "Review",
  delivered: "Delivered",
};

type Job = {
  id: string;
  invoiceNumber: string | null;
  customerName: string | null;
  customerEmail: string;
  productName: string;
  productCode: string | null;
  productKind: string | null;
  stage: string;
  stageIsDerived: boolean;
  stageChangedAt: string | null;
  stageShouldBe: string | null;
  stageReason: string;
  assignedEmail: string | null;
  assignedName: string | null;
  intakeCompleted: boolean;
  deliveryUrl: string | null;
  orderStatus: string;
  createdAt: string;
  paidAt: string | null;
};
type Mate = { email: string; name: string; role: string };
type Update = { body: string; createdAt: string };

const box = "rounded-[12px] border border-hair bg-surface p-5 md:p-6";
const lab = "font-mono text-label uppercase tracking-[0.1em] text-dim";
const field =
  "tap w-full rounded-[8px] border border-hair bg-canvas px-3 py-2 text-body-sm text-ink placeholder:text-dim disabled:opacity-50";
const btn =
  "tap rounded-[8px] border border-hair px-3.5 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-40";

export function ProductionJob({ id, onBack }: { id: string; onBack: () => void }) {
  const [job, setJob] = useState<Job | null>(null);
  const [videos, setVideos] = useState<Deliverable[]>([]);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [team, setTeam] = useState<Mate[]>([]);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [note, setNote] = useState("");
  const [openNotes, setOpenNotes] = useState<Record<string, number>>({});
  const [thread, setThread] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr("");
    try {
      const r = await fetch(`/api/admin/orders/${id}/job`, { headers: await authHeader() });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error ?? "Could not load this job.");
      } else {
        setJob(j.job as Job);
        setVideos(j.videos as Deliverable[]);
        setUpdates(j.updates as Update[]);
        setTeam(j.team as Mate[]);
        setLinks(
          Object.fromEntries((j.videos as Deliverable[]).map((d) => [d.id, d.video_url ?? ""])),
        );
        // unanswered client notes per video, for the badge on each row
        const c = await fetch(`/api/admin/orders/${id}/comments`, { headers: await authHeader() })
          .then((r) => r.json())
          .catch(() => null);
        setOpenNotes((c?.open as Record<string, number>) ?? {});
      }
    } catch {
      setErr("Could not load this job.");
    }
    setLoaded(true);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveVideo(vid: string, patch: Record<string, unknown>) {
    setBusy(vid);
    setErr("");
    try {
      const r = await fetch(`/api/admin/orders/${id}/deliverables`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ deliverableId: vid, ...patch }),
      });
      const j = await r.json();
      if (!r.ok) setErr(j.error ?? "Could not save.");
      // the stage may have moved as a result, so reload the whole job
      else await load();
    } catch {
      setErr("Could not save.");
    }
    setBusy(null);
  }

  async function saveJob(patch: Record<string, unknown>) {
    setBusy("job");
    setErr("");
    try {
      const r = await fetch(`/api/admin/orders/${id}/job`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify(patch),
      });
      const j = await r.json();
      if (!r.ok) setErr(j.error ?? "Could not save.");
      else await load();
    } catch {
      setErr("Could not save.");
    }
    setBusy(null);
  }

  /* Delivering and posting a client update both go through the fulfillment
     route, which owns the exactly-once delivery email. */
  async function fulfillment(body: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy("job");
    setErr("");
    try {
      const r = await fetch(`/api/admin/orders/${id}/fulfillment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setErr(j.error ?? "Could not save.");
      else {
        setNote("");
        await load();
      }
    } catch {
      setErr("Could not save.");
    }
    setBusy(null);
  }

  if (!loaded) return <p className="text-body text-muted">Loading the job...</p>;
  if (!job) return <p className="text-body text-error">{err || "We could not find that job."}</p>;

  const ready = videos.filter((v) => v.status === "ready" || v.status === "approved").length;
  const allApproved = videos.length > 0 && videos.every((v) => v.status === "approved");
  const delivered = job.stage === "delivered";
  const stale = job.stageShouldBe && job.stageShouldBe !== job.stage;

  return (
    <div className="grid gap-6">
      <button type="button" onClick={onBack} className="justify-self-start font-mono text-label uppercase text-muted transition-colors hover:text-gold">
        &larr; Production board
      </button>

      {/* who and what */}
      <div>
        {job.productCode && (
          <p className="font-mono text-label uppercase tracking-[0.12em] text-gold/80">
            {job.productCode}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h1 className="font-display text-h3 text-ink">{job.productName}</h1>
          <span className={`rounded-full border px-3 py-1 font-mono text-label uppercase ${delivered ? "border-green/50 text-green" : "border-gold/50 text-gold"}`}>
            {STAGE_LABEL[job.stage] ?? job.stage}
          </span>
        </div>
        <p className="mt-1.5 text-body-sm text-muted">
          {job.customerName || job.customerEmail}
          {job.invoiceNumber ? ` / ${job.invoiceNumber}` : ""}
          {job.paidAt ? ` / paid ${when(job.paidAt)}` : ""}
        </p>
        <p className="mt-1 text-body-sm text-dim">{job.stageReason}</p>
      </div>

      {err && <p className="text-body-sm text-error">{err}</p>}

      {/* the job controls */}
      <div className={box}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className={lab}>Owner</span>
            <select
              value={job.assignedEmail ?? ""}
              disabled={busy === "job"}
              onChange={(e) => saveJob({ assignedEmail: e.target.value })}
              className={field}
            >
              <option value="">Nobody yet</option>
              {team.map((m) => (
                <option key={m.email} value={m.email}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className={lab}>Stage</span>
            <select
              value={delivered ? "delivered" : job.stage}
              disabled={busy === "job" || delivered}
              onChange={(e) => saveJob({ stage: e.target.value })}
              className={field}
            >
              {["paid", "intake", "production", "review"].map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABEL[s]}
                </option>
              ))}
              {delivered && <option value="delivered">Delivered</option>}
            </select>
          </label>
        </div>

        <p className="mt-2 text-body-sm text-dim">
          {delivered
            ? "This job is delivered. It no longer moves on its own."
            : job.stageIsDerived
              ? "Calculated from the videos below. Setting it by hand holds until a video changes."
              : "Set by hand. It will recalculate the next time a video changes."}
        </p>

        {stale && !delivered && (
          <button
            type="button"
            disabled={busy === "job"}
            onClick={() => saveJob({ stage: job.stageShouldBe })}
            className="mt-3 tap rounded-[8px] border border-gold/50 px-3.5 py-2 font-mono text-label uppercase text-gold transition-colors hover:bg-gold hover:text-canvas"
          >
            The videos say {STAGE_LABEL[job.stageShouldBe!]}. Move it.
          </button>
        )}

        {!delivered && (
          <div className="mt-4 border-t border-hair pt-4">
            <button
              type="button"
              disabled={busy === "job" || !videos.length || !allApproved}
              onClick={() =>
                fulfillment(
                  { stage: "delivered" },
                  `Deliver ${job.productName} to ${job.customerName || job.customerEmail}? This sends the client their delivery email.`,
                )
              }
              className="tap rounded-[8px] bg-brand-gradient px-4 py-2.5 font-mono text-label font-bold uppercase text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Deliver to the client
            </button>
            <p className="mt-2 text-body-sm text-dim">
              {!videos.length
                ? "No videos listed on this job."
                : allApproved
                  ? "Sends the delivery email. This is the one step that is never automatic."
                  : `Available once the client has approved all ${videos.length} videos. ${videos.filter((v) => v.status === "approved").length} approved so far.`}
            </p>
          </div>
        )}
      </div>

      {/* the videos */}
      <div className={box}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="font-mono text-label uppercase text-gold">
            {videos.length === 1 ? "The video" : `The videos (${videos.length})`}
          </p>
          {videos.length > 0 && (
            <p className={lab}>
              {ready} of {videos.length} with the client
            </p>
          )}
        </div>

        {videos.length === 0 ? (
          <p className="mt-3 text-body-sm text-dim">
            Nothing listed. That happens when the product is not in the catalog, an
            invoice for example.
          </p>
        ) : (
          <ol className="mt-4 grid gap-3">
            {videos.map((d, i) => (
              <li key={d.id} className="rounded-[8px] border border-hair bg-card p-4">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                  <span className="mt-0.5 font-mono text-label font-bold text-gold/70">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-[12rem] flex-1">
                    <p className="text-body-sm font-semibold leading-snug text-ink">{d.title}</p>
                    <p className={`mt-1 ${lab}`}>
                      {d.catalog_code ? d.catalog_code.toUpperCase() : "Not chosen yet"}
                      {d.group_label ? ` / ${d.group_label}` : ""}
                      {d.revision_round > 0 ? ` / round ${d.revision_round + 1}` : ""}
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
                    <span className={lab}>Status</span>
                    <select
                      value={d.status}
                      disabled={busy === d.id}
                      onChange={(e) => saveVideo(d.id, { status: e.target.value })}
                      className={field}
                    >
                      {DELIVERABLE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1">
                    <span className={lab}>Video link</span>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        inputMode="url"
                        placeholder="https://... the HighLevel mp4"
                        value={links[d.id] ?? ""}
                        disabled={busy === d.id}
                        onChange={(e) => setLinks((p) => ({ ...p, [d.id]: e.target.value }))}
                        className={field}
                      />
                      <button
                        type="button"
                        disabled={busy === d.id || (links[d.id] ?? "") === (d.video_url ?? "")}
                        onClick={() => saveVideo(d.id, { videoUrl: links[d.id] ?? "" })}
                        className={`${btn} shrink-0`}
                      >
                        Save
                      </button>
                    </div>
                  </label>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-4">
                  {d.video_url && (
                    <a
                      href={d.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-label uppercase tracking-[0.1em] text-blue hover:underline"
                    >
                      Open the video
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setThread(thread === d.id ? null : d.id)}
                    className={`tap font-mono text-label uppercase tracking-[0.1em] transition-colors hover:text-gold ${
                      openNotes[d.id] ? "text-gold" : "text-dim"
                    }`}
                  >
                    {openNotes[d.id]
                      ? `${openNotes[d.id]} note${openNotes[d.id] === 1 ? "" : "s"} to answer`
                      : "Notes"}
                  </button>
                </div>

                {thread === d.id && (
                  <StudioThread
                    orderId={id}
                    deliverableId={d.id}
                    onChanged={load}
                  />
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* the brief: the instructions for this work */}
      <div className={box}>
        <BrandingBrief orderId={job.id} />
      </div>

      {/* the client-facing timeline */}
      <div className={box}>
        <p className="font-mono text-label uppercase text-gold">Client updates</p>
        <div className="mt-3 grid gap-2">
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="First cut is in review."
            className={field}
          />
          <button
            type="button"
            disabled={busy === "job" || !note.trim()}
            onClick={() => fulfillment({ update: note })}
            className={`${btn} justify-self-start`}
          >
            Post update
          </button>
          <p className="text-body-sm text-dim">
            The client sees this on their order and gets it by email.
          </p>
        </div>

        {updates.length > 0 && (
          <ul className="mt-5 grid gap-4 border-t border-hair pt-4">
            {updates.map((u, i) => (
              <li key={i} className="border-l-2 border-gold/40 pl-4">
                <p className="text-body-sm text-ink">{u.body}</p>
                <p className={`mt-0.5 ${lab}`}>{when(u.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* One video's review thread, studio side. Same thread the client sees under
   their player, so a reply here lands in their portal and their bell. */
function StudioThread({
  orderId,
  deliverableId,
  onChanged,
}: {
  orderId: string;
  deliverableId: string;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<
    {
      id: string;
      side: "client" | "studio";
      name: string;
      body: string;
      stamp: string | null;
      resolved: boolean;
      createdAt: string;
      round: number;
    }[] | null
  >(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(
      `/api/admin/orders/${orderId}/comments?video=${deliverableId}`,
      { headers: await authHeader() },
    );
    const j = await r.json().catch(() => null);
    setRows(j?.comments ?? []);
  }, [orderId, deliverableId]);

  useEffect(() => {
    load();
  }, [load]);

  async function post(patch: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/admin/orders/${orderId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ deliverableId, ...patch }),
    }).catch(() => null);
    setBusy(false);
    setText("");
    await load();
    onChanged();
  }

  return (
    <div className="mt-3 border-t border-hair pt-3">
      {rows === null ? (
        <p className="text-body-sm text-muted">Loading notes...</p>
      ) : rows.length === 0 ? (
        <p className="text-body-sm text-dim">No notes on this one yet.</p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((c) => (
            <li
              key={c.id}
              className={`rounded-[8px] border p-3 ${
                c.side === "client" ? "border-gold/30 bg-gold/5" : "border-hair bg-surface"
              } ${c.resolved ? "opacity-60" : ""}`}
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-body-sm font-semibold text-ink">{c.name}</span>
                {c.stamp && (
                  <span className="rounded-full border border-gold/40 px-2 py-0.5 font-mono text-label text-gold">
                    {c.stamp}
                  </span>
                )}
                {c.side === "client" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => post({ resolveId: c.id, resolved: !c.resolved })}
                    className="tap ml-auto font-mono text-label uppercase text-dim transition-colors hover:text-green disabled:opacity-40"
                  >
                    {c.resolved ? "Reopen" : "Mark done"}
                  </button>
                )}
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-body-sm text-muted">{c.body}</p>
              <p className={`mt-1 ${lab}`}>
                {when(c.createdAt)}
                {c.round > 0 ? ` / round ${c.round + 1}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 grid gap-2">
        <textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Reply to the client about this video."
          className={field}
        />
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={() => post({ body: text })}
          className={`${btn} justify-self-start`}
        >
          Reply
        </button>
      </div>
    </div>
  );
}
