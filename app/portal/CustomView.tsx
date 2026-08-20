"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Play } from "lucide-react";
import { Button, Card, Chip, EmptyState, Input, PageHeader } from "@/components/portal/ui";
import { StageTimeline, WorkCard } from "@/components/portal/board";
import { VideoReview } from "./VideoReview";
import { DownloadAll } from "@/components/portal/DownloadAll";

/*
 * The client's custom work, project by project.
 *
 * A custom job has no order behind it, so before this screen a client whose
 * only work was bespoke opened the portal and saw nothing while we were
 * actively making something for them.
 *
 * Finished projects stay in the same list rather than moving somewhere else
 * (owner decision). A client looking for last quarter's brand film looks
 * where they last saw it, and their approved videos stay one click from
 * where they left them.
 */

type PipelineStation = {
  key: string;
  label: string;
  state: "todo" | "with_us" | "with_client" | "done";
  word: string;
  gated: boolean;
  url: string | null;
  at: string | null;
};

type Video = {
  id: string;
  title: string;
  brief: string | null;
  status: string;
  dueAt: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  canReview: boolean;
  canRequestChanges: boolean;
  revisionsIncluded: number;
  revisionsUsed: number;
  pipeline: {
    ball: "us" | "client" | null;
    percent: number;
    current: string | null;
    stations: PipelineStation[];
  };
};

