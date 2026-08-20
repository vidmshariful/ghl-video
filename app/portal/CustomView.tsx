"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CalendarClock, Check, Play } from "lucide-react";
import { Button, Card, Chip, EmptyState, PageHeader } from "@/components/portal/ui";
import { VideoReview } from "./VideoReview";

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

            <Card title="Videos" description="Everything this project owes you.">
              {project.videos.length === 0 ? (
                <p className="text-body-sm text-muted">
                  Nothing to show yet. Your producer will add videos here as
                  they are made.
                </p>
              ) : (
                <ul className="grid gap-2.5">
                  {project.videos.map((v) => (
                    <li
                      key={v.id}
                      className="flex flex-wrap items-start justify-between gap-3 border-t border-hair pt-2.5 first:border-t-0 first:pt-0"
                    >
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
                          <Button
                            variant={v.canReview ? "brand" : "secondary"}
                            size="sm"
                            icon={<Play />}
                            onClick={() => setPlaying(v)}
                          >
                            {v.canReview ? "Review it" : "Watch"}
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
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
              <div className="flex items-center gap-2">
                <Chip tone={TONE[project.status] ?? "neutral"}>{project.statusLabel}</Chip>
              </div>
              <dl className="mt-3 grid gap-2 text-body-sm">
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
    <button
      type="button"
      onClick={() => onOpen(p.id)}
      className="tap w-full rounded-[12px] border border-hair bg-surface p-5 text-left transition-colors hover:border-gold/50"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body font-semibold text-ink">{p.title}</p>
          <p className="mt-1 font-mono text-label uppercase text-dim">
            {p.videos.length} {p.videos.length === 1 ? "video" : "videos"}
            {done > 0 ? `, ${done} approved` : ""}
          </p>
          {p.dueAt && p.open && (
            <p className="mt-1.5 flex items-center gap-1.5 text-body-sm text-muted">
              <CalendarClock size={13} aria-hidden="true" /> Due {day(p.dueAt)}
            </p>
          )}
          {!p.open && (
            <p className="mt-1.5 flex items-center gap-1.5 text-body-sm text-green">
              <Check size={13} aria-hidden="true" /> Finished
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {needsThem > 0 && <Chip tone="warn">{needsThem} waiting on you</Chip>}
          <Chip tone={TONE[p.status] ?? "neutral"}>{p.statusLabel}</Chip>
        </div>
      </div>
    </button>
  );
}
