"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Input, Select, Textarea } from "@/components/portal/ui";
import { authHeader, when } from "./client";
import { BrandingBrief } from "./BrandingBrief";
import { StudioThread } from "./ProductionJob";
import { STATUS_LABEL, type DeliverableStatus } from "@/lib/deliverable-status";
import type { Deliverable } from "@/lib/deliverables";

/*
 * The job page, laid out to keep the work above the fold: a mock of the
 * layout proposed after the Premade review (16 September 2026), on real
 * data and the real routes.
 *
 * What changes against the current page: the brand and the job's controls
 * share one row on a wide screen; the videos are a table with one header
 * instead of nine repeated ones; each row shows its status as a chip and
 * offers the one move that makes sense next rather than a five-way
 * dropdown; the link paste box folds away until it is wanted; unanswered
 * notes are the loudest mark on the row; on a phone the two actions that
 * matter are pinned to the bottom edge.
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
  intake: "Brief",
  production: "In production",
  review: "With the client",
  delivered: "Delivered",
};

type Job = {
  id: string;
  invoiceNumber: string | null;
  customerName: string | null;
  customerEmail: string;
  productName: string;
  productCode: string | null;
  stage: string;
  stageReason: string;
  assignedEmail: string | null;
  intakeCompleted: boolean;
  paidAt: string | null;
  brandConfirmed: { at: string; by: string } | null;
  dueOn: string | null;
};
type Mate = { email: string; name: string; role: string };
type Update = { body: string; createdAt: string };
type WideNote = { id: string; deliverableId: string; videoTitle: string; side: "client" | "studio"; name: string; body: string; stamp: string | null; resolved: boolean; createdAt: string };


export function ProductionJobV2({ id, onBack }: { id: string; onBack: () => void }) {
  const [job, setJob] = useState<Job | null>(null);
  const [videos, setVideos] = useState<Deliverable[]>([]);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [team, setTeam] = useState<Mate[]>([]);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [openNotes, setOpenNotes] = useState<Record<string, number>>({});
  const [wideNotes, setWideNotes] = useState<WideNote[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [thread, setThread] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [dueNote, setDueNote] = useState("");
  const [wideReply, setWideReply] = useState<{ id: string; text: string } | null>(null);
  const updatesRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setErr("");
    try {
      const r = await fetch(`/api/admin/orders/${id}/job/`, { headers: await authHeader() });
      const j = await r.json();
      if (!r.ok) return setErr(j.error ?? "Could not load this job.");
      setJob(j.job as Job);
      setVideos(j.videos as Deliverable[]);
      setUpdates(j.updates as Update[]);
      setTeam(j.team as Mate[]);
      setLinks(Object.fromEntries((j.videos as Deliverable[]).map((d) => [d.id, d.video_url ?? ""])));
      setDueOn(((j.job as Job).dueOn as string | null) ?? "");
      const c = await fetch(`/api/admin/orders/${id}/comments/`, { headers: await authHeader() }).then((r) => r.json()).catch(() => null);
      setOpenNotes((c?.open as Record<string, number>) ?? {});
      setWideNotes((c?.orderWide as WideNote[]) ?? []);
    } catch {
      setErr("Could not load this job.");
    }
    setLoaded(true);
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  async function send(method: "PATCH" | "POST", path: string, body: Record<string, unknown>, key = "job") {
    setBusy(key);
    setErr("");
    const r = await fetch(path, { method, headers: { "Content-Type": "application/json", ...(await authHeader()) }, body: JSON.stringify(body) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) setErr(j.error ?? "Could not save.");
    setBusy(null);
    await load();
    return Boolean(r && r.ok);
  }
  const patchVideos = (body: Record<string, unknown>, key?: string) => send("PATCH", `/api/admin/orders/${id}/deliverables/`, body, key);
  const patchJob = (body: Record<string, unknown>) => send("PATCH", `/api/admin/orders/${id}/job/`, body);

  if (!loaded) return <p className="text-body text-muted">Loading the job...</p>;
  if (!job) return <p className="text-body text-error">{err || "We could not find that job."}</p>;

  const delivered = job.stage === "delivered";
  const sendable = videos.filter((v) => v.video_url && v.status !== "ready" && v.status !== "approved");
  const approved = videos.filter((v) => v.status === "approved").length;
  const withClient = videos.filter((v) => v.status === "ready").length;
  const toAnswer = Object.values(openNotes).reduce((a, b) => a + b, 0);

  async function sendToClient() {
    if (!sendable.length) return;
    if (!confirm(`Send ${sendable.length} ${sendable.length === 1 ? "video" : "videos"} to the client? They get one email.`)) return;
    await patchVideos({ deliverableIds: sendable.map((v) => v.id), status: "ready" });
  }
  async function saveLinks() {
    const lines = pasted.split("\n").map((l) => l.trim());
    const map: Record<string, string> = {};
    videos.forEach((v, i) => {
      if (lines[i]) map[v.id] = lines[i];
    });
    if (!Object.keys(map).length) return setErr("Paste at least one link, one per line, in the order of the videos.");
    if (await patchVideos({ links: map })) {
      setPasted("");
      setPasteOpen(false);
    }
  }

  /* one row of the videos table, and its phone-sized card */
  const rowActions = (d: Deliverable) => (
    <div className="flex flex-wrap items-center gap-2">
      {d.status === "queued" && (
        <Button variant="secondary" size="sm" disabled={busy === d.id} onClick={() => patchVideos({ deliverableId: d.id, status: "in_production" }, d.id)}>
          Start
        </Button>
      )}
      {d.video_url && (
        <a href={d.video_url} target="_blank" rel="noopener noreferrer" className="font-mono text-label uppercase tracking-[0.08em] text-blue hover:underline">
          Open
        </a>
      )}
      <button
        type="button"
        onClick={() => setThread(thread === d.id ? null : d.id)}
        className={`tap inline-flex items-center gap-1.5 font-mono text-label uppercase tracking-[0.08em] transition-colors hover:text-gold ${openNotes[d.id] ? "text-error" : "text-dim"}`}
      >
        {openNotes[d.id] ? <span className="h-2 w-2 rounded-full bg-error" aria-hidden="true" /> : null}
        {openNotes[d.id] ? `${openNotes[d.id]} to answer` : "Notes"}
      </button>
    </div>
  );
  const linkField = (d: Deliverable) => (
    <div className="flex gap-2">
      <Input
        type="url"
        inputMode="url"
        placeholder="Paste the link"
        value={links[d.id] ?? ""}
        disabled={busy === d.id}
        onChange={(e) => setLinks((p) => ({ ...p, [d.id]: e.target.value }))}
      />
      <Button variant="secondary" size="sm" disabled={busy === d.id || (links[d.id] ?? "") === (d.video_url ?? "")} onClick={() => patchVideos({ deliverableId: d.id, videoUrl: links[d.id] ?? "" }, d.id)} className="shrink-0">
        Save
      </Button>
    </div>
  );

  return (
    <div className="grid gap-5 pb-24 md:pb-0">
      <button type="button" onClick={onBack} className="justify-self-start font-mono text-label uppercase text-muted transition-colors hover:text-gold">
        &larr; Premade
      </button>

      <div>
        {job.productCode && <p className="font-mono text-label uppercase tracking-[0.12em] text-gold/80">{job.productCode}</p>}
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h1 className="font-display text-h3 text-ink">{job.productName}</h1>
          <span className={`rounded-full border px-3 py-1 font-mono text-label uppercase ${delivered ? "border-green/50 text-green" : "border-gold/50 text-gold"}`}>
            {STAGE_LABEL[job.stage] ?? job.stage}
          </span>
        </div>
        <p className="mt-1 text-body-sm text-muted">
          {job.customerName || job.customerEmail}
          {job.invoiceNumber ? `, ${job.invoiceNumber}` : ""}
          {job.paidAt ? `, paid ${when(job.paidAt)}` : ""}
          {videos.length ? `. ${approved} of ${videos.length} approved, ${withClient} with the client${toAnswer ? `, ${toAnswer} note${toAnswer === 1 ? "" : "s"} to answer` : ""}.` : ""}
        </p>
      </div>

      {err && <p className="text-body-sm text-error">{err}</p>}

      {/* the brand and the job, side by side where there is room */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[12px] border border-hair bg-surface p-5 md:p-6">
          <BrandingBrief orderId={job.id} />
          <label className="mt-4 flex items-start gap-3 border-t border-hair pt-4">
            <input type="checkbox" checked={Boolean(job.brandConfirmed)} disabled={busy === "job"} onChange={(e) => patchJob({ brandConfirmed: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[var(--gold)]" />
            <span className="grid gap-0.5">
              <span className="text-body-sm font-semibold text-ink">Brand confirmed</span>
              <span className="text-body-sm text-dim">
                {job.brandConfirmed
                  ? `Checked by ${team.find((m) => m.email === job.brandConfirmed?.by)?.name ?? job.brandConfirmed.by}, ${when(job.brandConfirmed.at)}.`
                  : "Tick once the logo, colours, name and website are the ones to build with."}
              </span>
            </span>
          </label>
        </div>
        <div className="rounded-[12px] border border-hair bg-surface p-5 md:p-6">
          <div className="grid gap-4">
            <label className="grid gap-1.5">
              <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Producer</span>
              <Select value={job.assignedEmail ?? ""} disabled={busy === "job"} onChange={(e) => patchJob({ assignedEmail: e.target.value })}>
                <option value="">Nobody yet</option>
                {team.map((m) => (
                  <option key={m.email} value={m.email}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </label>
            {!delivered && (
              <div className="grid gap-2">
                <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Promised by</span>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,170px)_1fr]">
                  <Input type="date" value={dueOn} disabled={busy === "job"} onChange={(e) => setDueOn(e.target.value)} />
                  <Input value={dueNote} disabled={busy === "job"} onChange={(e) => setDueNote(e.target.value)} placeholder="One line the client reads, if the date moved" />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy === "job" || !dueOn || dueOn === (job.dueOn ?? "")}
                    onClick={async () => {
                      await patchJob({ dueOn, dueNote });
                      setDueNote("");
                    }}
                  >
                    Save date
                  </Button>
                  <span className="text-body-sm text-dim">
                    {job.dueOn ? `Promised for ${new Date(`${job.dueOn}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.` : "No date yet."}
                  </span>
                </div>
              </div>
            )}
            <p className="text-body-sm text-dim">{job.stageReason}</p>
          </div>
        </div>
      </div>

      {wideNotes.length > 0 && (
        <div className="rounded-[12px] border border-hair bg-surface p-5 md:p-6">
          <p className="font-mono text-label uppercase text-gold">Applies to every video</p>
          <ul className="mt-3 grid gap-2">
            {wideNotes.map((n) => (
              <li key={n.id} className={`rounded-[8px] border border-l-4 p-3 ${n.resolved ? "border-hair border-l-hair opacity-60" : "border-error/30 border-l-error bg-error/5"}`}>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-body-sm font-semibold text-ink">{n.name}</span>
                  <span className="text-body-sm text-dim">
                    on {n.videoTitle}
                    {n.stamp ? ` at ${n.stamp}` : ""}
                  </span>
                  <Button variant="ghost" size="sm" disabled={busy === "job"} onClick={() => send("POST", `/api/admin/orders/${id}/comments/`, { deliverableId: n.deliverableId, resolveId: n.id, resolved: !n.resolved })} className="ml-auto">
                    {n.resolved ? "Reopen" : "Mark done"}
                  </Button>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-body-sm text-muted">{n.body}</p>
                {wideReply?.id === n.id ? (
                  <div className="mt-2 grid gap-2">
                    <Textarea rows={2} autoFocus value={wideReply.text} onChange={(e) => setWideReply({ id: n.id, text: e.target.value })} placeholder="Answer this note." />
                    <div className="flex gap-2">
                      <Button variant="brand" size="sm" disabled={busy === "job" || !wideReply.text.trim()} onClick={async () => { if (await send("POST", `/api/admin/orders/${id}/comments/`, { deliverableId: n.deliverableId, body: wideReply.text, parentId: n.id })) setWideReply(null); }}>
                        Send
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setWideReply(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setWideReply({ id: n.id, text: "" })} className="mt-1">
                    Reply
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* the videos: the work, as one table */}
      <div className="rounded-[12px] border border-hair bg-surface p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-auto font-mono text-label uppercase text-gold">{videos.length === 1 ? "The video" : `The videos (${videos.length})`}</p>
          {videos.length > 1 && !delivered && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setPasteOpen((v) => !v)}>
                {pasteOpen ? "Hide the paste box" : "Paste links"}
              </Button>
              <Button variant="secondary" size="sm" disabled={busy === "job" || videos.every((v) => v.status !== "queued")} onClick={() => patchVideos({ deliverableIds: videos.filter((v) => v.status === "queued").map((v) => v.id), status: "in_production" })}>
                Start all
              </Button>
              <Button variant="brand" size="sm" disabled={busy === "job" || !sendable.length} onClick={sendToClient}>
                {sendable.length ? `Send ${sendable.length} to the client` : "Nothing to send yet"}
              </Button>
            </>
          )}
        </div>
        {pasteOpen && (
          <div className="mt-3 grid gap-2 rounded-[8px] border border-hair bg-canvas/40 p-3">
            <Textarea rows={Math.min(videos.length, 6)} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={videos.slice(0, 3).map((v, i) => `${String(i + 1).padStart(2, "0")} link for ${v.title}`).join("\n") + (videos.length > 3 ? "\n..." : "")} className="font-mono text-body-sm" />
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" size="sm" disabled={busy === "job" || !pasted.trim()} onClick={saveLinks}>
                Save links
              </Button>
              <span className="text-body-sm text-dim">One per line, in the order below. A blank line skips that video.</span>
            </div>
          </div>
        )}

        {videos.length === 0 ? (
          <p className="mt-3 text-body-sm text-dim">Nothing listed on this job.</p>
        ) : (
          <>
            {/* wide: one header row, compact rows */}
            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full text-body-sm">
                <thead>
                  <tr className="border-b border-hair text-left">
                    <th className="py-2 pr-3 font-mono text-label font-medium uppercase tracking-[0.08em] text-muted">#</th>
                    <th className="py-2 pr-3 font-mono text-label font-medium uppercase tracking-[0.08em] text-muted">Video</th>
                    <th className="py-2 pr-3 font-mono text-label font-medium uppercase tracking-[0.08em] text-muted">Status</th>
                    <th className="py-2 pr-3 font-mono text-label font-medium uppercase tracking-[0.08em] text-muted">Link</th>
                    <th className="py-2 font-mono text-label font-medium uppercase tracking-[0.08em] text-muted"></th>
                  </tr>
                </thead>
                <tbody>
                  {videos.map((d, i) => (
                    <FragmentRow key={d.id} open={thread === d.id} thread={<StudioThread orderId={id} deliverableId={d.id} videoUrl={d.video_url ?? null} onChanged={load} />}>
                      <td className="py-2.5 pr-3 align-top font-mono text-label text-gold/70">{String(i + 1).padStart(2, "0")}</td>
                      <td className="max-w-[18rem] py-2.5 pr-3 align-top">
                        <p className="font-semibold leading-snug text-ink">{d.title}</p>
                        <p className="mt-0.5 font-mono text-label uppercase tracking-[0.08em] text-dim">
                          {d.catalog_code ? d.catalog_code.toUpperCase() : "not chosen yet"}
                          {d.revision_round > 0 ? ` / ${d.revision_round} change${d.revision_round === 1 ? "" : "s"} asked` : ""}
                        </p>
                      </td>
                      <td className="py-2.5 pr-3 align-top">
                        <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${TONE[d.status]}`}>{STATUS_LABEL[d.status]}</span>
                      </td>
                      <td className="min-w-[16rem] py-2.5 pr-3 align-top">{linkField(d)}</td>
                      <td className="py-2.5 align-top">{rowActions(d)}</td>
                    </FragmentRow>
                  ))}
                </tbody>
              </table>
            </div>
            {/* narrow: compact cards */}
            <ol className="mt-4 grid gap-2 md:hidden">
              {videos.map((d, i) => (
                <li key={d.id} className="rounded-[8px] border border-hair bg-card p-3">
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-label text-gold/70">{String(i + 1).padStart(2, "0")}</span>
                    <p className="min-w-0 flex-1 text-body-sm font-semibold leading-snug text-ink">{d.title}</p>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-label uppercase ${TONE[d.status]}`}>{STATUS_LABEL[d.status]}</span>
                  </div>
                  <div className="mt-2">{linkField(d)}</div>
                  <div className="mt-2">{rowActions(d)}</div>
                  {thread === d.id && <StudioThread orderId={id} deliverableId={d.id} videoUrl={d.video_url ?? null} onChanged={load} />}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>

      <div className="rounded-[12px] border border-hair bg-surface p-5 md:p-6" ref={updatesRef}>
        <p className="font-mono text-label uppercase text-gold">Client updates</p>
        <div className="mt-3 grid gap-2">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="First cut is in review." />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="sm" disabled={busy === "job" || !note.trim()} onClick={async () => { if (await send("POST", `/api/admin/orders/${id}/fulfillment/`, { update: note })) setNote(""); }}>
              Post update
            </Button>
            <span className="text-body-sm text-dim">The client sees this on their order and gets it by email.</span>
          </div>
        </div>
        {updates.length > 0 && (
          <ul className="mt-5 grid gap-3 border-t border-hair pt-4">
            {updates.map((u, i) => (
              <li key={i} className="border-l-2 border-gold/40 pl-3">
                <p className="text-body-sm text-ink">{u.body}</p>
                <p className="mt-0.5 font-mono text-label uppercase tracking-[0.08em] text-dim">{when(u.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* the two moves that matter, always in reach on a phone */}
      {!delivered && videos.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t border-hair bg-surface/95 p-3 backdrop-blur md:hidden">
          <Button variant="brand" size="sm" disabled={busy === "job" || !sendable.length} onClick={sendToClient} className="flex-1">
            {sendable.length ? `Send ${sendable.length}` : "Nothing to send"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => updatesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} className="flex-1">
            Post update
          </Button>
        </div>
      )}
    </div>
  );
}

/* a table row, and the note thread that opens under it as a second row */
function FragmentRow({ open, thread, children }: { open: boolean; thread: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      <tr className="border-b border-hair/60 align-top">{children}</tr>
      {open && (
        <tr className="border-b border-hair/60">
          <td colSpan={5} className="pb-3">
            {thread}
          </td>
        </tr>
      )}
    </>
  );
}