type Project = {
  id: string;
  title: string;
  brief: string | null;
  status: string;
  statusLabel: string;
  open: boolean;
  dueAt: string | null;
  createdAt: string;
  videos: Video[];
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

const TONE: Record<string, "neutral" | "info" | "good" | "warn"> = {
  scoped: "neutral",
  in_production: "info",
  review: "warn",
  delivered: "good",
  closed: "good",
};

/* the line a project travels, in the client's words. Closed projects sit on
 * the delivered station: to the client, done is done. */
const JOURNEY = [
  { key: "scoped", label: "Booked in", tone: "neutral" as const },
  { key: "in_production", label: "Being made", tone: "info" as const },
  { key: "review", label: "Your review", tone: "warn" as const },
  { key: "delivered", label: "Delivered", tone: "good" as const },
];

const journeyKey = (status: string) => (status === "closed" ? "delivered" : status);

const VIDEO_WORD: Record<string, string> = {
  queued: "In the queue",
  in_production: "Being made",
  ready: "Ready to watch",
  revisions: "Your changes are in hand",
  approved: "Approved",
};

const VIDEO_TONE: Record<string, "neutral" | "info" | "good" | "warn"> = {
  queued: "neutral",
  in_production: "info",
  ready: "warn",
  revisions: "warn",
  approved: "good",
};

const STRIPE: Record<"neutral" | "info" | "good" | "warn", string> = {
  neutral: "bg-hair",
  info: "bg-blue",
  good: "bg-green",
  warn: "bg-gold",
};

export function CustomView({
  authedFetch,
  onMessageStudio,
  focusVideoId,
  onFocused,
}: {
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  onMessageStudio?: () => void;
  /* a video to open on arrival, sent by the dashboard's Watch it */
  focusVideoId?: string | null;
  onFocused?: () => void;
}) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [playing, setPlaying] = useState<Video | null>(null);

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
    const home = projects.find((p) => p.videos.some((v) => v.id === focusVideoId));
    const v = home?.videos.find((x) => x.id === focusVideoId);
    if (home) setOpen(home.id);
    if (v?.videoUrl) setPlaying(v);
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
            status={playing.status}
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
    const needsThem = project.videos.filter((v) => v.status === "ready");
    const done = project.videos.filter((v) => v.status === "approved");
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(null)}
          className="tap inline-flex items-center gap-2 font-mono text-label uppercase text-muted transition-colors hover:text-gold"
        >
          <ArrowLeft size={14} aria-hidden="true" /> All projects
        </button>

        <div className="mt-4">
          <PageHeader
            title={project.title}
            description={
              project.dueAt
                ? `${project.statusLabel}. Due ${day(project.dueAt)}.`
                : project.statusLabel
            }
          />
        </div>

        <div className="mb-3">
          <Card>
            <StageTimeline steps={JOURNEY} currentKey={journeyKey(project.status)} />
          </Card>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_19rem] lg:items-start">
          <div className="grid min-w-0 gap-3">
            {needsThem.length > 0 && (
              <Card
                tone="dark"
                title={`${needsThem.length} ${needsThem.length === 1 ? "video is" : "videos are"} waiting on you`}
              >
                <p className="text-body-sm text-chrome-muted">
                  Watch it, leave your notes at the second something happens,
                  and approve it when it is right.
                </p>
              </Card>
            )}

            <Card
              title="Videos"
              description="Everything this project owes you."
              actions={
                <DownloadAll
                  videoIds={project.videos
                    .filter((v) => v.videoUrl && v.status === "approved")
                    .map((v) => v.id)}
                />
              }
            >
              {project.videos.length === 0 ? (
                <p className="text-body-sm text-muted">
                  Nothing to show yet. Your producer will add videos here as
                  they are made.
                </p>
              ) : (
                <ul className="grid gap-2">
                  {/* the whole row opens it, the same gesture Pre-made and
                      Editing use. Three ways to do one thing taught nobody
                      anything they could carry between screens. */}
                  {project.videos.map((v) => {
                    const body = (
                      <div className="flex w-full flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-body-sm font-semibold text-ink">{v.title}</p>
                          <p className="mt-0.5 font-mono text-label uppercase text-dim">
                            {v.dueAt ? `due ${day(v.dueAt)}` : "no date yet"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Chip tone={VIDEO_TONE[v.status] ?? "neutral"}>
                            {VIDEO_WORD[v.status] ?? v.status}
                          </Chip>
                          {v.videoUrl && (
                            <span className="inline-flex items-center gap-1 font-mono text-label uppercase text-gold">
                              <Play size={13} aria-hidden="true" />
                              {v.canReview ? "Review" : "Watch"}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                    return (
                      <li key={v.id}>
                        {v.videoUrl ? (
                          <button
                            type="button"
                            onClick={() => setPlaying(v)}
                            aria-label={`${v.canReview ? "Review" : "Watch"} ${v.title}`}
                            className="tap relative w-full overflow-hidden rounded-[8px] border border-hair bg-surface p-3 pl-4 text-left transition-colors hover:border-gold/60"
                          >
                            <span
                              aria-hidden="true"
                              className={`absolute inset-y-0 left-0 w-1 ${STRIPE[VIDEO_TONE[v.status] ?? "neutral"]}`}
                            />
                            {body}
                          </button>
                        ) : (
                          <div className="relative overflow-hidden rounded-[8px] border border-dashed border-hair p-3 pl-4">
                            <span
                              aria-hidden="true"
                              className={`absolute inset-y-0 left-0 w-1 ${STRIPE[VIDEO_TONE[v.status] ?? "neutral"]}`}
                            />
                            {body}
                          </div>
                        )}
                        <ProductionLine
                          v={v}
                          authedFetch={authedFetch}
                          onChanged={() => void load()}
                          onReview={() => setPlaying(v)}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            {project.brief && (
              <Card title="The brief" description="What we agreed to make.">
                <p className="whitespace-pre-wrap text-body-sm text-muted">{project.brief}</p>
              </Card>
            )}
          </div>

          <div className="grid gap-3">
            <Card title="Where it is">
              <dl className="grid gap-2 text-body-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted">Started</dt>
                  <dd className="text-ink">{day(project.createdAt)}</dd>
                </div>
                {project.dueAt && (
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted">Due</dt>
                    <dd className="text-ink">{day(project.dueAt)}</dd>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted">Approved</dt>
                  <dd className="tabular-nums text-ink">
                    {done.length} of {project.videos.length}
                  </dd>
                </div>
              </dl>
            </Card>

            {project.activity.length > 0 && (
              <Card title="What has happened">
                <ol className="grid gap-2.5">
                  {project.activity.map((a, i) => (
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
                  Message your producer and it lands with the people making
                  this.
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

  const live = projects.filter((p) => p.open);
  const finished = projects.filter((p) => !p.open);

  return (
    <div>
      <PageHeader
        title="Custom"
        description="Video made for you from scratch. Open a project for its videos, where it is, and what has happened."
      />

      {projects.length === 0 ? (
        <EmptyState
          title="No custom projects yet"
          description="Custom video is anything made from scratch for you: a brand film, a launch video, something nobody else has. Book a call and we will scope it."
          action={
            <Button variant="brand" href="/custom-video/">
              See what custom covers
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5">
          {live.length > 0 && (
            <div>
              <p className="font-mono text-label uppercase tracking-[0.1em] text-dim">
                In progress
              </p>
              <div className="mt-2 grid gap-2.5">
                {live.map((p) => (
                  <ProjectRow key={p.id} p={p} onOpen={setOpen} />
                ))}
              </div>
            </div>
          )}
          {finished.length > 0 && (
            <div>
              <p className="font-mono text-label uppercase tracking-[0.1em] text-dim">Done</p>
              <div className="mt-2 grid gap-2.5">
                {finished.map((p) => (
                  <ProjectRow key={p.id} p={p} onOpen={setOpen} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProjectRow({ p, onOpen }: { p: Project; onOpen: (id: string) => void }) {
  const needsThem = p.videos.filter((v) => v.status === "ready").length;
  const done = p.videos.filter((v) => v.status === "approved").length;
  return (
    <WorkCard
      item={{
        id: p.id,
        column: p.status,
        title: p.title,
        meta: `${p.statusLabel}. ${p.videos.length} ${p.videos.length === 1 ? "video" : "videos"}${done > 0 ? `, ${done} approved` : ""}`,
        warn: needsThem > 0 ? `${needsThem} waiting on you` : null,
        due: p.open ? (p.dueAt ? `due ${day(p.dueAt)}` : null) : "finished",
        dueTone: "neutral",
        progressPct: p.videos.length ? (done / p.videos.length) * 100 : null,
      }}
      tone={TONE[p.status] ?? "neutral"}
      onOpen={() => onOpen(p.id)}
    />
  );
}

/*
 * The production line under one video, in the client's words. Six stations,
 * the lit one is where the work stands, and anything waiting on them
 * carries its buttons right there: approve the script or the voiceover in
 * place, or open the player for animation and the final cut.
 */
function ProductionLine({
  v,
  authedFetch,
  onChanged,
  onReview,
}: {
  v: Video;
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  onChanged: () => void;
  onReview: () => void;
}) {
  const line = v.pipeline;
  const needsThem = line.ball === "client";
  const [open, setOpen] = useState(needsThem);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const touched = line.stations.some((st) => st.state !== "todo");
  if (!touched) return null;

  async function gate(stage: string, action: "approve" | "changes") {
    setBusy(true);
    setErr("");
    try {
      const j = await authedFetch(`/api/portal/projects/videos/${v.id}/gate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, action, note: action === "changes" ? note : undefined }),
      });
      if (j.error) setErr(String(j.error));
      else {
        setNoteFor(null);
        setNote("");
        onChanged();
      }
    } catch {
      setErr("That did not go through. Please try again.");
    }
    setBusy(false);
  }

  const DOT: Record<PipelineStation["state"], string> = {
    todo: "bg-hair",
    with_us: "bg-blue",
    with_client: "bg-gold",
    done: "bg-green",
  };

  return (
    <div className="mt-1.5 rounded-[8px] border border-hair bg-canvas px-3 py-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="tap flex w-full items-center justify-between gap-2 font-mono text-label uppercase text-dim transition-colors hover:text-gold"
        aria-expanded={open}
      >
        <span>
          {needsThem ? "Waiting on you" : line.ball === null ? "All done" : "In the studio"}
          {", "}
          {line.percent}% through
        </span>
        <span className="flex items-center gap-1.5">
          {line.stations.map((st) => (
            <span
              key={st.key}
              title={`${st.label}: ${st.word}`}
              className={`h-1.5 w-4 rounded-full ${DOT[st.state]}`}
            />
          ))}
          <span aria-hidden="true">{open ? "\u2212" : "+"}</span>
        </span>
      </button>

      {open && (
        <ol className="mt-2 grid gap-1.5">
          {line.stations.map((st) => {
            const mine = st.state === "with_client" && st.gated;
            const playerGate = st.key === "animation" || st.key === "delivery";
            return (
              <li key={st.key} className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${DOT[st.state]}`} />
                  <span className={`text-body-sm ${st.state === "todo" ? "text-dim" : "text-ink"}`}>
                    {st.label}
                  </span>
                  <span className={`font-mono text-label uppercase ${mine ? "text-gold" : "text-dim"}`}>
                    {st.word}
                  </span>
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
                  {mine && playerGate && (
                    <Button size="sm" variant="brand" onClick={onReview}>
                      Review it
                    </Button>
                  )}
                  {mine && !playerGate && (
                    <>
                      <Button size="sm" variant="brand" disabled={busy} onClick={() => void gate(st.key, "approve")}>
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => setNoteFor(noteFor === st.key ? null : st.key)}
                      >
                        Ask for changes
                      </Button>
                    </>
                  )}
                </span>
                {noteFor === st.key && (
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
                      onClick={() => void gate(st.key, "changes")}
                    >
                      Send
                    </Button>
                  </span>
                )}
              </li>
            );
          })}
          {err && <li className="text-body-sm text-error">{err}</li>}
        </ol>
      )}
    </div>
  );
}
