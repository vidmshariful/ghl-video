"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

/*
 * The work-item board: the one system Custom and Editing both wear
 * (decision 195). Columns, draggable cards, a list view with the same
 * grouping, and the drawer that opens an item over the board instead of
 * replacing it.
 *
 * The kit knows NOTHING about videos, projects or QC. It moves cards and
 * reports the move; the feature behind onMove says yes or no, and a no
 * bounces the card back with the reason on screen. The guardrails outrank
 * the paint: a board that let a drag skip the QC gate would be a downgrade
 * in a nice shirt.
 */

export type BoardColumn = {
  key: string;
  label: string;
  /* the stripe and the count chip take the column's colour */
  tone: "neutral" | "info" | "good" | "warn" | "bad";
};

export type BoardItem = {
  id: string;
  column: string;
  title: string;
  /* the small mono line under the title */
  meta?: string;
  /* initials avatar; absent means unassigned */
  assignee?: string | null;
  /* the date chip, already worded ("due Aug 24", "asked for Aug 22") */
  due?: string | null;
  dueTone?: "neutral" | "warn" | "bad";
  /* a warning chip, e.g. "needs footage" */
  warn?: string | null;
  /* progress, e.g. "3/9" */
  progress?: string | null;
  /* 0..100 draws a thin bar along the card's foot in the stripe colour */
  progressPct?: number | null;
};

const TONE_STRIPE: Record<BoardColumn["tone"], string> = {
  neutral: "bg-hair",
  info: "bg-blue",
  good: "bg-green",
  warn: "bg-gold",
  bad: "bg-error",
};

const TONE_TEXT: Record<BoardColumn["tone"], string> = {
  neutral: "text-dim",
  info: "text-blue",
  good: "text-green",
  warn: "text-gold",
  bad: "text-error",
};

export const initialsOf = (name: string) =>
  name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

export function AssigneeDot({ name }: { name: string | null | undefined }) {
  if (!name)
    return (
      <span
        aria-label="Unassigned"
        className="grid h-6 w-6 place-items-center rounded-full border border-dashed border-hair font-mono text-label text-dim"
      >
        ?
      </span>
    );
  return (
    <span
      title={name}
      className="grid h-6 w-6 place-items-center rounded-full border border-hair bg-chrome-2 font-mono text-label font-bold text-chrome-text"
    >
      {initialsOf(name)}
    </span>
  );
}

/* ---------------- the card ---------------- */

