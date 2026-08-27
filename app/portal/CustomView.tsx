"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Play, Plus } from "lucide-react";
import { Button, Card, Chip, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea } from "@/components/portal/ui";
import { VideoReviewModal } from "./VideoReviewModal";
import { StageReview } from "./StageReview";
import { DownloadAll } from "@/components/portal/DownloadAll";
import { Attachments } from "@/components/portal/Attachments";
import { pages } from "@/lib/site";

/*
 * The client's custom work, the simple way: a project IS the video.
 *
 * Each project page shows the six-station production line with the approve
 * buttons exactly where the ball is theirs, the extra formats cut after
 * approval, and an activity feed that writes itself. A client with no
 * custom work yet sees the four formats with their starting prices and can
 * ask for one without leaving the portal.
 */

type PipelineStation = {
  key: string;
  label: string;
  state: "todo" | "with_us" | "with_client" | "done";
  word: string;
  gated: boolean;
  provided: boolean;
  url: string | null;
  at: string | null;
  eta: string | null;
};

type Reviewable = {
  id: string;
  videoUrl: string | null;
  canReview: boolean;
  canRequestChanges: boolean;
  revisionsIncluded: number;
  revisionsUsed: number;
};

type Format = Reviewable & { title: string; status: string; word: string };

type Project = {
  id: string;
  title: string;
  brief: string | null;
  category: string | null;
  status: string;
  statusLabel: string;
  open: boolean;
  dueAt: string | null;
  createdAt: string;
  manager: string | null;
  payment: { label: string; outstandingCents: number };
  pipeline: {
    ball: "us" | "client" | null;
    percent: number;
    current: string | null;
    stations: PipelineStation[];
  };
  main: Reviewable | null;
  formats: Format[];
  activity: { at: string; body: string }[];
};

const day = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });


const STAGE_DOT: Record<string, string> = {
  backlog: "bg-hair",
  planning: "bg-blue/60",
  in_progress: "bg-blue",
  review: "bg-gold",
  revision: "bg-error",
  approved: "bg-green",
  cutdowns: "bg-gold/60",
  closed: "bg-green",
};

const DOT: Record<PipelineStation["state"], string> = {
  todo: "bg-hair",
  with_us: "bg-blue",
  with_client: "bg-gold",
  done: "bg-green",
};

/* the station's state as a label pill: a tinted, transparent chip that carries
   the word, coloured by whose court the ball is in */
const STATE_PILL: Record<PipelineStation["state"], string> = {
  todo: "border-hair bg-transparent text-dim",
  with_us: "border-blue/30 bg-blue/5 text-blue",
  with_client: "border-gold/40 bg-gold/10 text-gold",
  done: "border-green/30 bg-green/5 text-green",
};

/* the project's own lifecycle stage, shown as its status. This is the stage a
   producer sets, not anything derived from the production line. */
const STAGE_LABEL: Record<string, string> = {
  backlog: "Backlog",
  planning: "Planning",
  in_progress: "In progress",
  review: "In review",
  revision: "In revision",
  approved: "Approved",
  cutdowns: "Extra formats",
  closed: "Complete",
  cancelled: "Cancelled",
};


/* what each stage is reviewed as; sound design has nothing to show */
const MEDIUM: Record<string, "doc" | "audio" | "pdf" | "video" | null> = {
  script: "doc",
  voiceover: "audio",
  design: "pdf",
  animation: "video",
  sfx: null,
  delivery: "video",
};

/* the station the work sits on now, and how it reads to the client */
function currentStation(stations: PipelineStation[]): PipelineStation | null {
  return stations.find((st) => st.state !== "done") ?? null;
}

