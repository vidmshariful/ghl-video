"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Button, Card, Chip, Input, Select } from "@/components/portal/ui";
import { authHeader, when } from "./client";
import {
  EDITING_COLUMNS,
  QC_CHECKS,
  qcRemaining,
  boardMovePatch,
  type EditingColumn,
  type Qc,
} from "@/lib/editing-sop";
import {
  Drawer,
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
  form: "long" | "short" | null;
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
  column: EditingColumn;
  cycleId: string;
};

type Client = {
  subscriptionId: string;
  email: string;
  name: string | null;
  company: string | null;
  planName: string;
  status: string;
  renewsAt: string | null;
  slots: { longUsed: number; shortUsed: number; longAllowed: number; shortAllowed: number };
  needsUs: number;
  waitingOnThem: number;
  inProgress: number;
  withClient: number;
};

type Board = {
  client: Omit<Client, "needsUs" | "waitingOnThem" | "inProgress" | "withClient" | "slots">;
  month: { id: string; startsAt: string; endsAt: string } | null;
  slots: Client["slots"];
  requests: Req[];
  styleGuide: Record<string, unknown> | null;
  team: { email: string; name: string }[];
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
          onClick={() => onOpen(c.subscriptionId)}
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
                {c.slots.longUsed} of {c.slots.longAllowed} long form, {c.slots.shortUsed} of{" "}
                {c.slots.shortAllowed} short form this month
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {c.waitingOnThem > 0 && (
                <Chip tone="warn">{c.waitingOnThem} needs footage</Chip>
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

export function EditingBoard({ id, onBack }: { id: string; onBack: () => void }) {
  const [b, setB] = useState<Board | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/editing?subscription=${id}`, {
        headers: await authHeader(),
      });
      const j = await r.json();
      if (!r.ok) return setErr(j.error ?? "Could not load this board.");
      setB(j as Board);
    } catch {
      setErr("Could not load this board.");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(reqId: string, patch: Record<string, unknown>) {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/editing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ id: reqId, ...patch }),
      });
      const j = await r.json();
      if (!r.ok) setErr(j.error ?? "Could not save that.");
      else await load();
    } catch {
      setErr("Could not save that.");
    } finally {
      setBusy(false);
    }
  }

  if (err && !b) return <p className="text-body text-error">{err}</p>;
  if (!b) return <p className="text-body text-muted">Loading...</p>;

  const live = b.requests.filter((r) => !r.cancelledAt);
  const opened = open ? b.requests.find((r) => r.id === open) : null;

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
        <p className="font-mono text-body-sm tabular-nums text-muted">
          {b.slots.longUsed} of {b.slots.longAllowed} long, {b.slots.shortUsed} of{" "}
          {b.slots.shortAllowed} short
        </p>
      </div>

      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}

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
                  r.form === "long" ? "long" : "short",
                  r.aspect,
                  mins(r.targetSeconds),
                ]
                  .filter(Boolean)
                  .join(" / "),
                assignee: r.assignedTo,
                warn: r.column === "waiting" ? "needs footage" : null,
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

      {/* the item, over the board instead of instead of it */}
      <Drawer open={!!opened} onClose={() => setOpen(null)} title={opened?.title ?? ""}>
        {opened && (
          <div className="grid gap-5">
            <RequestDetail req={opened} board={b} busy={busy} onSave={save} />
            <ItemNotes target={{ deliverableId: opened.id }} authHeader={authHeader} />
          </div>
        )}
      </Drawer>
    </div>
  );
}

/* ---------------- one request ---------------- */

function RequestDetail({
  req: r,
  board: b,
  busy,
  onSave,
}: {
  req: Req;
  board: Board;
  busy: boolean;
  onSave: (id: string, patch: Record<string, unknown>) => Promise<void>;
}) {
  const [url, setUrl] = useState(r.videoUrl ?? "");
  const missing = qcRemaining(r.qc);
  const cuts = b.requests.filter((x) => x.parentId === r.id);
  const parent = r.parentId ? b.requests.find((x) => x.id === r.parentId) : null;

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_20rem] lg:items-start">
      <div className="grid min-w-0 gap-3">
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-h4 font-semibold text-ink">{r.title}</h3>
            <Chip tone={COLUMN_TONE[r.column]}>
              {EDITING_COLUMNS.find((c) => c.key === r.column)?.label ?? r.status}
            </Chip>
            <Chip tone="neutral">{r.form === "long" ? "long form" : "short form"}</Chip>
            {r.aspect && <Chip tone="neutral">{r.aspect}</Chip>}
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

        {cuts.length > 0 && (
          <Card
            title="Short cuts from this video"
            description="Each one is its own video with its own slot, review and approval."
          >
            <ul className="grid gap-2">
              {cuts.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-start justify-between gap-3 border-t border-hair pt-2 first:border-t-0 first:pt-0"
                >
                  <div className="min-w-0">
                    <p className="text-body-sm font-semibold text-ink">{c.title}</p>
                    {c.brief && <p className="mt-0.5 text-body-sm text-muted">{c.brief}</p>}
                  </div>
                  <Chip tone={COLUMN_TONE[c.column]}>
                    {EDITING_COLUMNS.find((x) => x.key === c.column)?.label}
                  </Chip>
                </li>
              ))}
            </ul>
          </Card>
        )}

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
                  onChange={(e) => onSave(r.id, { qc: { [c.key]: e.target.checked } })}
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

        <Card title="The cut" description="Pasting a link does not send it. Moving to Review does.">
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
        </Card>
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
              <p className="font-mono text-label uppercase text-dim">Editor</p>
              <div className="mt-1">
                <Select
                  value={r.assignedTo ?? ""}
                  disabled={busy}
                  aria-label="Assign an editor"
                  onChange={(e) => onSave(r.id, { assignedTo: e.target.value })}
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
                  onChange={(e) => onSave(r.id, { dueAt: e.target.value })}
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
                  onChange={(e) => onSave(r.id, { status: e.target.value })}
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

        {!r.cancelledAt && (
          <Card title="Cancel this request">
            <p className="text-body-sm text-muted">
              The request stays readable and its slot goes back to the month.
            </p>
            <div className="mt-3">
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
            </div>
          </Card>
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