export function WorkCard({
  item,
  tone,
  onOpen,
  dragging = false,
}: {
  item: BoardItem;
  tone: BoardColumn["tone"];
  onOpen?: (id: string) => void;
  dragging?: boolean;
}) {
  return (
    <div
      onClick={onOpen ? () => onOpen(item.id) : undefined}
      className={`relative overflow-hidden rounded-[8px] border bg-surface pl-3.5 pr-3 py-2.5 text-left transition-colors ${
        dragging ? "border-gold shadow-xl" : "border-hair hover:border-gold/50"
      } ${onOpen ? "cursor-pointer" : ""}`}
    >
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${TONE_STRIPE[tone]}`} />
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-body-sm font-semibold leading-snug text-ink">
          {item.title}
        </p>
        {/* undefined means the surface has no assignee concept (the client
            side); null means unassigned and shows the dashed dot */}
        {item.assignee !== undefined && <AssigneeDot name={item.assignee} />}
      </div>
      {item.meta && (
        <p className="mt-0.5 truncate font-mono text-label uppercase text-dim">{item.meta}</p>
      )}
      {(item.due || item.warn || item.progress) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {item.warn && (
            <span className="rounded-full border border-gold/50 px-2 py-0.5 font-mono text-label text-gold">
              {item.warn}
            </span>
          )}
          {item.due && (
            <span
              className={`rounded-full border px-2 py-0.5 font-mono text-label ${
                item.dueTone === "bad"
                  ? "border-error/50 text-error"
                  : item.dueTone === "warn"
                    ? "border-gold/50 text-gold"
                    : "border-hair text-dim"
              }`}
            >
              {item.due}
            </span>
          )}
          {item.progress && (
            <span className="rounded-full border border-hair px-2 py-0.5 font-mono text-label tabular-nums text-dim">
              {item.progress}
            </span>
          )}
        </div>
      )}
      {typeof item.progressPct === "number" && (
        <div
          role="progressbar"
          aria-valuenow={Math.round(item.progressPct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progress"
          className="mt-2 h-1 overflow-hidden rounded-full bg-hair/60"
        >
          <div
            className={`h-full ${TONE_STRIPE[tone]} transition-[width]`}
            style={{ width: `${Math.min(100, Math.max(0, item.progressPct))}%` }}
          />
        </div>
      )}
    </div>
  );
}

/* ---------------- the kanban ---------------- */

function DraggableCard({
  item,
  tone,
  onOpen,
}: {
  item: BoardItem;
  tone: BoardColumn["tone"];
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={isDragging ? "opacity-30" : ""}
    >
      <WorkCard item={item} tone={tone} onOpen={onOpen} />
    </div>
  );
}

function Column({
  col,
  items,
  onOpen,
}: {
  col: BoardColumn;
  items: BoardItem[];
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  return (
    <div className="flex min-w-0 flex-col">
      <p className="flex items-baseline justify-between gap-2 px-0.5 font-mono text-label uppercase text-dim">
        <span className={TONE_TEXT[col.tone]}>{col.label}</span>
        <span className="tabular-nums">{items.length}</span>
      </p>
      <div
        ref={setNodeRef}
        className={`mt-2 grid flex-1 auto-rows-min gap-2 rounded-[10px] border border-dashed p-1.5 transition-colors ${
          isOver ? "border-gold/60 bg-gold/[0.04]" : "border-transparent"
        }`}
      >
        {items.map((i) => (
          <DraggableCard key={i.id} item={i} tone={col.tone} onOpen={onOpen} />
        ))}
        {items.length === 0 && (
          <p className="rounded-[8px] border border-dashed border-hair px-3 py-5 text-center font-mono text-label uppercase text-dim">
            drop here
          </p>
        )}
      </div>
    </div>
  );
}

export function KanbanBoard({
  columns,
  items,
  onOpen,
  onMove,
}: {
  columns: BoardColumn[];
  items: BoardItem[];
  onOpen: (id: string) => void;
  /* return an error sentence to bounce the move, null to accept */
  onMove: (id: string, toColumn: string) => Promise<string | null>;
}) {
  const [bounce, setBounce] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  /* small press-distance so a click still opens the drawer */
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    if (!bounce) return;
    const t = setTimeout(() => setBounce(""), 4500);
    return () => clearTimeout(t);
  }, [bounce]);

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const to = e.over?.id;
    const id = String(e.active.id);
    if (!to) return;
    const item = items.find((i) => i.id === id);
    if (!item || item.column === to) return;
    const refused = await onMove(id, String(to));
    if (refused) setBounce(refused);
  }

  const active = activeId ? items.find((i) => i.id === activeId) : null;
  const activeTone = active
    ? (columns.find((c) => c.key === active.column)?.tone ?? "neutral")
    : "neutral";

  return (
    <div>
      {bounce && (
        <p
          role="status"
          className="mb-3 rounded-[8px] border border-gold/50 bg-gold/[0.07] px-3.5 py-2.5 text-body-sm text-ink"
        >
          {bounce}
        </p>
      )}
      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(11rem, 1fr))` }}
        >
          {columns.map((c) => (
            <Column
              key={c.key}
              col={c}
              items={items.filter((i) => i.column === c.key)}
              onOpen={onOpen}
            />
          ))}
        </div>
        <DragOverlay>
          {active ? <WorkCard item={active} tone={activeTone} dragging /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

/* ---------------- the drawer ---------------- */

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-canvas/70"
      />
      <aside
        role="dialog"
        aria-label={title}
        className="portal-sheet absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-hair bg-surface shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-hair px-5 py-3.5">
          <p className="min-w-0 truncate text-body font-semibold text-ink">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the panel"
            className="tap grid h-8 w-8 place-items-center rounded-[8px] border border-hair text-muted transition-colors hover:border-gold/60 hover:text-gold"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  );
}

/* ---------------- internal notes, in the drawer ---------------- */

type Note = { id: string; author: string; body: string; at: string };