export function CustomView({
  authedFetch,
  onMessageStudio,
  focusVideoId,
  onFocused,
  openProjectId = null,
  onOpenProject,
}: {
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  onMessageStudio?: () => void;
  focusVideoId?: string | null;
  onFocused?: () => void;
  openProjectId?: string | null;
  onOpenProject?: (id: string | null) => void;
}) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [open, setOpenState] = useState<string | null>(openProjectId);
  useEffect(() => setOpenState(openProjectId), [openProjectId]);
  const setOpen = (id: string | null) => {
    setOpenState(id);
    onOpenProject?.(id);
  };
  const [playing, setPlaying] = useState<(Reviewable & { title: string }) | null>(null);
  /* retainer accounts brief us directly. The server decides; this only says
     whether to offer the button. */
  const [canSubmit, setCanSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const j = await authedFetch("/api/portal/projects").catch(() => null);
    setProjects((j?.projects as Project[] | undefined) ?? []);
    setCanSubmit(Boolean(j?.canSubmit));
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  /* opened from the dashboard: land on the video itself, inside its project */
  useEffect(() => {
    if (!focusVideoId || !projects) return;
    const home = projects.find(
      (p) => p.main?.id === focusVideoId || p.formats.some((f) => f.id === focusVideoId),
    );
    if (home) {
      setOpenState(home.id);
      onOpenProject?.(home.id);
      const target =
        home.main?.id === focusVideoId
          ? home.main && { ...home.main, title: home.title }
          : home.formats.find((f) => f.id === focusVideoId) ?? null;
      if (target?.videoUrl) setPlaying(target);
    }
    onFocused?.();
  }, [focusVideoId, projects, onFocused, onOpenProject]);

  if (!projects) return <p className="text-body text-muted">Loading your projects...</p>;

  /* reviewing always opens over the page as a popup, never inline (owner
     rule, final): the same full-screen review the pre-made videos use */
  const reviewModal = playing?.videoUrl ? (
    <VideoReviewModal
      video={{
        id: playing.id,
        title: playing.title,
        videoUrl: playing.videoUrl,
        status: "ready",
        canRequestChanges: playing.canRequestChanges,
        revisionsIncluded: playing.revisionsIncluded,
        revisionsUsed: playing.revisionsUsed,
      }}
      onClose={() => setPlaying(null)}
      onChanged={() => void load()}
      authedFetch={authedFetch}
      onMessageStudio={onMessageStudio}
    />
  ) : null;

  const project = open ? projects.find((p) => p.id === open) : null;
  if (project) {
    return (
      <>
        {reviewModal}
        <ProjectPage
          p={project}
          authedFetch={authedFetch}
          onBack={() => setOpen(null)}
          onChanged={() => void load()}
          onPlay={(r) => setPlaying(r)}
        />
      </>
    );
  }

  /* the same grouped list the studio reads, in the client's words, and a
     stage with nothing in it simply does not appear */
  const STAGE_ORDER = [
    "backlog",
    "planning",
    "in_progress",
    "review",
    "revision",
    "approved",
    "cutdowns",
    "closed",
  ];
  const groups = STAGE_ORDER.map((key) => ({
    key,
    rows: projects.filter((p) => p.status === key),
  })).filter((g) => g.rows.length > 0);

  const GRID =
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[minmax(0,2fr)_8rem_6.5rem_minmax(0,1fr)_5.5rem]";

  return (
    <div>
      <PageHeader
        title="Custom"
        description="Video made for you from scratch. Open a project for its production line, its files, and what has happened."
        actions={
          canSubmit ? (
            <Button variant="brand" icon={<Plus />} onClick={() => setSubmitting(true)}>
              Submit a new project
            </Button>
          ) : undefined
        }
      />

      {canSubmit && (
        <SubmitProject
          open={submitting}
          onClose={() => setSubmitting(false)}
          authedFetch={authedFetch}
          onDone={() => {
            setSubmitting(false);
            void load();
          }}
        />
      )}

      {projects.length === 0 ? (
        <StartModule authedFetch={authedFetch} canSubmit={canSubmit} />
      ) : (
        /* the same dashed frame the empty state wears, so a list of projects
           and no projects at all read as the same container rather than two
           different screens */
        <div className="grid gap-1 rounded-[12px] border border-dashed border-hair bg-surface/40 p-3 sm:p-4">
          <div className={`${GRID} px-3.5 pb-1`}>
            <span className="font-mono text-label uppercase tracking-[0.08em] text-dim">
              Project
            </span>
            <span className="hidden font-mono text-label uppercase tracking-[0.08em] text-dim sm:block">
              Category
            </span>
            <span className="hidden font-mono text-label uppercase tracking-[0.08em] text-dim sm:block">
              Line
            </span>
            <span className="hidden sm:block" />
            <span className="text-right font-mono text-label uppercase tracking-[0.08em] text-dim">
              Due
            </span>
          </div>

          {groups.map((g) => (
            <div key={g.key}>
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span
                  aria-hidden="true"
                  className={`h-2.5 w-2.5 rounded-full ${STAGE_DOT[g.key] ?? "bg-hair"}`}
                />
                <span className="font-mono text-label uppercase tracking-[0.08em] text-ink">
                  {g.rows[0].statusLabel}
                </span>
                <span className="font-mono text-label tabular-nums text-dim">
                  {g.rows.length}
                </span>
              </div>
              <ul className="mb-2 ml-1.5 grid gap-px overflow-hidden rounded-[8px] border border-hair">
                {g.rows.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setOpen(p.id)}
                      className={`tap ${GRID} w-full bg-surface px-3.5 py-2.5 text-left transition-colors hover:bg-card`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-body-sm font-semibold text-ink">
                          {p.title}
                        </span>
                        {/* The station and its state, with no percentage
                            beside it. The number was a count of stations
                            passed, which is not what a client reads it as:
                            83% looked like five sixths of the work done when
                            it meant five of six stations touched, and the
                            last one is usually the longest. The dots already
                            show how far along it is, honestly, without
                            claiming a precision we do not have. */}
                        <span className="mt-0.5 block truncate font-mono text-label uppercase text-dim">
                          {(() => {
                            const cur = currentStation(p.pipeline.stations);
                            return cur
                              ? `${cur.label}: ${cur.word.toLowerCase()}`
                              : "Finished";
                          })()}
                        </span>
                      </span>
                      <span className="hidden min-w-0 sm:block">
                        {p.category ? (
                          <span className="truncate text-body-sm text-muted">{p.category}</span>
                        ) : (
                          <span className="font-mono text-label uppercase text-dim">video</span>
                        )}
                      </span>
                      <span className="hidden items-center gap-1 sm:flex">
                        {p.pipeline.stations.map((st) => (
                          <span
                            key={st.key}
                            title={`${st.label}: ${st.word}`}
                            className={`h-1.5 w-3 rounded-full ${DOT[st.state]}`}
                          />
                        ))}
                      </span>
                      <span className="hidden min-w-0 items-center sm:flex">
                        {p.pipeline.ball === "client" && <Chip tone="warn">waiting on you</Chip>}
                      </span>
                      <span
                        className={`text-right font-mono text-label uppercase ${
                          p.dueAt && Date.parse(p.dueAt) < Date.now() && p.open
                            ? "text-error"
                            : "text-dim"
                        }`}
                      >
                        {p.dueAt
                          ? new Date(p.dueAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })
                          : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Under the list, not only on an empty screen. Somebody with three
          projects running is the likeliest person to want a fourth, and the
          formats used to be visible only to people who had never bought one.
          Retainer accounts see it too: their deal covers the work we agreed,
          not every format we make, and the prices are the answer to what
          anything else would cost. */}
      {projects.length > 0 && (
        <div className="mt-40">
          <QuoteFormats
            authedFetch={authedFetch}
            heading={quoteCopy(canSubmit).heading}
            blurb={quoteCopy(canSubmit).blurb}
          />
        </div>
      )}
    </div>
  );
}

/* ---------------- one project, full page ---------------- */

function ProjectPage({
  p,
  authedFetch,
  onBack,
  onChanged,
  onPlay,
}: {
  p: Project;
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  onBack: () => void;
  onChanged: () => void;
  onPlay: (r: Reviewable & { title: string }) => void;
}) {
  /* which stage's review room is open, if any */
  const [reviewing, setReviewing] = useState<string | null>(null);

  const scrollToStage = (key: string) => {
    document.getElementById(`stage-${key}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  /* what actually needs the client: a cut waiting on their approval, or a file
     only they have. Reviewing the design is optional, so it is not a to do. */
  const needItems: { key: string; label: string; cta: string; onClick: () => void }[] = [];
  for (const s of p.pipeline.stations) {
    if ((s.key === "animation" || s.key === "delivery") && s.state === "with_client" && s.gated)
      needItems.push({
        key: s.key,
        label: `${s.label} is ready for your approval`,
        cta: "Review",
        onClick: () => setReviewing(s.key),
      });
    if (s.provided && s.state !== "done" && (s.key === "script" || s.key === "voiceover"))
      needItems.push({
        key: s.key,
        label: `We need your ${s.key === "script" ? "script" : "voiceover"}`,
        cta: "Add",
        onClick: () => scrollToStage(s.key),
      });
  }

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="tap inline-flex items-center gap-2 font-mono text-label uppercase text-muted transition-colors hover:text-gold"
      >
        <ArrowLeft size={14} aria-hidden="true" /> All projects
      </button>

      {/* TOP: the project and where it stands. Just this: the name, the type,
          and a factual row. The station by station line lives once, below, and
          the project status here is the stage a producer set, not the line. */}
      <div className="mt-4 rounded-[12px] border border-hair bg-surface p-4 sm:p-5">
        <h1 className="font-display text-h3 leading-tight text-ink">{p.title}</h1>
        {p.category && (
          <p className="mt-1 font-mono text-label uppercase tracking-[0.1em] text-dim">
            {p.category}
          </p>
        )}

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
          <Fact label="Project status">{STAGE_LABEL[p.status] ?? p.statusLabel}</Fact>
          <Fact label="Due">{p.dueAt ? day(p.dueAt) : "To be set"}</Fact>
          <Fact label="Producer">{p.manager ?? "Being assigned"}</Fact>
          <Fact label="Payment">{p.payment.label}</Fact>
        </dl>
      </div>

      {/* one review room, whatever the medium, opened from a stage below */}
      {reviewing && (
        <StageReview
          projectId={p.id}
          stageKey={reviewing}
          videoId={p.main?.id ?? null}
          authedFetch={authedFetch}
          onClose={() => setReviewing(null)}
          onChanged={onChanged}
        />
      )}

      {/* one grid the whole way down: the work on the left, and a rail on the
          right that holds your move, the files, and the conversation */}
      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,380px)] lg:items-start">
        <div className="grid min-w-0 gap-3">
          <Card
            title="The production line"
            description="Each step of your video. Open one to see our work and tell us what you think."
          >
            <ol className="grid gap-2">
              {p.pipeline.stations.map((st) => (
                <StageRow
                  key={st.key}
                  p={p}
                  st={st}
                  authedFetch={authedFetch}
                  onChanged={onChanged}
                  onReview={setReviewing}
                />
              ))}
            </ol>
          </Card>

          {(p.formats.length > 0 || p.status === "cutdowns") && (
            <Card
              title="Extra formats"
              description="Versions of the finished video cut for other places: reels, shorts, square crops."
              actions={
                <DownloadAll
                  videoIds={p.formats
                    .filter((f) => f.videoUrl && f.status === "approved")
                    .map((f) => f.id)}
                />
              }
            >
              {p.formats.length === 0 ? (
                <p className="text-body-sm text-dim">Being lined up now.</p>
              ) : (
                <ul className="grid gap-1.5">
                  {p.formats.map((f) => (
                    <li
                      key={f.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-hair bg-canvas px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 text-body-sm font-semibold text-ink">
                        {f.title}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <Chip
                          tone={
                            f.status === "approved"
                              ? "good"
                              : f.canReview
                                ? "warn"
                                : f.status === "revisions"
                                  ? "bad"
                                  : "neutral"
                          }
                        >
                          {f.word}
                        </Chip>
                        {f.videoUrl && (
                          <Button
                            size="sm"
                            variant={f.canReview ? "brand" : "secondary"}
                            icon={<Play />}
                            onClick={() => onPlay(f)}
                          >
                            {/* a format with a file but no review left open is
                                one they already approved */}
                            {f.canReview ? "Review it" : "Watch and download"}
                          </Button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <BriefEditor
            projectId={p.id}
            brief={p.brief}
            authedFetch={authedFetch}
            onChanged={onChanged}
          />
        </div>

        {/* right rail: your move first, then the shared files, then the talk */}
        <div className="grid min-w-0 gap-3">
          {needItems.length > 0 && (
            <Card
              title={`${needItems.length} ${needItems.length === 1 ? "thing needs" : "things need"} you`}
            >
              <ul className="grid gap-1.5">
                {needItems.map((it) => (
                  <li key={it.key}>
                    <button
                      type="button"
                      onClick={it.onClick}
                      className="tap flex w-full items-center justify-between gap-2 rounded-[8px] border border-gold/40 bg-gold/5 px-3 py-2 text-left transition-colors hover:border-gold/70"
                    >
                      <span className="text-body-sm font-semibold text-ink">{it.label}</span>
                      <span className="shrink-0 font-mono text-label uppercase text-gold">
                        {it.cta}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Attachments endpoint={`/api/portal/projects/${p.id}/files`} authedFetch={authedFetch} />

          <ClientThread projectId={p.id} authedFetch={authedFetch} system={p.activity} />
        </div>
      </div>
    </div>
  );
}

/* one labelled fact in the top strip */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-label uppercase tracking-[0.1em] text-dim">{label}</dt>
      <dd className="mt-1 truncate text-body-sm text-ink">{children}</dd>
    </div>
  );
}

/*
 * The brief, as a description box both sides keep current.
 *
 * Click it to edit, like the description on a task board. What the client
 * writes here is the same field the studio edits from admin, so it stays one
 * source of truth for what we agreed to make.
 */
function BriefEditor({
  projectId,
  brief,
  authedFetch,
  onChanged,
}: {
  projectId: string;
  brief: string | null;
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(brief ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editing) setText(brief ?? "");
  }, [brief, editing]);

  async function save() {
    setBusy(true);
    await authedFetch(`/api/portal/projects/${projectId}/brief`, {
      method: "PATCH",
      body: JSON.stringify({ brief: text }),
    }).catch(() => null);
    setBusy(false);
    setEditing(false);
    onChanged();
  }

  return (
    <Card
      title="The brief"
      description="What we are making. You and your producer can both keep this up to date."
      actions={
        !editing && brief ? (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
        ) : undefined
      }
    >
      {editing ? (
        <div className="grid gap-2">
          <Textarea
            rows={8}
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="The goal, who it is for, what must be in it, and links to anything useful."
          />
          <div className="flex gap-2">
            <Button size="sm" variant="brand" disabled={busy} onClick={save}>
              Save
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setText(brief ?? "");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : brief ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="tap w-full rounded-[8px] px-1 py-0.5 text-left transition-colors hover:bg-canvas"
          title="Click to edit"
        >
          <p className="whitespace-pre-wrap text-body-sm text-muted">{brief}</p>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="tap w-full rounded-[8px] border border-dashed border-hair px-3 py-6 text-center text-body-sm text-dim transition-colors hover:border-gold/50 hover:text-muted"
        >
          Add a brief. Tell us the goal, the audience, and anything that must be in it.
        </button>
      )}
    </Card>
  );
}


/*
 * One step of the production line, as the client reads it.
 *
 * A step whose work is ready to look at opens the review room for its
 * medium: the script as a doc, the voiceover as audio, the design as a PDF,
 * the animation and the final cut as video. Reviewing and feedback all live
 * in that room, never on this row. A step the client supplies themselves
 * (their own script or voiceover) shows the upload instead, in a popup.
 */
function StageRow({
  p,
  st,
  authedFetch,
  onChanged,
  onReview,
}: {
  p: Project;
  st: PipelineStation;
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  onChanged: () => void;
  onReview: (stageKey: string) => void;
}) {
  const [provideOpen, setProvideOpen] = useState(false);
  const [provideUrl, setProvideUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const medium = MEDIUM[st.key];
  const playerGate = st.key === "animation" || st.key === "delivery";
  const needsYou = playerGate && st.state === "with_client" && st.gated;
  /* something we made and shared, ready for the client to review; a piece
     the client supplies themselves is not reviewed, it is uploaded */
  const reviewable = Boolean(medium) && Boolean(st.url) && !st.provided;
  const providable = st.provided && (st.key === "script" || st.key === "voiceover");
  const needsTheirFile = providable && st.state !== "done";
  const provideNoun = st.key === "script" ? "script" : "voiceover";

  async function provide() {
    setBusy(true);
    setErr("");
    try {
      const j = await authedFetch(`/api/portal/projects/${p.id}/provide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: st.key, url: provideUrl.trim() }),
      });
      if (j.error) setErr(String(j.error));
      else {
        setProvideOpen(false);
        setProvideUrl("");
        onChanged();
      }
    } catch {
      setErr("That did not go through. Please try again.");
    }
    setBusy(false);
  }

  return (
    <li
      id={`stage-${st.key}`}
      /* Every step used to sit behind a hairline at 40%, which on canvas is
         close to no line at all: the whole production line read as one dark
         block and you could not see where a step began. Each state now carries
         a border you can actually find, and a finished step picks up a trace
         of the green it is already wearing on its dot and its pill. */
      className={`flex flex-wrap items-center justify-between gap-2 rounded-[8px] border px-3.5 py-2.5 ${
        needsYou
          ? "border-gold/40 bg-gold/5"
          : st.state === "done"
            ? "border-green/25 bg-green/[0.03]"
            : st.state === "todo"
              ? "border-hair/70 bg-transparent"
              : "border-hair bg-canvas"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[st.state]}`} />
        <span className="min-w-0">
          <span
            className={`block text-body-sm font-semibold ${
              st.state === "done" ? "text-muted" : st.state === "todo" ? "text-dim" : "text-ink"
            }`}
          >
            {st.label}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-label uppercase ${STATE_PILL[st.state]}`}
            >
              {st.word}
            </span>
            {/* an expected date only means something before the work is with
               the client: once it is theirs, the ball is in their court */}
            {st.eta && (st.state === "todo" || st.state === "with_us") && (
              <span className="font-mono text-label uppercase text-dim">
                expected {day(st.eta)}
              </span>
            )}
          </span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {reviewable && (
          <Button
            size="sm"
            variant={needsYou ? "brand" : "secondary"}
            onClick={() => onReview(st.key)}
          >
            {/* "Review" on something already approved asks for a verdict that
                has been given. Once a cut is signed off the only things left
                to do with it are watch it and take it. */}
            {needsYou
              ? "Review and approve"
              : st.state === "done" && medium === "video"
                ? "Watch and download"
                : "Review"}
          </Button>
        )}
        {needsTheirFile && (
          <Button size="sm" variant="brand" onClick={() => setProvideOpen(true)}>
            {st.url ? "Send a new link" : `Add your ${provideNoun}`}
          </Button>
        )}
        {providable && st.state === "done" && (
          <button
            type="button"
            onClick={() => setProvideOpen(true)}
            className="tap font-mono text-label uppercase text-dim transition-colors hover:text-gold"
          >
            Send an update
          </button>
        )}
      </span>

      {/* the client's own file, in a popup, never expanding the row inline */}
      <Modal
        open={provideOpen}
        onClose={() => setProvideOpen(false)}
        title={`Your ${provideNoun}`}
        subtitle={`Paste a link to your ${provideNoun}. A Google Doc, a Drive file, whatever you use.`}
      >
        <div className="grid gap-4">
          <Input
            value={provideUrl}
            onChange={(e) => setProvideUrl(e.target.value)}
            placeholder="https://"
            aria-label={`Your ${provideNoun} link`}
          />
          {err && <p className="text-body-sm text-error">{err}</p>}
          <div className="flex justify-end gap-2 border-t border-hair pt-4">
            <Button variant="ghost" onClick={() => setProvideOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" disabled={busy || !provideUrl.trim()} onClick={provide}>
              {busy ? "Sending..." : "Send it"}
            </Button>
          </div>
        </div>
      </Modal>
    </li>
  );
}

/* ---------------- no custom work yet: the four formats, ask for one ---------------- */

/*
 * The empty Custom screen.
 *
 * A client with a retainer sees the door they actually use; everyone else
 * sees the formats and their prices. Both sit under the same explanation of
 * what custom work is, because on an empty screen that is the first question.
 */
function StartModule({
  authedFetch,
  canSubmit,
}: {
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  canSubmit: boolean;
}) {
  return (
    <div>
      <EmptyState
        title="No custom projects yet"
        description={
          canSubmit
            ? "Custom video is anything made from scratch for you: a brand film, a launch video, an explainer nobody else has. Your account is set up to brief them directly, so send the first one whenever you are ready."
            : "Custom video is anything made from scratch for you: a brand film, a launch video, an explainer nobody else has. These are the four formats and their published starting prices; every project gets an exact quote before production starts."
        }
      />
      <div className="mt-4">
        <QuoteFormats
          authedFetch={authedFetch}
          heading={canSubmit ? quoteCopy(true).heading : "Pick a format to start from"}
          blurb={
            canSubmit
              ? quoteCopy(true).blurb
              : "Every project gets an exact quote before production starts."
          }
        />
      </div>
    </div>
  );
}

/*
 * A retainer client briefing a new video.
 *
 * Five fields and no money. Everything about scoping and quoting is missing
 * on purpose: for these accounts that conversation already happened, and
 * asking them to have it again for the eleventh video is the friction this
 * removes. The name and the script are what the studio genuinely cannot
 * start without; the rest sharpens the first cut and can wait.
 */
function SubmitProject({
  open,
  onClose,
  authedFetch,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  onDone: () => void;
}) {
  const formats = pages.custom.formats.items;
  const [f, setF] = useState({ title: "", script: "", category: "", reference: "", brief: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const set = (k: keyof typeof f, v: string) => setF((was) => ({ ...was, [k]: v }));

  async function send() {
    setBusy(true);
    setErr("");
    try {
      const j = (await authedFetch("/api/portal/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      })) as { ok?: boolean; error?: string };
      if (!j?.ok) {
        setErr(j?.error ?? "Could not send that.");
        return;
      }
      setF({ title: "", script: "", category: "", reference: "", brief: "" });
      onDone();
    } catch {
      setErr("Could not send that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Submit a new project">
      <div className="grid gap-4">
        <p className="text-body-sm text-muted">
          Your account is set up for this, so there is no quote to wait on. Send
          it and it goes into the line.
        </p>

        <Field label="Project name" required hint="What you will call it when you ask us about it.">
          <Input
            value={f.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Workflows AI, launch explainer"
          />
        </Field>

        {/* A link, not the words. Nobody drafts a script in a modal, and
            the doc is where the client is already writing it, so the box
            that invited a paste was inviting a stale copy of it. The hint
            names the sharing setting because that is what actually goes
            wrong: the link arrives and we cannot open it. */}
        <Field
          label="Script"
          required
          hint="A link to the doc. Check the sharing lets us open it."
        >
          <Input
            value={f.script}
            onChange={(e) => set("script", e.target.value)}
            placeholder="https://docs.google.com/..."
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" hint="Which of our formats it is closest to.">
            <Select value={f.category} onChange={(e) => set("category", e.target.value)}>
              <option value="">Not sure, you decide</option>
              {formats.map((x) => (
                <option key={x.name} value={x.name}>
                  {x.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reference" hint="A video you want this one to feel like.">
            <Input
              value={f.reference}
              onChange={(e) => set("reference", e.target.value)}
              placeholder="https://youtube.com/..."
            />
          </Field>
        </div>

        <Field label="Project brief" hint="Anything around the script: who watches it, where it runs, what it has to do.">
          <Textarea rows={4} value={f.brief} onChange={(e) => set("brief", e.target.value)} />
        </Field>

        {err && <p className="text-body-sm text-error">{err}</p>}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="brand"
            disabled={busy || !f.title.trim() || !f.script.trim()}
            onClick={send}
          >
            {busy ? "Sending..." : "Submit the project"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/*
 * The four formats and their starting prices.
 *
 * Shown under an existing list as well as on an empty screen: a client with
 * three projects running is the MOST likely person to want a fourth, and
 * before this the only place the formats appeared was the screen belonging to
 * somebody who had never bought one.
 */
/*
 * What the formats section says, which depends on who is reading it.
 *
 * A retainer client is not shopping for a quote on the work we already
 * agreed, so for them the four prices answer a different question: what
 * anything outside the deal would cost.
 */
function quoteCopy(canSubmit: boolean) {
  return canSubmit
    ? {
        heading: "Something outside your plan?",
        blurb:
          "These are the four formats and what each one starts at. Pick the closest and we will come back with an exact quote.",
      }
    : {
        heading: "Need another custom video?",
        blurb:
          "Pick the format closest to what you have in mind and we will come back with an exact quote.",
      };
}

function QuoteFormats({
  authedFetch,
  heading,
  blurb,
}: {
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  heading: string;
  blurb: string;
}) {
  const formats = pages.custom.formats.items;
  const [picked, setPicked] = useState<string | null>(null);
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  async function send() {
    setBusy(true);
    setErr("");
    try {
      const j = await authedFetch("/api/portal/projects/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: picked, brief }),
      });
      if (j.error) setErr(String(j.error));
      else setSent(true);
    } catch {
      setErr("Could not send that. Please try again.");
    }
    setBusy(false);
  }

  if (sent)
    return (
      <Card title="It is with us" description="Your request landed with the studio.">
        <p className="text-body-sm text-muted">
          We read every one the day it arrives. Expect a reply here and by email
          within one working day, usually faster.
        </p>
      </Card>
    );

  return (
    <div>
      <div className="max-w-[var(--measure-body)]">
        <h2 className="font-display text-h4 text-ink">{heading}</h2>
        <p className="mt-1 text-body-sm text-muted">{blurb}</p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {formats.map((x) => (
          <div
            key={x.name}
            className={`flex flex-col rounded-[8px] border p-4 transition-colors ${
              picked === x.name ? "border-gold/70 bg-surface" : "border-hair bg-surface"
            }`}
          >
            <p className="text-body font-semibold text-ink">{x.name}</p>
            <p className="mt-1 font-display text-h4 text-gold">
              ${x.from.toLocaleString("en-US")}
              <span className="ml-1 font-mono text-label uppercase text-dim">starting</span>
            </p>
            <p className="mt-2 flex-1 text-body-sm text-muted">{x.line}</p>
            <div className="mt-3">
              <Button
                size="sm"
                variant={picked === x.name ? "brand" : "secondary"}
                full
                onClick={() => setPicked(picked === x.name ? null : x.name)}
              >
                {picked === x.name ? "Picked" : "Request a Quote"}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {picked && (
        <div className="mt-3">
          <Card
            title={`Tell us about your ${picked.toLowerCase()}`}
            description="Rough is fine. What it is for, who watches it, anything you already have."
          >
            <Textarea
              rows={4}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="A 60 second explainer for our HighLevel SaaS. We have a script draft and brand kit already."
            />
            {err && <p className="mt-2 text-body-sm text-error">{err}</p>}
            <div className="mt-3">
              <Button variant="brand" disabled={busy || !brief.trim()} onClick={send}>
                {busy ? "Sending..." : "Send the request"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/* the one thread this project has: the studio reads and writes the same one */
function ClientThread({
  projectId,
  authedFetch,
  system = [],
}: {
  projectId: string;
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  /* the machine's own lines: station moves, drafts landing */
  system?: { at: string; body: string }[];
}) {
  const [notes, setNotes] = useState<
    { id: string; side: string; name: string; body: string; stamp: string | null; at: string }[] | null
  >(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const j = await authedFetch(`/api/portal/projects/${projectId}/notes`).catch(() => null);
    setNotes(((j?.notes as typeof notes) ?? []) as never);
  }, [projectId, authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send() {
    if (!draft.trim()) return;
    setBusy(true);
    await authedFetch(`/api/portal/projects/${projectId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: draft.trim() }),
    }).catch(() => null);
    setDraft("");
    await load();
    setBusy(false);
  }

  return (
    <Card
      title="Project Discussion"
      description="The same inbox as everywhere else, tagged with this project. For notes on a specific cut, open its review room above."
    >
      {notes === null ? (
        <p className="text-body-sm text-muted">Loading...</p>
      ) : notes.length === 0 ? (
        <p className="text-body-sm text-dim">
          Nothing yet. Anything you write here reaches the people making your video.
        </p>
      ) : (
        <ol className="grid max-h-72 gap-2.5 overflow-y-auto pr-1">
          {notes
            .slice()
            .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
            .map((n) => (
              <li
                key={n.id}
                className={`border-l pl-3 ${n.side === "studio" ? "border-gold/50" : "border-blue/50"}`}
              >
                <p className="text-body-sm text-ink">{n.body}</p>
                <p className="mt-0.5 font-mono text-label uppercase text-dim">
                  {n.name}
                  {n.stamp ? ` at ${n.stamp}` : ""} / {when(n.at)}
                </p>
              </li>
            ))}
        </ol>
      )}
      <div className="mt-3 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask us anything about this project"
          aria-label="Note to the studio"
          onKeyDown={(e) => {
            if (e.key === "Enter") void send();
          }}
        />
        <Button size="sm" variant="secondary" disabled={busy || !draft.trim()} onClick={send}>
          Send
        </Button>
      </div>

      {/* the machine's own timeline, kept but quieted so the talk leads */}
      {system.length > 0 && (
        <div className="mt-4 border-t border-hair pt-3">
          <p className="mb-2 font-mono text-label uppercase tracking-[0.1em] text-dim">
            Project updates
          </p>
          <ol className="grid max-h-40 gap-1.5 overflow-y-auto pr-1">
            {system
              .slice()
              .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
              .map((a, i) => (
                <li key={`sys-${i}`} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-body-sm text-muted">{a.body}</span>
                  <span className="font-mono text-label uppercase text-dim">{when(a.at)}</span>
                </li>
              ))}
          </ol>
        </div>
      )}
    </Card>
  );
}
