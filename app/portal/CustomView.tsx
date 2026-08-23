"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Archive,
  ArrowLeft,
  File as FileIcon,
  FileText,
  Film,
  ImageIcon,
  Music,
  Paperclip,
  Play,
  Trash2,
  Upload,
} from "lucide-react";
import { Button, Card, Chip, EmptyState, Input, Modal, PageHeader, Textarea } from "@/components/portal/ui";
import { VideoReviewModal } from "./VideoReviewModal";
import { StageReview } from "./StageReview";
import { DownloadAll } from "@/components/portal/DownloadAll";
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

/* the stage's colour, given a name to sit beside so it is never a mystery */
const STAGE_TONE: Record<string, "neutral" | "good" | "warn" | "bad" | "info"> = {
  backlog: "neutral",
  planning: "info",
  in_progress: "info",
  review: "warn",
  revision: "bad",
  approved: "good",
  cutdowns: "warn",
  closed: "good",
  cancelled: "neutral",
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

  const load = useCallback(async () => {
    const j = await authedFetch("/api/portal/projects").catch(() => null);
    setProjects((j?.projects as Project[] | undefined) ?? []);
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
      />

      {projects.length === 0 ? (
        <StartModule authedFetch={authedFetch} />
      ) : (
        <div className="grid gap-1">
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
                        <span className="mt-0.5 block truncate font-mono text-label uppercase text-dim">
                          {(() => {
                            const cur = currentStation(p.pipeline.stations);
                            return cur
                              ? `${cur.label}: ${cur.word.toLowerCase()}`
                              : "Finished";
                          })()}{" "}
                          / {p.pipeline.percent}%
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

      {/* TOP: everything about the project and where it stands, in one place.
          The station by station line is not repeated here, it lives once in
          the production line below. */}
      <div className="mt-4 rounded-[12px] border border-hair bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-h3 leading-tight text-ink">{p.title}</h1>
            {p.category && (
              <p className="mt-1 font-mono text-label uppercase tracking-[0.1em] text-dim">
                {p.category}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Chip tone={STAGE_TONE[p.status] ?? "neutral"}>{p.statusLabel}</Chip>
            {(() => {
              const cur = currentStation(p.pipeline.stations);
              return cur ? (
                <span className="font-mono text-label uppercase text-muted">
                  now: {cur.label},{" "}
                  <span className={cur.state === "with_client" ? "text-gold" : ""}>
                    {cur.word.toLowerCase()}
                  </span>
                </span>
              ) : (
                <span className="font-mono text-label uppercase text-green">all finished</span>
              );
            })()}
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Fact label="Your producer">{p.manager ?? "Being assigned"}</Fact>
          <Fact label="Progress">
            <span className="tabular-nums">{p.pipeline.percent}%</span> through the line
          </Fact>
          <Fact label="Started">{day(p.createdAt)}</Fact>
          <Fact label="Due">{p.dueAt ? day(p.dueAt) : "To be set"}</Fact>
        </dl>

        {/* the number given something to mean: the line, as a bar */}
        <div
          className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-hair"
          role="progressbar"
          aria-valuenow={p.pipeline.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="How far through the production line"
        >
          <div
            className="h-full rounded-full bg-brand-gradient"
            style={{ width: `${Math.max(3, p.pipeline.percent)}%` }}
          />
        </div>
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
                            {f.canReview ? "Review it" : "Watch"}
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

          <Attachments projectId={p.id} authedFetch={authedFetch} />

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

type ClientFile = {
  id: string;
  name: string;
  sizeBytes: number;
  kind: "image" | "video" | "audio" | "pdf" | "doc" | "archive" | "file";
  uploadedBy: "client" | "studio";
  uploaderName: string | null;
  at: string;
  url: string | null;
};

const MAX_ATTACH_BYTES = 10 * 1024 * 1024;

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const KIND_ICON: Record<ClientFile["kind"], typeof FileIcon> = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  pdf: FileText,
  doc: FileText,
  archive: Archive,
  file: FileIcon,
};

/*
 * The files we pass each other. If we asked the client for a logo or a clip,
 * this is where it lands; if we handed them a reference, it shows here too.
 * Either side can add or remove, nothing over 10 MB.
 */
function Attachments({
  projectId,
  authedFetch,
}: {
  projectId: string;
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
}) {
  const [files, setFiles] = useState<ClientFile[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const j = await authedFetch(`/api/portal/projects/${projectId}/files`).catch(() => null);
    if (j && Array.isArray((j as { files?: unknown }).files)) setFiles((j as { files: ClientFile[] }).files);
    else if (!files) setFiles([]);
  }, [authedFetch, projectId, files]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function upload(list: FileList | null) {
    if (!list || !list.length) return;
    setErr("");
    setBusy(true);
    for (const file of Array.from(list)) {
      if (file.size > MAX_ATTACH_BYTES) {
        setErr(`${file.name} is over 10 MB.`);
        continue;
      }
      const fd = new FormData();
      fd.append("file", file);
      const r = (await authedFetch(`/api/portal/projects/${projectId}/files`, {
        method: "POST",
        body: fd,
      }).catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (r && r.error) setErr(r.error);
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    await load();
  }

  async function remove(id: string) {
    setBusy(true);
    await authedFetch(`/api/portal/projects/${projectId}/files?fileId=${id}`, {
      method: "DELETE",
    }).catch(() => null);
    setBusy(false);
    setConfirmId(null);
    await load();
  }

  return (
    <Card
      title="Attachments"
      description="Files we pass each other: what you send us, and what we send you. Up to 10 MB each."
      actions={
        <Button
          size="sm"
          variant="secondary"
          icon={<Upload />}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          Add file
        </Button>
      }
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => void upload(e.target.files)}
      />
      {err && <p className="mb-2 text-body-sm text-error">{err}</p>}

      {files === null ? (
        <p className="text-body-sm text-dim">Loading...</p>
      ) : files.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="tap flex w-full flex-col items-center gap-2 rounded-[8px] border border-dashed border-hair px-3 py-8 text-center transition-colors hover:border-gold/50"
        >
          <Paperclip size={20} className="text-dim" aria-hidden="true" />
          <span className="text-body-sm text-dim">
            Nothing here yet. Add a logo, a screenshot, a clip, anything we need.
          </span>
        </button>
      ) : (
        <ul className="grid gap-2">
          {files.map((f) => {
            const Icon = KIND_ICON[f.kind];
            return (
              <li
                key={f.id}
                className="flex items-center gap-3 rounded-[8px] border border-hair bg-canvas p-2"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[6px] border border-hair bg-surface">
                  {f.kind === "image" && f.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Icon size={18} className="text-muted" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm font-semibold text-ink" title={f.name}>
                    {f.name}
                  </p>
                  <p className="font-mono text-label uppercase tracking-[0.08em] text-dim">
                    {fmtSize(f.sizeBytes)} / {f.uploadedBy === "studio" ? "from us" : "from you"}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1">
                  {f.url && (
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tap rounded-[6px] border border-hair px-2.5 py-1 font-mono text-label uppercase text-muted transition-colors hover:border-blue/60 hover:text-blue"
                    >
                      Open
                    </a>
                  )}
                  {confirmId === f.id ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(f.id)}
                        className="tap rounded-[6px] border border-error/50 px-2.5 py-1 font-mono text-label uppercase text-error transition-colors hover:bg-error hover:text-canvas"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="tap font-mono text-label uppercase text-dim transition-colors hover:text-muted"
                      >
                        No
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Delete ${f.name}`}
                      onClick={() => setConfirmId(f.id)}
                      className="tap grid h-7 w-7 place-items-center rounded-[6px] border border-hair text-dim transition-colors hover:border-error/60 hover:text-error"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
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
      className={`flex flex-wrap items-center justify-between gap-2 rounded-[8px] border px-3.5 py-2.5 ${
        needsYou
          ? "border-gold/40 bg-gold/5"
          : st.state === "done" || st.state === "todo"
            ? "border-hair/40 bg-transparent"
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
          <span
            className={`block font-mono text-label uppercase ${
              st.state === "with_client" ? "text-gold" : "text-dim"
            }`}
          >
            {st.word}
            {st.eta && st.state !== "done" ? ` / expected ${day(st.eta)}` : ""}
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
            {needsYou ? "Review and approve" : "Review"}
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

function StartModule({
  authedFetch,
}: {
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
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
          We read every one the day it arrives. Expect a reply here and by
          email within one working day, usually faster.
        </p>
      </Card>
    );

  return (
    <div>
      <EmptyState
        title="No custom projects yet"
        description="Custom video is anything made from scratch for you: a brand film, a launch video, an explainer nobody else has. These are the four formats and their published starting prices; every project gets an exact quote before production starts."
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {formats.map((f) => (
          <div
            key={f.name}
            className={`flex flex-col rounded-[8px] border p-4 transition-colors ${
              picked === f.name ? "border-gold/70 bg-surface" : "border-hair bg-surface"
            }`}
          >
            <p className="text-body font-semibold text-ink">{f.name}</p>
            <p className="mt-1 font-display text-h4 text-gold">
              ${f.from.toLocaleString("en-US")}
              <span className="ml-1 font-mono text-label uppercase text-dim">starting</span>
            </p>
            <p className="mt-2 flex-1 text-body-sm text-muted">{f.line}</p>
            <div className="mt-3">
              <Button
                size="sm"
                variant={picked === f.name ? "brand" : "secondary"}
                full
                onClick={() => setPicked(picked === f.name ? null : f.name)}
              >
                {picked === f.name ? "Picked" : "Request a Quote"}
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
      title="Message the studio"
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
