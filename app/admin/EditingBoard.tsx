"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, Plus } from "lucide-react";
import {
  Button,
  Card,
  Chip,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
} from "@/components/portal/ui";
import { authHeader, when } from "./client";
import { Attachments } from "@/components/portal/Attachments";

/*
 * The shape the shared Attachments panel asks for, wearing the admin's auth.
 *
 * The portal passes its own authedFetch; admin screens carry a bearer header
 * instead, so this is the adapter rather than a second copy of the panel. A
 * FormData body sets its own content type, so this must not.
 */
async function adminFetch(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const isForm = init?.body instanceof FormData;
  const r = await fetch(path, {
    ...init,
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(await authHeader()),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  return (await r.json().catch(() => ({}))) as Record<string, unknown>;
}
import { StyleGuideAdmin } from "./StyleGuideAdmin";
import {
  ASPECTS,
  EDITING_COLUMNS,
  QC_CHECKS,
  qcRemaining,
  boardMovePatch,
  type EditingColumn,
  type Qc,
} from "@/lib/editing-sop";
import { EDIT_TIERS, creditCost, isPodcast, isBatch } from "@/lib/editing-credits";
import {
  ItemNotes,
  KanbanBoard,
  type BoardColumn,
  type BoardItem,
} from "@/components/portal/board";

/*
 * Editing plan work, run the way the rest of production is run.
 *
 * A client list, then that client's board. Everything on it follows the SOP
 * in lib/editing-sop.ts, and the two rules that matter most are visible
 * rather than remembered:
 *
 *  - Nothing is promised until the footage is in. "Needs footage" is its own
 *    column, and marking the footage in is what starts the clock.
 *  - Nothing reaches a client until QC has run. The Review move is refused
 *    until the six checks are ticked, by the server, not just by this screen.
 */

type Req = {
  id: string;
  parentId: string | null;
  title: string;
  brief: string | null;
  status: string;
  editType: string | null;
  typeLabel: string | null;
  creditCost: number;
  runtimeMinutes: number | null;
  aspect: string | null;
  targetSeconds: number | null;
  assetsUrl: string | null;
  referenceUrl: string | null;
  assetsReadyAt: string | null;
  requestedDueAt: string | null;
  dueAt: string | null;
  assignedTo: string | null;
  videoUrl: string | null;
  revisionRound: number;
  cancelledAt: string | null;
  createdAt: string;
  qc: Qc;
  qcPassed: boolean;
  /* client notes nobody has answered or marked done */
  openNotes: number;
  column: EditingColumn;
  cycleId: string;
};

type Client = {
  subscriptionId: string;
  /* the handle their board lives at, /admin/editing/<slug>/ */
  slug: string | null;
  email: string;
  name: string | null;
  company: string | null;
  planName: string;
  status: string;
  renewsAt: string | null;
  credits: {
    spent: number;
    allowed: number;
    planLeft: number;
    topupLeft: number;
    left: number;
    overPlan: boolean;
  };
  needsUs: number;
  waitingOnThem: number;
  inProgress: number;
  withClient: number;
};

type Board = {
  client: Omit<Client, "needsUs" | "waitingOnThem" | "inProgress" | "withClient" | "credits">;
  month: { id: string; startsAt: string; endsAt: string } | null;
  credits: Client["credits"];
  requests: Req[];
  styleGuide: Record<string, unknown> | null;
  team: { email: string; name: string }[];
  /* who a new request lands on unless somebody says otherwise */
  defaultProducer: string | null;
};

const COLUMN_TONE: Record<EditingColumn, "neutral" | "warn" | "info" | "good" | "bad"> = {
  waiting: "warn",
  queued: "neutral",
  in_production: "info",
  ready: "good",
  revisions: "bad",
  approved: "good",
};

const BOARD_COLUMNS: BoardColumn[] = EDITING_COLUMNS.map((c) => ({
  key: c.key,
  label: c.label,
  tone: COLUMN_TONE[c.key],
}));

const dueChip = (r: { dueAt: string | null; requestedDueAt: string | null; status: string }) => {
  if (r.dueAt) {
    const late = Date.parse(r.dueAt) < Date.now() && !["approved"].includes(r.status);
    return { due: `due ${when(r.dueAt)}`, dueTone: (late ? "bad" : "neutral") as "bad" | "neutral" };
  }
  if (r.requestedDueAt)
    return { due: `asked ${when(r.requestedDueAt)}`, dueTone: "warn" as const };
  return { due: null, dueTone: "neutral" as const };
};

const mins = (s: number | null) => (s ? `${Math.round(s / 60)} min` : null);

/* a request we type in for them, when the ask arrived by email or on a call */
type Draft = {
  title: string;
  brief: string;
  editType: string;
  runtimeMinutes: string;
  aspect: string;
  targetMinutes: string;
  assetsUrl: string;
  referenceUrl: string;
  requestedDueAt: string;
  dueAt: string;
  assignedTo: string;
  assetsReady: boolean;
  notify: boolean;
  cuts: string;
};

const EMPTY_DRAFT: Draft = {
  title: "",
  brief: "",
  editType: "mid",
  runtimeMinutes: "",
  aspect: "",
  targetMinutes: "",
  assetsUrl: "",
  referenceUrl: "",
  requestedDueAt: "",
  dueAt: "",
  assignedTo: "",
  assetsReady: false,
  notify: true,
  cuts: "",
};

/* ---------------- the client list ---------------- */

export function EditingClients({ onOpen }: { onOpen: (id: string) => void }) {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/admin/editing", { headers: await authHeader() });
        const j = await r.json();
        if (!r.ok) return setErr(j.error ?? "Could not load editing clients.");
        setClients(j.clients as Client[]);
      } catch {
        setErr("Could not load editing clients.");
      }
    })();
  }, []);

  if (err) return <p className="text-body text-error">{err}</p>;
  if (!clients) return <p className="text-body text-muted">Loading...</p>;
  if (!clients.length)
    return (
      <p className="text-body text-muted">
        Nobody is on an editing plan yet. When somebody subscribes they appear here.
      </p>
    );

  return (
    <div className="grid gap-2.5">
      {clients.map((c) => (
        <button
          key={c.subscriptionId}
          type="button"
          /* the handle if they have one, the id if they do not: either opens */
          onClick={() => onOpen(c.slug ?? c.subscriptionId)}
          className="tap w-full rounded-[12px] border border-hair bg-surface p-5 text-left transition-colors hover:border-gold/50"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-body font-semibold text-ink">
                {c.name || c.email}
                <span className="ml-3 font-mono text-body-sm text-gold">{c.planName}</span>
              </p>
              <p className="mt-0.5 font-mono text-label uppercase text-dim">
                {c.email}
                {c.company ? ` / ${c.company}` : ""}
                {c.renewsAt ? ` / renews ${when(c.renewsAt)}` : ""}
              </p>
              <p className="mt-2 font-mono text-body-sm tabular-nums text-muted">
                {c.credits.spent} of {c.credits.allowed} credits this month
                {c.credits.topupLeft > 0 ? `, plus ${c.credits.topupLeft} bought` : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {c.waitingOnThem > 0 && (
                <Chip tone="warn">{c.waitingOnThem} footage to check</Chip>
              )}
              {c.needsUs > 0 && <Chip tone="bad">{c.needsUs} needs us</Chip>}
              {c.inProgress > 0 && <Chip tone="info">{c.inProgress} in progress</Chip>}
              {c.withClient > 0 && <Chip tone="good">{c.withClient} with client</Chip>}
              <ChevronRight size={16} className="text-dim" aria-hidden="true" />
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

/* ---------------- one client's board ---------------- */

export function EditingBoard({ slug, onBack }: { slug: string; onBack: () => void }) {
  const [b, setB] = useState<Board | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/editing?client=${encodeURIComponent(slug)}`, {
        headers: await authHeader(),
      });
      const j = await r.json();
      if (!r.ok) return setErr(j.error ?? "Could not load this board.");
      setB(j as Board);
    } catch {
      setErr("Could not load this board.");
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * `optimistic` is the change to show on the request at once.
   *
   * The six QC boxes are the most clicked thing on this panel, and each tick
   * was a write plus a whole board reload with the controls disabled
   * throughout, so ticking six of them meant six waits in a row for a
   * checkbox that had already been clicked.
   *
   * The reload still runs, because the board derives things a tick can move
   * (which column a request sits in, what the credits say), but it is not
   * awaited when the caller has already said what to show.
   */
  async function save(
    reqId: string,
    patch: Record<string, unknown>,
    optimistic?: Partial<Req>,
  ) {
    const before = b;
    if (optimistic) {
      setB((cur) =>
        !cur
          ? cur
          : {
              ...cur,
              requests: cur.requests.map((r) =>
                r.id === reqId ? { ...r, ...optimistic } : r,
              ),
            },
      );
      setErr("");
    } else {
      setBusy(true);
      setErr("");
    }
    try {
      const r = await fetch("/api/admin/editing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ id: reqId, ...patch }),
      });
      const j = await r.json();
      if (!r.ok) {
        setB(before);
        setErr(j.error ?? "Could not save that.");
      } else {
        /* an over-plan note is information, not a failure: the work is in */
        if (typeof j.warning === "string" && j.warning) setErr(j.warning);
        if (optimistic) void load();
        else await load();
      }
    } catch {
      setB(before);
      setErr("Could not save that.");
    } finally {
      if (!optimistic) setBusy(false);
    }
  }

  /* the request we are taking down for them. Same row the client's own form
     writes, into the same month, so it shows on their plan screen too. */
  async function add() {
    if (!draft || !b) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/editing", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({
          subscriptionId: b.client.subscriptionId,
          ...draft,
          cuts: draft.cuts
            .split("\n")
            .map((c) => c.trim())
            .filter(Boolean),
        }),
      });
      const j = await r.json();
      if (!r.ok) return setErr(j.error ?? "Could not add that.");
      setDraft(null);
      setNote(j.warning ?? "");
      await load();
    } catch {
      setErr("Could not add that.");
    } finally {
      setBusy(false);
    }
  }

  if (err && !b) return <p className="text-body text-error">{err}</p>;
  if (!b) return <p className="text-body text-muted">Loading...</p>;

  const live = b.requests.filter((r) => !r.cancelledAt);
  const opened = open ? b.requests.find((r) => r.id === open) : null;

  /*
   * A request takes over the screen rather than sliding in beside the board.
   *
   * The drawer was a documented exception to the modal rule, and it stopped
   * being the right one. This holds the brief, the footage, the cut, the
   * client's whole feedback thread and now a player to watch it against:
   * that never fitted in a panel a third of the width, and reading a note
   * about the second something happens while the video lives somewhere else
   * entirely is how notes get answered wrongly. Production jobs made the
   * same move for the same reason (owner's decision, 28 August 2026).
   */
  if (opened) {
    return (
      <EditingJob
        req={opened}
        board={b}
        busy={busy}
        onSave={save}
        onBack={() => setOpen(null)}
        onOpen={setOpen}
      />
    );
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={onBack}
        className="tap inline-flex items-center gap-2 font-mono text-label uppercase text-muted transition-colors hover:text-gold"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        All editing clients
      </button>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-h3 text-ink">{b.client.name || b.client.email}</h2>
          <p className="mt-1 font-mono text-label uppercase text-dim">
            {b.client.planName} / {b.client.email}
            {b.month ? ` / month of ${when(b.month.startsAt)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <p className="font-mono text-body-sm tabular-nums text-muted">
            {b.credits.spent} of {b.credits.allowed} credits
            {b.credits.topupLeft > 0 ? `, plus ${b.credits.topupLeft} bought` : ""}
          </p>
          <Button
            variant="brand"
            icon={<Plus />}
            onClick={() =>
              setDraft({ ...EMPTY_DRAFT, assignedTo: b.defaultProducer ?? "" })
            }
          >
            Add a request
          </Button>
        </div>
      </div>

      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}

      {/* the over plan sentence, kept up until it is read rather than flashed */}
      {note && (
        <div className="mt-4 flex items-start justify-between gap-4 rounded-[8px] border border-gold/40 bg-gold/5 p-4">
          <p className="text-body-sm text-gold">{note}</p>
          <button
            type="button"
            onClick={() => setNote("")}
            className="tap shrink-0 font-mono text-label uppercase text-dim transition-colors hover:text-ink"
          >
            Got it
          </button>
        </div>
      )}

      <AddRequest
        draft={draft}
        team={b.team}
        busy={busy}
        onChange={setDraft}
        onClose={() => setDraft(null)}
        onSave={add}
      />

      {/* the board: drag a card to move the work; the same gates the buttons
          obey say no by bouncing the card back with the reason */}
      <div className="mt-5 overflow-x-auto pb-2">
        <div className="min-w-[72rem]">
          <KanbanBoard
            columns={BOARD_COLUMNS}
            items={live.map(
              (r): BoardItem => ({
                id: r.id,
                column: r.column,
                title: r.title,
                meta: [
                  r.parentId ? "cut" : null,
                  r.typeLabel ?? "edit",
                  r.creditCost ? `${r.creditCost} cr` : null,
                  r.aspect,
                  mins(r.targetSeconds),
                ]
                  .filter(Boolean)
                  .join(" / "),
                assignee: r.assignedTo,
                /* the thing that went wrong before this existed: three notes
                   from a client sat unread for a day, and the board looked
                   exactly the same as it had the day before */
                alert: r.openNotes
                  ? `${r.openNotes} ${r.openNotes === 1 ? "note" : "notes"} to answer`
                  : null,
                /* the client nearly always sent a link, so the ball is ours
                   to check it. Only a request with no link at all is on them. */
                warn:
                  r.column === "waiting"
                    ? r.assetsUrl
                      ? "footage to check"
                      : "no footage yet"
                    : null,
                ...dueChip(r),
              }),
            )}
            onOpen={setOpen}
            onMove={async (reqId, to) => {
              const item = b.requests.find((x) => x.id === reqId);
              if (!item) return null;
              const r = await fetch("/api/admin/editing", {
                method: "PATCH",
                headers: { "Content-Type": "application/json", ...(await authHeader()) },
                body: JSON.stringify({
                  id: reqId,
                  ...boardMovePatch(item.column, to as EditingColumn),
                }),
              })
                .then((x) => x.json().then((j) => ({ ok: x.ok, j })))
                .catch(() => ({ ok: false, j: { error: "Could not move that." } }));
              if (!r.ok) return String(r.j.error ?? "Could not move that.");
              await load();
              return null;
            }}
          />
        </div>
      </div>

      <StyleGuideCard guide={b.styleGuide} email={b.client.email} />
      <StyleGuideAdmin email={b.client.email} />

    </div>
  );
}

/* ---------------- taking a request down for them ---------------- */

/*
 * The client's own form, from our side of the desk.
 *
 * Same fields they would have filled in, plus the three only we can answer:
 * whether the footage is already with us, who is cutting it, and what we are
 * promising. Footage is optional here because half of these are typed up
 * while the files are still on their way.
 */
function AddRequest({
  draft: d,
  team,
  busy,
  onChange,
  onClose,
  onSave,
}: {
  draft: Draft | null;
  team: { email: string; name: string }[];
  busy: boolean;
  onChange: (d: Draft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => d && onChange({ ...d, [k]: v });

  return (
    <Modal
      open={!!d}
      onClose={onClose}
      title="Add a request"
      subtitle="For work they asked for by email, on WhatsApp or on a call. It lands on their plan the same as one they typed themselves."
    >
      {d && (
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <Field label="Video name" required hint="What you would call it out loud.">
              <Input
                value={d.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="March webinar, cut down"
              />
            </Field>
            <Field label="What kind" hint="What it costs them.">
              <Select
                value={d.editType}
                onChange={(e) => set("editType", e.target.value)}
              >
                {EDIT_TIERS.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="What they asked for" required hint="In their words if you have them. The editor works from this.">
            <Textarea
              rows={3}
              value={d.brief}
              onChange={(e) => set("brief", e.target.value)}
              placeholder="Cut the 45 minute webinar to 8 minutes, keep the demo section, captions throughout."
            />
          </Field>

          {isPodcast(d.editType) && (
            <Field
              label="Finished runtime"
              required
              hint="In minutes. Podcasts are priced on the length of the finished episode."
            >
              <Input
                type="number"
                min="1"
                step="5"
                value={d.runtimeMinutes}
                onChange={(e) => set("runtimeMinutes", e.target.value)}
                placeholder="60"
              />
            </Field>
          )}

          <p className="rounded-[8px] border border-hair bg-canvas px-4 py-2.5 text-body-sm text-muted">
            This spends{" "}
            <span className="font-mono tabular-nums text-gold">
              {creditCost(d.editType, d.runtimeMinutes ? Number(d.runtimeMinutes) : null)} credits
            </span>{" "}
            of their month, before any short cuts.
          </p>

          {(
            <Field
              label={d.editType === "short" ? "More shorts from the same footage" : "Short cuts from it"}
              hint="One per line. Each becomes its own video costing 1 credit, with its own review."
            >
              <Textarea
                rows={3}
                value={d.cuts}
                onChange={(e) => set("cuts", e.target.value)}
                placeholder={"The pricing answer\nThe objection at 22 minutes"}
              />
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Shape" hint="Where it is going to be posted.">
              <Select value={d.aspect} onChange={(e) => set("aspect", e.target.value)}>
                <option value="">Not decided</option>
                {ASPECTS.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Target length" hint="Minutes. Leave empty if they did not say.">
              <Input
                type="number"
                min={0}
                value={d.targetMinutes}
                onChange={(e) => set("targetMinutes", e.target.value)}
                placeholder="8"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Footage" hint="Drive, Dropbox, Frame.io, whatever they sent.">
              <Input
                value={d.assetsUrl}
                onChange={(e) => set("assetsUrl", e.target.value)}
                placeholder="https://"
              />
            </Field>
            <Field label="Reference" hint="A video they want it to feel like. Optional.">
              <Input
                value={d.referenceUrl}
                onChange={(e) => set("referenceUrl", e.target.value)}
                placeholder="https://"
              />
            </Field>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 text-body-sm">
            <input
              type="checkbox"
              checked={d.assetsReady}
              onChange={(e) => set("assetsReady", e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[color:var(--green)]"
            />
            <span className="text-muted">
              The footage is already with us.
              <span className="block text-dim">
                Ticking this starts the turnaround clock now. Leave it off and the request sits in
                Needs footage until you have checked the files.
              </span>
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="They asked for" hint="Their date, if they gave one.">
              <Input
                type="date"
                value={d.requestedDueAt}
                onChange={(e) => set("requestedDueAt", e.target.value)}
              />
            </Field>
            <Field label="We promise" hint="Ours. Can wait until the footage is in.">
              <Input type="date" value={d.dueAt} onChange={(e) => set("dueAt", e.target.value)} />
            </Field>
            <Field label="Producer" hint="Who runs this with the client.">
              <Select value={d.assignedTo} onChange={(e) => set("assignedTo", e.target.value)}>
                <option value="">Nobody yet</option>
                {team.map((t) => (
                  <option key={t.email} value={t.email}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 text-body-sm">
            <input
              type="checkbox"
              checked={d.notify}
              onChange={(e) => set("notify", e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[color:var(--green)]"
            />
            <span className="text-muted">
              Tell them it is in.
              <span className="block text-dim">
                A note in their portal saying we added it. Turn this off when you are catching up on
                old jobs.
              </span>
            </span>
          </label>

          <div className="flex justify-end gap-2 border-t border-hair pt-4">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="brand" disabled={busy} onClick={onSave}>
              {busy ? "Adding..." : "Add the request"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ---------------- one request ---------------- */

/*
 * One editing request, on a full page.
 *
 * Everything about one video in one place: what they asked for, the footage,
 * the cut, the resources both sides have sent, the client's feedback thread
 * with the cut playing next to it, and our own internal notes.
 */
/*
 * Changing a request after it is in, from our side.
 *
 * Nothing here was editable once the row existed. A wrong title, or a brief
 * that missed the thing the client said on the call, was a note to a producer
 * who could not act on it either. The client could already fix their own
 * request; we could fix nothing.
 *
 * Type and length are not here on purpose. They set what the request costs in
 * credits, so changing one re-bills the client's month. That is a
 * conversation, not a text field on a form.
 */
/*
 * Every cut this request has had.
 *
 * One link field used to mean one cut: pasting the revision over the top left
 * the client's notes pinned to seconds in a video nobody could open any more,
 * with nothing saying which round they belonged to. Orders and custom
 * projects have recorded this for months and plan work never did.
 *
 * Read only here. Removing a cut is possible on the order board and is not
 * worth a second way to do it until somebody asks.
 */
function Cuts({ requestId, current }: { requestId: string; current: string | null }) {
  const [rows, setRows] = useState<{ id: string; version: number; videoUrl: string; createdAt: string }[] | null>(
    null,
  );

  useEffect(() => {
    let live = true;
    (async () => {
      const r = await fetch(`/api/admin/deliverables/${requestId}/versions/`, {
        headers: await authHeader(),
      }).catch(() => null);
      const j = await r?.json().catch(() => null);
      if (live) setRows(j?.versions ?? []);
    })();
    return () => {
      live = false;
    };
  }, [requestId, current]);

  if (!rows?.length) return null;

  return (
    <div className="mt-4 border-t border-hair pt-3">
      <p className="font-mono text-label uppercase tracking-[0.08em] text-dim">
        Cuts so far
      </p>
      <ul className="mt-2 grid gap-1.5">
        {rows.map((v, i) => (
          <li
            key={v.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-hair bg-canvas px-3 py-2"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="font-mono text-label uppercase text-muted">v{v.version}</span>
              {i === 0 && (
                <span className="rounded-full border border-green/40 px-2 py-0.5 font-mono text-label text-green">
                  current
                </span>
              )}
              <span className="truncate text-body-sm text-dim">{when(v.createdAt)}</span>
            </span>
            <a
              href={v.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="tap shrink-0 font-mono text-label uppercase text-blue hover:underline"
            >
              Open
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EditDetails({
  req: r,
  onSave,
  busy,
}: {
  req: Req;
  onSave: (id: string, patch: Record<string, unknown>, optimistic?: Partial<Req>) => Promise<void>;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: r.title, brief: r.brief ?? "", aspect: r.aspect ?? "" });

  function start() {
    setForm({ title: r.title, brief: r.brief ?? "", aspect: r.aspect ?? "" });
    setOpen(true);
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={start}>
        Change details
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Change this request"
        subtitle="The client sees these. What it costs in credits is set by the type and length, which are not changed here."
      >
        <div className="grid gap-4">
          <Field label="Video name" required>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="The brief" hint="What they asked for, in their words where you have them.">
            <Textarea
              rows={5}
              value={form.brief}
              onChange={(e) => setForm({ ...form, brief: e.target.value })}
            />
          </Field>
          <Field label="Shape" hint="The aspect the finished cut is delivered in.">
            <Select
              value={form.aspect}
              onChange={(e) => setForm({ ...form, aspect: e.target.value })}
            >
              <option value="">Not set</option>
              {ASPECTS.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-end gap-2 border-t border-hair pt-4">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              disabled={busy || !form.title.trim()}
              onClick={async () => {
                await onSave(
                  r.id,
                  { title: form.title.trim(), brief: form.brief, aspect: form.aspect },
                  { title: form.title.trim(), brief: form.brief, aspect: form.aspect || null },
                );
                setOpen(false);
              }}
            >
              {busy ? "Saving..." : "Save the changes"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function EditingJob({
  req: r,
  board: b,
  busy,
  onSave,
  onBack,
  onOpen,
}: {
  req: Req;
  board: Board;
  busy: boolean;
  onSave: (id: string, patch: Record<string, unknown>, optimistic?: Partial<Req>) => Promise<void>;
  onBack: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="w-full">
      <button
        type="button"
        onClick={onBack}
        className="tap inline-flex items-center gap-2 font-mono text-label uppercase text-muted transition-colors hover:text-gold"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        {b.client.name || b.client.email}
      </button>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <EditDetails req={r} onSave={onSave} busy={busy} />
      </div>

      <div className="mt-2">
        <RequestDetail req={r} board={b} busy={busy} onSave={onSave} onOpen={onOpen}>
          <ReviewRoom requestId={r.id} title={r.title} videoUrl={r.videoUrl ?? null} />

          {/* the same list the client sees on the request: their logo and
              images come in here, and anything we hand back goes out the same
              way. An editor opening this should not have to go looking through
              email for the logo. */}
          <Attachments
            endpoint={`/api/admin/projects/files?deliverableId=${r.id}`}
            extraFields={{ deliverableId: r.id }}
            viewer="studio"
            title="Resources for this video"
            description="What the client sent to be used in the cut, and anything we send back."
            empty="Nothing attached to this one."
            authedFetch={adminFetch}
          />

          <ItemNotes target={{ deliverableId: r.id }} authHeader={authHeader} />
        </RequestDetail>
      </div>
    </div>
  );
}

type Note = {
  id: string;
  side: "client" | "studio";
  name: string;
  body: string;
  atSeconds: number | null;
  stamp: string | null;
  parentId: string | null;
  resolved: boolean;
  createdAt: string;
};

/*
 * What the client said about this cut.
 *
 * They could always say it: the review room writes their notes the same way
 * for a plan video as for any other. Nothing on this side could read them
 * back. The admin comments route is addressed by ORDER, and a plan's videos
 * belong to a billing cycle with no order anywhere on them, so the board had
 * no URL to ask with. Feedback went out as a notification email and then
 * lived nowhere a person works, which from the client's side looks like
 * being ignored.
 *
 * Deliberately the same shape the production board uses: gold for their
 * notes, replies indented under the note they answer, Mark done on the
 * client's ones only. Somebody moving between the two boards should not have
 * to learn a second way of reading the same thing.
 */
function ReviewRoom({
  requestId,
  title,
  videoUrl,
}: {
  requestId: string;
  title: string;
  videoUrl: string | null;
}) {
  const media = useRef<HTMLVideoElement>(null);
  const [rows, setRows] = useState<Note[] | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  /*
   * A note says "the logo at 0:42 is the old one". Reading that with the cut
   * open in some other tab means scrubbing for 0:42 by hand, every time, and
   * an editor who cannot find the moment answers the note from memory. The
   * stamp is the control: press it and the video is there.
   */
  function seek(atSeconds: number) {
    const v = media.current;
    if (!v) return;
    v.currentTime = atSeconds;
    void v.play().catch(() => {});
  }

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/deliverables/${requestId}/comments`, {
      headers: await authHeader(),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setRows((j?.comments as Note[] | undefined) ?? []);
  }, [requestId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(patch: Record<string, unknown>) {
    setBusy(true);
    setErr("");
    const r = await fetch(`/api/admin/deliverables/${requestId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify(patch),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(false);
    if (r && !r.ok) return setErr(j?.error ?? "Could not save.");
    setReplyTo(null);
    setReplyText("");
    await load();
  }

  /* Enter sends, shift and enter makes a new line. */
  const enterSends = (fn: () => void) => (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      fn();
    }
  };

  const top = (rows ?? []).filter((c) => !c.parentId);
  const repliesOf = (id: string) => (rows ?? []).filter((c) => c.parentId === id);
  const open = top.filter((c) => c.side === "client" && !c.resolved).length;

  return (
    <Card
      title="Review room"
      description={
        open > 0
          ? `${open} still open on ${title}.`
          : "Their notes on this cut, and your answers."
      }
    >
      {/* the cut, here rather than in another tab, so a stamp can be pressed */}
      {videoUrl ? (
        <video
          ref={media}
          controls
          preload="metadata"
          playsInline
          src={videoUrl}
          className="mb-3 max-h-[52vh] w-full rounded-[8px] bg-black"
        />
      ) : (
        <p className="mb-3 text-body-sm text-dim">
          No cut linked yet. Paste one above and their notes will play against it.
        </p>
      )}

      {err && <p className="mb-2 text-body-sm text-error">{err}</p>}

      {rows === null ? (
        <p className="text-body-sm text-muted">Loading notes...</p>
      ) : top.length === 0 ? (
        <p className="text-body-sm text-dim">Nothing from them on this one yet.</p>
      ) : (
        <ul className="grid gap-2">
          {top.map((c) => (
            <li
              key={c.id}
              className={`rounded-[8px] border p-3 ${
                c.side === "client" ? "border-gold/30 bg-gold/5" : "border-hair bg-surface"
              } ${c.resolved ? "opacity-60" : ""}`}
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-body-sm font-semibold text-ink">{c.name}</span>
                {c.stamp && (
                  <button
                    type="button"
                    onClick={() => c.atSeconds != null && seek(c.atSeconds)}
                    disabled={!videoUrl || c.atSeconds == null}
                    className="tap rounded-full border border-gold/40 px-2 py-0.5 font-mono text-label text-gold transition-colors hover:bg-gold hover:text-canvas disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-gold"
                    aria-label={`Play from ${c.stamp}`}
                  >
                    {c.stamp}
                  </button>
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
              <p className="mt-1 font-mono text-label uppercase tracking-[0.08em] text-muted">
                {when(c.createdAt)}
              </p>

              {repliesOf(c.id).map((x) => (
                <div key={x.id} className="mt-2 border-l-2 border-blue/40 pl-3">
                  <span className="text-body-sm font-semibold text-ink">{x.name}</span>
                  <p className="mt-0.5 whitespace-pre-wrap text-body-sm text-muted">{x.body}</p>
                  <p className="mt-0.5 font-mono text-label uppercase tracking-[0.08em] text-muted">
                    {when(x.createdAt)}
                  </p>
                </div>
              ))}

              {replyTo === c.id ? (
                <div className="mt-2 grid gap-2">
                  <Textarea
                    rows={2}
                    autoFocus
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={enterSends(() => post({ body: replyText, parentId: c.id }))}
                    placeholder="Answer this note. Enter to send."
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      disabled={busy || !replyText.trim()}
                      onClick={() => post({ body: replyText, parentId: c.id })}
                    >
                      Send
                    </Button>
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTo(null);
                        setReplyText("");
                      }}
                      className="tap font-mono text-label uppercase text-dim transition-colors hover:text-muted"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setReplyTo(c.id);
                    setReplyText("");
                  }}
                  className="tap mt-2 font-mono text-label uppercase tracking-[0.08em] text-muted transition-colors hover:text-gold"
                >
                  Reply to this note
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/*
 * More shorts from the same footage, added to a request that already exists.
 * One per line; each becomes its own video under this request, in this
 * month, costing one short credit, with its own review. Beant Singh asked
 * for three shorts in one short request and there was no way to add them.
 */
function MoreShorts({
  req: r,
  busy,
  onSave,
}: {
  req: Req;
  busy: boolean;
  onSave: (id: string, patch: Record<string, unknown>, optimistic?: Partial<Req>) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const lines = text
    .split("\n")
    .map((c) => c.trim())
    .filter(Boolean);
  return (
    <div className="grid gap-3">
      <Field
        label={r.editType === "short" || isBatch(r.editType) ? "More shorts from the same footage" : "More short cuts from it"}
        hint="One per line. Each becomes its own video costing 1 credit, with its own review."
      >
        <Textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"The pricing answer\nThe objection at 22 minutes"}
        />
      </Field>
      <div>
        <Button
          variant="brand"
          size="sm"
          disabled={busy || !lines.length}
          onClick={async () => {
            await onSave(r.id, { addCuts: lines });
            setText("");
          }}
        >
          {lines.length
            ? `Add ${lines.length} ${lines.length === 1 ? "short" : "shorts"}, ${lines.length} ${lines.length === 1 ? "credit" : "credits"}`
            : "Add shorts"}
        </Button>
      </div>
    </div>
  );
}

function RequestDetail({
  req: r,
  board: b,
  busy,
  onSave,
  onOpen,
  children,
}: {
  /* opens one of this request's shorts as its own page */
  onOpen?: (id: string) => void;
  /* the review room, resources and team notes: they are about this cut, so
     they sit in the work column under it, and the sidebar stays beside the
     whole stack instead of the page splitting into two widths */
  children?: React.ReactNode;
  req: Req;
  board: Board;
  busy: boolean;
  onSave: (
    id: string,
    patch: Record<string, unknown>,
    optimistic?: Partial<Req>,
  ) => Promise<void>;
}) {
  const [url, setUrl] = useState(r.videoUrl ?? "");
  const missing = qcRemaining(r.qc);
  const cuts = b.requests.filter((x) => x.parentId === r.id);
  const parent = r.parentId ? b.requests.find((x) => x.id === r.parentId) : null;

  const cutsCredits = cuts.reduce((n, c) => n + c.creditCost, 0);

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_20rem] lg:items-start">
      <div className="grid min-w-0 gap-3">
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-h4 font-semibold text-ink">{r.title}</h3>
            <Chip tone={COLUMN_TONE[r.column]}>
              {EDITING_COLUMNS.find((c) => c.key === r.column)?.label ?? r.status}
            </Chip>
            {r.typeLabel && <Chip tone="neutral">{r.typeLabel}</Chip>}
            {r.creditCost > 0 && (
              <Chip tone="neutral">
                {r.creditCost} {r.creditCost === 1 ? "credit" : "credits"}
              </Chip>
            )}
            {r.aspect && <Chip tone="neutral">{r.aspect}</Chip>}
            {isBatch(r.editType) && cuts.length > 0 && (
              <Chip tone="neutral">
                {cutsCredits} {cutsCredits === 1 ? "credit" : "credits"} in {cuts.length}{" "}
                {cuts.length === 1 ? "short" : "shorts"}
              </Chip>
            )}
            {r.revisionRound > 0 && <Chip tone="warn">round {r.revisionRound + 1}</Chip>}
          </div>

          {parent && (
            <p className="mt-2 text-body-sm text-muted">
              A cut from <span className="text-ink">{parent.title}</span>.
            </p>
          )}

          {r.brief && (
            <p className="mt-3 whitespace-pre-wrap text-body-sm text-muted">{r.brief}</p>
          )}

          <dl className="mt-4 grid gap-2 text-body-sm sm:grid-cols-2">
            {[
              ["Footage", r.assetsUrl],
              ["Reference", r.referenceUrl],
            ].map(([k, v]) => (
              <div key={k as string}>
                <dt className="font-mono text-label uppercase text-dim">{k}</dt>
                <dd className="mt-0.5 break-all">
                  {v ? (
                    <a
                      href={v as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue underline underline-offset-2"
                    >
                      {v}
                    </a>
                  ) : (
                    <span className="text-dim">not given</span>
                  )}
                </dd>
              </div>
            ))}
            <div>
              <dt className="font-mono text-label uppercase text-dim">They asked for</dt>
              <dd className="mt-0.5 text-muted">
                {r.requestedDueAt ? when(r.requestedDueAt) : "no date"}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-label uppercase text-dim">Target length</dt>
              <dd className="mt-0.5 text-muted">{mins(r.targetSeconds) ?? "not given"}</dd>
            </div>
          </dl>
        </Card>

        {/* Shorts under this request: the ones already taken down, then the
            box to add more. One place for the request's scope, rather than the
            add box living under Producer where it had nothing to do. A cut
            cannot have cuts of its own, so a cut shows nothing here. */}
        {!r.parentId && (
          <Card
            title="Shorts under this request"
            description="Each is its own video, one credit, with its own review."
          >
            {/* a request like "make 3 shorts from video 1" is a brief, not a
                video: tick this and the request costs nothing itself while
                each short below costs one credit */}
            <label className="mb-4 flex cursor-pointer items-start gap-2.5 text-body-sm">
              <input
                type="checkbox"
                checked={isBatch(r.editType)}
                disabled={busy}
                onChange={(e) => onSave(r.id, { batch: e.target.checked })}
                className="mt-0.5 size-4 shrink-0 accent-[color:var(--green)]"
              />
              <span className="text-muted">
                A batch of shorts: the request itself costs nothing, each short below costs one credit.
              </span>
            </label>
            {cuts.length > 0 && (
              <ul className="grid gap-2">
                {cuts.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-start justify-between gap-3 border-t border-hair pt-2 first:border-t-0 first:pt-0"
                  >
                    <div className="min-w-0">
                      {/* each short is its own request: its own cut, stage,
                          checklist and review room live on its own page */}
                      <button
                        type="button"
                        onClick={() => onOpen?.(c.id)}
                        className="tap text-left text-body-sm font-semibold text-ink hover:text-gold"
                      >
                        {c.title}
                      </button>
                      {c.brief && <p className="mt-0.5 text-body-sm text-muted">{c.brief}</p>}
                      <p className="mt-0.5 font-mono text-label uppercase text-dim">
                        {c.videoUrl ? "cut in" : "no cut yet"} / {c.creditCost}{" "}
                        {c.creditCost === 1 ? "credit" : "credits"}
                      </p>
                    </div>
                    <Chip tone={COLUMN_TONE[c.column]}>
                      {EDITING_COLUMNS.find((x) => x.key === c.column)?.label}
                    </Chip>
                  </li>
                ))}
              </ul>
            )}
            <div className={cuts.length > 0 ? "mt-4 border-t border-hair pt-4" : ""}>
              <MoreShorts req={r} busy={busy} onSave={onSave} />
            </div>
          </Card>
        )}

        <Card
          title="The cut"
          description="Pasting a link does not send it. Moving to Review does. Paste the revision over the top when it is ready: the cut it replaces is kept, so their notes stay attached to the round they were written on."
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[16rem] flex-1">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                aria-label="Link to the cut"
              />
            </div>
            <Button
              variant="secondary"
              disabled={busy || url === (r.videoUrl ?? "")}
              onClick={() => onSave(r.id, { videoUrl: url })}
            >
              Save link
            </Button>
          </div>

          <Cuts requestId={r.id} current={r.videoUrl ?? null} />
        </Card>

        <Card
          title="Before it goes to the client"
          description="All six, every time. The Review move is refused until they are ticked."
        >
          <div className="grid gap-2">
            {QC_CHECKS.map((c) => (
              <label key={c.key} className="flex cursor-pointer items-start gap-2.5 text-body-sm">
                <input
                  type="checkbox"
                  checked={Boolean(r.qc[c.key])}
                  disabled={busy}
                  onChange={(e) =>
                    onSave(
                      r.id,
                      { qc: { [c.key]: e.target.checked } },
                      { qc: { ...r.qc, [c.key]: e.target.checked } },
                    )
                  }
                  className="mt-0.5 size-4 shrink-0 accent-[color:var(--green)]"
                />
                <span className={r.qc[c.key] ? "text-dim line-through" : "text-muted"}>
                  {c.label}
                </span>
              </label>
            ))}
          </div>
          {missing.length > 0 && (
            <p className="mt-3 text-body-sm text-gold">
              {missing.length} still to check.
            </p>
          )}
        </Card>


        {children}
      </div>

      <div className="grid gap-3">
        <Card title="Footage">
          {r.assetsReadyAt ? (
            <>
              <p className="text-body-sm text-green">In since {when(r.assetsReadyAt)}.</p>
              <p className="mt-1 text-body-sm text-dim">
                The turnaround promise runs from here, not from when they asked.
              </p>
              <div className="mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => onSave(r.id, { assetsReady: false })}
                >
                  Not in after all
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-body-sm text-muted">
                Nothing promised yet. Open their link, check the footage is
                there and usable, then mark it in.
              </p>
              <div className="mt-3">
                <Button
                  variant="brand"
                  size="sm"
                  disabled={busy}
                  onClick={() => onSave(r.id, { assetsReady: true })}
                >
                  Footage is in
                </Button>
              </div>
            </>
          )}
        </Card>

        <Card title="Who and when">
          <div className="grid gap-3">
            <div>
              <p className="font-mono text-label uppercase text-dim">Producer</p>
              <div className="mt-1">
                <Select
                  value={r.assignedTo ?? ""}
                  disabled={busy}
                  aria-label="Name the producer"
                  onChange={(e) =>
                    onSave(r.id, { assignedTo: e.target.value }, { assignedTo: e.target.value })
                  }
                >
                  <option value="">Nobody yet</option>
                  {b.team.map((t) => (
                    <option key={t.email} value={t.email}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <p className="font-mono text-label uppercase text-dim">We promise</p>
              <div className="mt-1">
                <Input
                  type="date"
                  disabled={busy}
                  aria-label="The date we promise"
                  defaultValue={r.dueAt ? r.dueAt.slice(0, 10) : ""}
                  onChange={(e) =>
                    onSave(r.id, { dueAt: e.target.value }, { dueAt: e.target.value })
                  }
                />
              </div>
              <p className="mt-1.5 text-body-sm text-dim">
                Two to three business days from the footage landing is what the
                editing page sells.
              </p>
            </div>
            <div>
              <p className="font-mono text-label uppercase text-dim">Stage</p>
              <div className="mt-1">
                <Select
                  value={r.status}
                  disabled={busy}
                  aria-label="Stage"
                  onChange={(e) =>
                    onSave(r.id, { status: e.target.value }, { status: e.target.value })
                  }
                >
                  <option value="queued">Edit request</option>
                  <option value="in_production">In progress</option>
                  <option value="ready">Review</option>
                  <option value="revisions">Changes</option>
                  <option value="approved">Approved</option>
                </Select>
              </div>
            </div>
          </div>
        </Card>

        {/* the one destructive thing, kept quiet: a line at the foot of the
            sidebar, not a card that reads as a step in the work */}
        {!r.cancelledAt && (
          <div className="border-t border-hair px-1 pt-3">
            <Button
              variant="danger"
              size="sm"
              disabled={busy}
              onClick={() => {
                const why = window.prompt("Why is it cancelled? The client sees this.");
                if (why === null) return;
                void onSave(r.id, { cancel: true, cancelledReason: why });
              }}
            >
              Cancel and return the slot
            </Button>
            <p className="mt-2 text-body-sm text-dim">
              It stays readable and its slot goes back to the month.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- their style guide, read only here ---------------- */

function StyleGuideCard({
  guide,
  email,
}: {
  guide: Record<string, unknown> | null;
  email: string;
}) {
  const rows: [string, string][] = guide
    ? (
        [
          ["Intro and outro", guide.intro_outro],
          ["Captions", guide.caption_style],
          ["Music", guide.music],
          ["Pacing", guide.pacing],
          ["B roll", guide.broll],
          ["Never do", guide.avoid],
          ["Notes", guide.notes],
        ] as [string, unknown][]
      )
        .filter(([, v]) => typeof v === "string" && v.trim())
        .map(([k, v]) => [k, String(v)])
    : [];

  return (
    <div className="mt-6">
      <Card
        title="How they want it cut"
        description="Their style guide. They write it in their portal, we work to it."
      >
        {rows.length === 0 ? (
          <p className="text-body-sm text-muted">
            {email} has not filled theirs in. Worth asking for: it is the
            difference between one round of changes and three.
          </p>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt className="font-mono text-label uppercase text-dim">{k}</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-body-sm text-muted">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>
    </div>
  );
}
