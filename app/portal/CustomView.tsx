"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Download, MessageSquarePlus, Play, Share2 } from "lucide-react";
import { Button, Card, Chip, EmptyState, Input, Modal, PageHeader, Textarea } from "@/components/portal/ui";
import { VideoReviewModal } from "./VideoReviewModal";
import { ShareVideo } from "./ShareVideo";
import { ConfirmDialog } from "./ConfirmDialog";
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

/* short station names for the compact line, where the full label is long */
const SHORT: Record<string, string> = {
  script: "Script",
  voiceover: "Voice",
  design: "Design",
  animation: "Animation",
  sfx: "Sound",
  delivery: "Delivery",
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
  const playerAsk = Boolean(
    p.main?.videoUrl &&
      p.pipeline.stations.some(
        (s) => (s.key === "animation" || s.key === "delivery") && s.state === "with_client" && s.gated,
      ),
  );
  const approvals = p.pipeline.stations.filter(
    (s) =>
      s.state === "with_client" &&
      s.gated &&
      !(playerAsk && (s.key === "animation" || s.key === "delivery")),
  ).length;
  const filesOwed = p.pipeline.stations.filter(
    (s) => s.provided && s.state !== "done" && (s.key === "script" || s.key === "voiceover"),
  ).length;
  const waiting = approvals + filesOwed + p.formats.filter((f) => f.canReview).length;

  /* which of the two video gates is waiting on the client, and its word */
  const gate = p.pipeline.stations.find(
    (s) => (s.key === "animation" || s.key === "delivery") && s.state === "with_client" && s.gated,
  );
  const gateLabel = gate?.key === "delivery" ? "Final delivery" : "Animation";
  const [sharing, setSharing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [busy, setBusy] = useState(false);

  async function approveGate() {
    if (!p.main) return;
    setBusy(true);
    await authedFetch(`/api/portal/videos/${p.main.id}/review`, {
      method: "POST",
      body: JSON.stringify({ action: "approve" }),
    }).catch(() => null);
    setBusy(false);
    setApproving(false);
    onChanged();
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

      <div className="mt-4">
        <PageHeader
          title={p.title}
          description={[p.category, p.statusLabel, p.dueAt ? `Due ${day(p.dueAt)}.` : null]
            .filter(Boolean)
            .join(". ")}
        />
      </div>

      {/* where the whole job stands, said in words first: the stage by name,
          how far through, and which station it sits on right now. The six
          dots keep their colour but each carries its station name, so a
          colour is never shown without the word for it. */}
      <div className="mb-3 grid gap-2.5 rounded-[8px] border border-hair bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <Chip tone={STAGE_TONE[p.status] ?? "neutral"}>{p.statusLabel}</Chip>
          <span className="font-mono text-label uppercase text-dim">
            {p.pipeline.percent}% through the line
          </span>
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
        <div className="flex flex-wrap gap-x-3.5 gap-y-1.5">
          {p.pipeline.stations.map((st) => (
            <span key={st.key} className="inline-flex items-center gap-1.5" title={st.word}>
              <span
                aria-hidden="true"
                className={`h-1.5 w-4 shrink-0 rounded-full ${DOT[st.state]}`}
              />
              <span
                className={`font-mono text-label uppercase ${
                  st.state === "done"
                    ? "text-dim"
                    : st.state === "with_client"
                      ? "text-gold"
                      : st.state === "with_us"
                        ? "text-muted"
                        : "text-dim"
                }`}
              >
                {SHORT[st.key] ?? st.label}
              </span>
            </span>
          ))}
        </div>
      </div>

      {approving && (
        <ConfirmDialog
          title={`Approve ${gateLabel}?`}
          body="This tells the studio it is finished. You will still be able to watch and download it. If you want changes instead, use Give feedback."
          confirmLabel={busy ? "Approving..." : "Yes, approve it"}
          tone="green"
          onConfirm={approveGate}
          onCancel={() => setApproving(false)}
        />
      )}
      {sharing && p.main && (
        <ShareVideo
          videoId={p.main.id}
          title={p.title}
          authedFetch={authedFetch}
          onClose={() => setSharing(false)}
        />
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
        <div className="grid min-w-0 gap-3">
          {/* the video as a contained hero, sized to the column rather than
              bleeding the full page. Feedback is never inline; it opens the
              same full-screen review the pre-made videos use (owner rule). */}
          {p.main?.videoUrl && (
            <div className="overflow-hidden rounded-[12px] border border-hair bg-surface">
              <div className="flex aspect-video items-center justify-center bg-black">
                <video
                  controls
                  preload="metadata"
                  playsInline
                  src={p.main.videoUrl}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hair px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  {gate && (
                    <Button variant="brand" disabled={busy} onClick={() => setApproving(true)}>
                      Approve {gateLabel}
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    icon={<MessageSquarePlus />}
                    onClick={() => p.main && onPlay({ ...p.main, title: p.title })}
                  >
                    Give feedback
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Download />}
                    href={`/api/portal/videos/${p.main.id}/download`}
                  >
                    Download
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Share2 />}
                    onClick={() => setSharing(true)}
                  >
                    Share
                  </Button>
                </div>
              </div>
            </div>
          )}

          {waiting > 0 && (
            <Card
              tone="dark"
              title={`${waiting} ${waiting === 1 ? "thing needs" : "things need"} you`}
            >
              <p className="text-body-sm text-chrome-muted">
                {filesOwed > 0 && approvals > 0
                  ? "We are waiting on a file from you and on an approval. The gold buttons below are exactly where."
                  : filesOwed > 0
                    ? "We are waiting on a file only you have. Send the link with the gold button below and the work starts moving."
                    : "Nothing moves until you have had your look. The gold buttons below are where your word is needed."}
              </p>
            </Card>
          )}

          <Card
            title="The production line"
            description="Six stations. Watch your video move through them."
          >
            <ol className="grid gap-1.5">
              {p.pipeline.stations.map((st) => (
                <StationRow
                  key={st.key}
                  p={p}
                  st={st}
                  authedFetch={authedFetch}
                  onChanged={onChanged}
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

          {p.brief && (
            <Card title="The brief" description="What we agreed to make.">
              <p className="whitespace-pre-wrap text-body-sm text-muted">{p.brief}</p>
            </Card>
          )}
        </div>

        <div className="grid min-w-0 gap-3">
          <ClientThread projectId={p.id} authedFetch={authedFetch} system={p.activity} />

          <Card title="Where it is">
            <dl className="grid gap-2 text-body-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">Started</dt>
                <dd className="text-ink">{day(p.createdAt)}</dd>
              </div>
              {p.dueAt && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted">Due</dt>
                  <dd className="text-ink">{day(p.dueAt)}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">Through the line</dt>
                <dd className="tabular-nums text-ink">{p.pipeline.percent}%</dd>
              </div>
            </dl>
          </Card>

        </div>
      </div>
    </div>
  );
}

/* one station: its word, its file, and the buttons when the ball is theirs */
function StationRow({
  p,
  st,
  authedFetch,
  onChanged,
}: {
  p: Project;
  st: PipelineStation;
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  onChanged: () => void;
}) {
  const [provideOpen, setProvideOpen] = useState(false);
  const [provideUrl, setProvideUrl] = useState("");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const mine = st.state === "with_client" && st.gated;
  const playerGate = st.key === "animation" || st.key === "delivery";
  const providable = st.provided && (st.key === "script" || st.key === "voiceover");
  const needsTheirFile = providable && st.state !== "done";
  /* a piece WE made and shared, on a station that is not the video: the
     client can look at it and say what they think, as a comment (owner
     decision, 23 August 2026, not a formal approval) */
  const canReact = !playerGate && !st.provided && Boolean(st.url);

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

  async function sendFeedback() {
    const text = feedback.trim();
    if (!text) return;
    setBusy(true);
    setErr("");
    try {
      const j = await authedFetch(`/api/portal/projects/${p.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: `Feedback on ${st.label}: ${text}` }),
      });
      if (j.error) setErr(String(j.error));
      else {
        setFeedbackOpen(false);
        setFeedback("");
        onChanged();
      }
    } catch {
      setErr("That did not go through. Please try again.");
    }
    setBusy(false);
  }

  const provideNoun = st.key === "script" ? "script" : "voiceover";

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-hair bg-canvas px-3 py-2">
      <span className="flex min-w-0 items-center gap-2">
        <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${DOT[st.state]}`} />
        <span className={`text-body-sm ${st.state === "todo" ? "text-dim" : "text-ink"}`}>
          {st.label}
        </span>
        <span className={`font-mono text-label uppercase ${mine ? "text-gold" : "text-dim"}`}>
          {st.word}
        </span>
        {st.eta && st.state !== "done" && (
          <span className="font-mono text-label uppercase text-dim">expected {day(st.eta)}</span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {st.url && !playerGate && (
          <a
            href={st.url}
            target="_blank"
            rel="noreferrer"
            className="tap font-mono text-label uppercase text-muted transition-colors hover:text-gold"
          >
            View
          </a>
        )}
        {canReact && (
          <Button size="sm" variant="secondary" onClick={() => setFeedbackOpen(true)}>
            Give feedback
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

      {/* their file, in a popup, never expanding the row inline */}
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

      {/* feedback on a non-video station, as a comment to the studio */}
      <Modal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        title={`Feedback on ${st.label}`}
        subtitle="Tell us what you think. It reaches us in your messages, tagged to this step."
      >
        <div className="grid gap-4">
          <Textarea
            rows={4}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="What do you like, what would you change?"
            aria-label={`Feedback on ${st.label}`}
          />
          {err && <p className="text-body-sm text-error">{err}</p>}
          <div className="flex justify-end gap-2 border-t border-hair pt-4">
            <Button variant="ghost" onClick={() => setFeedbackOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" disabled={busy || !feedback.trim()} onClick={sendFeedback}>
              {busy ? "Sending..." : "Send feedback"}
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
      description="Goes to the same inbox as everything else you have said to us, tagged with this project. Notes about the video itself belong on the player above."
    >
      {notes === null ? (
        <p className="text-body-sm text-muted">Loading...</p>
      ) : (
        (() => {
          const merged: (
            | { kind: "note"; at: string; n: NonNullable<typeof notes>[number] }
            | { kind: "system"; at: string; body: string }
          )[] = [
            ...notes.map((n) => ({ kind: "note" as const, at: n.at, n })),
            ...system.map((a) => ({ kind: "system" as const, at: a.at, body: a.body })),
          ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
          if (merged.length === 0)
            return (
              <p className="text-body-sm text-dim">
                Nothing yet. Anything you write here reaches the people
                making your video.
              </p>
            );
          return (
            <ol className="grid max-h-80 gap-2.5 overflow-y-auto pr-1">
              {merged.map((e, i) =>
                e.kind === "note" ? (
                  <li
                    key={e.n.id}
                    className={`border-l pl-3 ${e.n.side === "studio" ? "border-gold/50" : "border-blue/50"}`}
                  >
                    <p className="text-body-sm text-ink">{e.n.body}</p>
                    <p className="mt-0.5 font-mono text-label uppercase text-dim">
                      {e.n.name}
                      {e.n.stamp ? ` at ${e.n.stamp}` : ""} / {when(e.at)}
                    </p>
                  </li>
                ) : (
                  <li key={`sys-${i}`} className="pl-3">
                    <p className="font-mono text-label uppercase text-dim">
                      {e.body} / {when(e.at)}
                    </p>
                  </li>
                ),
              )}
            </ol>
          );
        })()
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
    </Card>
  );
}
