"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Play } from "lucide-react";
import { Button, Card, Chip, EmptyState, Input, PageHeader, Textarea } from "@/components/portal/ui";
import { StageTimeline } from "@/components/portal/board";
import { VideoReview } from "./VideoReview";
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

/*
 * The journey walks the same stages the studio's list uses, in the
 * client's words. Revision is not its own station, it is Being made
 * wearing its real label, because a line that doubles back reads as a
 * mistake. Extra formats only appears once the project actually has that
 * stage in front of it.
 */
const JOURNEY_BASE = [
  { key: "backlog", label: "Booked in", tone: "neutral" as const },
  { key: "planning", label: "Being planned", tone: "neutral" as const },
  { key: "in_progress", label: "Being made", tone: "info" as const },
  { key: "review", label: "Your review", tone: "warn" as const },
  { key: "approved", label: "Approved", tone: "good" as const },
];

const CUTDOWNS_STEP = { key: "cutdowns", label: "Extra formats", tone: "info" as const };

const journeySteps = (p: Project) =>
  p.status === "cutdowns" || p.formats.length > 0
    ? [...JOURNEY_BASE, CUTDOWNS_STEP]
    : JOURNEY_BASE;

const journeyKey = (status: string) =>
  status === "revision" ? "in_progress" : status === "closed" ? "approved" : status;

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

export function CustomView({
  authedFetch,
  onMessageStudio,
  focusVideoId,
  onFocused,
}: {
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  onMessageStudio?: () => void;
  focusVideoId?: string | null;
  onFocused?: () => void;
}) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
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
      setOpen(home.id);
      const target =
        home.main?.id === focusVideoId
          ? home.main && { ...home.main, title: home.title }
          : home.formats.find((f) => f.id === focusVideoId) ?? null;
      if (target?.videoUrl) setPlaying(target);
    }
    onFocused?.();
  }, [focusVideoId, projects, onFocused]);

  if (!projects) return <p className="text-body text-muted">Loading your projects...</p>;

  /* reviewing takes over the screen, the same way it does everywhere else */
  if (playing?.videoUrl) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setPlaying(null)}
          className="tap inline-flex items-center gap-2 font-mono text-label uppercase text-muted transition-colors hover:text-gold"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Back to the project
        </button>
        <div className="mt-4">
          <VideoReview
            videoId={playing.id}
            title={playing.title}
            videoUrl={playing.videoUrl}
            status={"ready"}
            canRequestChanges={playing.canRequestChanges}
            revisionsIncluded={playing.revisionsIncluded}
            revisionsUsed={playing.revisionsUsed}
            authedFetch={authedFetch}
            onMessageStudio={onMessageStudio}
            onChanged={() => {
              void load();
              setPlaying(null);
            }}
          />
        </div>
      </div>
    );
  }

  const project = open ? projects.find((p) => p.id === open) : null;
  if (project) {
    return (
      <ProjectPage
        p={project}
        authedFetch={authedFetch}
        onBack={() => setOpen(null)}
        onChanged={() => void load()}
        onPlay={(r) => setPlaying(r)}
        onMessageStudio={onMessageStudio}
      />
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
                          {p.pipeline.percent}% through the line
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
  onMessageStudio,
}: {
  p: Project;
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  onBack: () => void;
  onChanged: () => void;
  onPlay: (r: Reviewable & { title: string }) => void;
  onMessageStudio?: () => void;
}) {
  const waiting =
    p.pipeline.stations.filter((s) => s.state === "with_client" && s.gated).length +
    p.formats.filter((f) => f.canReview).length;

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

      <div className="mb-3">
        <Card>
          <StageTimeline
            steps={journeySteps(p)}
            currentKey={journeyKey(p.status)}
            currentLabel={p.status === "revision" ? "Changes in hand" : undefined}
          />
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
        <div className="grid min-w-0 gap-3">
          {waiting > 0 && (
            <Card
              tone="dark"
              title={`${waiting} ${waiting === 1 ? "thing is" : "things are"} waiting on you`}
            >
              <p className="text-body-sm text-chrome-muted">
                Nothing moves until you have had your say. The gold buttons
                below are where your word is needed.
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
                  onPlay={onPlay}
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

          {p.activity.length > 0 && (
            <Card title="What has happened">
              <ol className="grid gap-2.5">
                {p.activity.map((a, i) => (
                  <li key={`${a.at}-${i}`} className="border-l border-hair pl-3">
                    <p className="text-body-sm text-muted">{a.body}</p>
                    <p className="mt-0.5 font-mono text-label uppercase text-dim">{when(a.at)}</p>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {onMessageStudio && (
            <Card title="Something to say?">
              <p className="text-body-sm text-muted">
                Message your producer and it lands with the people making this.
              </p>
              <div className="mt-3">
                <Button variant="secondary" size="sm" onClick={onMessageStudio}>
                  Message the studio
                </Button>
              </div>
            </Card>
          )}
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
  onPlay,
}: {
  p: Project;
  st: PipelineStation;
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  onChanged: () => void;
  onPlay: (r: Reviewable & { title: string }) => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const mine = st.state === "with_client" && st.gated;
  const playerGate = st.key === "animation" || st.key === "delivery";

  async function gate(action: "approve" | "changes") {
    setBusy(true);
    setErr("");
    try {
      const j = await authedFetch(`/api/portal/projects/${p.id}/gate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: st.key, action, note: action === "changes" ? note : undefined }),
      });
      if (j.error) setErr(String(j.error));
      else {
        setNoteOpen(false);
        setNote("");
        onChanged();
      }
    } catch {
      setErr("That did not go through. Please try again.");
    }
    setBusy(false);
  }

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
            Open it
          </a>
        )}
        {mine && playerGate && p.main?.videoUrl && (
          <Button size="sm" variant="brand" onClick={() => onPlay({ ...p.main!, title: p.title })}>
            Review it
          </Button>
        )}
        {mine && !playerGate && (
          <>
            <Button size="sm" variant="brand" disabled={busy} onClick={() => void gate("approve")}>
              Approve
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => setNoteOpen(!noteOpen)}
            >
              Ask for changes
            </Button>
          </>
        )}
      </span>
      {noteOpen && (
        <span className="flex w-full gap-2">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What should change?"
            aria-label={`Changes to the ${st.label.toLowerCase()}`}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || !note.trim()}
            onClick={() => void gate("changes")}
          >
            Send
          </Button>
        </span>
      )}
      {err && <span className="w-full text-body-sm text-error">{err}</span>}
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