export function ItemNotes({
  target,
  authHeader,
}: {
  target: { deliverableId?: string; projectId?: string };
  authHeader: () => Promise<Record<string, string>>;
}) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const qs = target.deliverableId
    ? `deliverableId=${target.deliverableId}`
    : `projectId=${target.projectId}`;

  useEffect(() => {
    let live = true;
    (async () => {
      const r = await fetch(`/api/admin/work-notes?${qs}`, { headers: await authHeader() });
      const j = await r.json();
      if (live && r.ok) setNotes(j.notes ?? []);
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  async function post() {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/work-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ ...target, body: draft }),
      });
      const j = await r.json();
      if (r.ok && j.note) {
        setNotes((n) => [...(n ?? []), j.note as Note]);
        setDraft("");
      }
    } finally {
      setBusy(false);
    }
  }

  const when = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <div>
      <p className="font-mono text-label uppercase text-dim">Team notes</p>
      <p className="mt-0.5 text-body-sm text-dim">Only the team sees these. The client never does.</p>
      {notes === null ? (
        <p className="mt-2 text-body-sm text-muted">Loading...</p>
      ) : (
        notes.length > 0 && (
          <ul className="mt-2.5 grid gap-2.5">
            {notes.map((n) => (
              <li key={n.id} className="border-l-2 border-hair pl-3">
                <p className="whitespace-pre-wrap text-body-sm text-ink">{n.body}</p>
                <p className="mt-0.5 font-mono text-label uppercase text-dim">
                  {n.author.split("@")[0]} / {when(n.at)}
                </p>
              </li>
            ))}
          </ul>
        )
      )}
      <div className="mt-2.5 flex items-start gap-2">
        <textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Waiting on their logo in svg, chase Tuesday..."
          aria-label="Add a team note"
          className="tap min-w-0 flex-1 rounded-[8px] border border-hair bg-canvas px-3 py-2 text-body-sm text-ink placeholder:text-dim focus:border-gold focus:outline-none"
        />
        {draft.trim() && (
          <button
            type="button"
            disabled={busy}
            onClick={post}
            className="tap shrink-0 rounded-[8px] bg-gold px-3.5 py-2 font-mono text-label font-bold uppercase text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "..." : "Add"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------- the stage timeline ---------------- */

/*
 * Where a piece of work stands, as stations on a line. The client-side
 * answer to the admin board: same colours, same order, no controls. A
 * looping stage (revisions) is shown as the current station with its own
 * word rather than as a station of its own, because a line that doubles
 * back reads as a mistake.
 */
export function StageTimeline({
  steps,
  currentKey,
  currentLabel,
}: {
  steps: { key: string; label: string; tone: BoardColumn["tone"] }[];
  currentKey: string;
  /* overrides the current station's label, e.g. "Changes in hand" */
  currentLabel?: string;
}) {
  const at = Math.max(
    0,
    steps.findIndex((s) => s.key === currentKey),
  );
  return (
    <ol className="flex items-start">
      {steps.map((s, i) => {
        const done = i < at;
        const current = i === at;
        return (
          <li key={s.key} className="flex min-w-0 flex-1 flex-col items-center">
            <span className="flex w-full items-center">
              <span
                aria-hidden="true"
                className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : done || current ? TONE_STRIPE[s.tone] : "bg-hair"}`}
              />
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                  done
                    ? `border-transparent ${TONE_STRIPE[s.tone]}`
                    : current
                      ? `border-2 ${TONE_TEXT[s.tone]} border-current bg-surface`
                      : "border-hair bg-surface"
                }`}
              >
                {done && (
                  <svg viewBox="0 0 24 24" className="h-3 w-3 text-canvas" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                    <path d="m5 13 4 4 10-11" />
                  </svg>
                )}
                {current && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </span>
              <span
                aria-hidden="true"
                className={`h-0.5 flex-1 ${i === steps.length - 1 ? "opacity-0" : done ? TONE_STRIPE[steps[i + 1].tone] : "bg-hair"}`}
              />
            </span>
            <span
              className={`mt-1.5 px-1 text-center font-mono text-label uppercase ${
                current ? `font-bold ${TONE_TEXT[s.tone]}` : done ? "text-muted" : "text-dim"
              }`}
            >
              {current && currentLabel ? currentLabel : s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
