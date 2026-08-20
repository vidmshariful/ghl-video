"use client";

import { useCallback, useEffect, useState } from "react";
import { Inbox, Plus } from "lucide-react";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Tabs,
  Textarea,
} from "@/components/portal/ui";
import { authHeader, money, when } from "./client";
import {
  Drawer,
  ItemNotes,
  KanbanBoard,
  type BoardColumn,
} from "@/components/portal/board";
import {
  PROJECT_BOARD,
  REQUEST_LABEL,
  REQUEST_STATUSES,
  STUDIO_LABEL,
  isOpen,
  type ProjectStatus,
  type RequestStatus,
} from "@/lib/projects";

/*
 * Custom video, end to end.
 *
 * Two halves that are deliberately not the same thing. Enquiries arrive from
 * the website and most of them are not work yet. Jobs are work, and most are
 * created here by hand, because a deal that closes on a call or a referral
 * never passes through an enquiry at all. Merging them would force every
 * referral through a stage invented to make the funnel look tidy.
 */

type Money = {
  valueCents: number;
  paidCents: number;
  invoicedCents: number;
  outstandingCents: number;
};

type Project = {
  id: string;
  customerEmail: string;
  title: string;
  brief: string | null;
  status: ProjectStatus;
  quotedCents: number | null;
  agreedCents: number | null;
  ownerEmail: string | null;
  dueAt: string | null;
  createdAt: string;
  invoices: { id: string; number: string; totalCents: number; paid: boolean }[];
  money: Money;
  videos: {
    id: string;
    title: string;
    status: string;
    assignedTo: string | null;
    videoUrl: string | null;
    dueAt: string | null;
    revisionRound: number;
    pipeline: PipelineShape;
  }[];
};

type StationShape = {
  state: "todo" | "with_us" | "with_client" | "done";
  provided?: boolean;
  gate?: boolean;
  url?: string | null;
  at?: string | null;
};
type PipelineShape = Record<
  "script" | "voiceover" | "design" | "animation" | "sfx" | "delivery",
  StationShape
>;

const STATION_META: { key: keyof PipelineShape; label: string; providable: boolean; gateable: boolean }[] = [
  { key: "script", label: "Script", providable: true, gateable: false },
  { key: "voiceover", label: "Voiceover", providable: true, gateable: false },
  { key: "design", label: "Design", providable: false, gateable: true },
  { key: "animation", label: "Animation", providable: false, gateable: false },
  { key: "sfx", label: "Sound", providable: false, gateable: false },
  { key: "delivery", label: "Delivery", providable: false, gateable: false },
];

const STATION_STATE_WORD: Record<StationShape["state"], string> = {
  todo: "Not started",
  with_us: "With us",
  with_client: "With client",
  done: "Done",
};

const STATION_DOT: Record<StationShape["state"], string> = {
  todo: "bg-hair",
  with_us: "bg-blue",
  with_client: "bg-gold",
  done: "bg-green",
};

type Client = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  contacts: { id: string; name: string; email: string | null; role: string; title: string | null }[];
};

type Enquiry = {
  id: string;
  name: string | null;
  email: string;
  company: string | null;
  phone: string | null;
  brief: string | null;
  source: string;
  status: RequestStatus;
  lostReason: string | null;
  projectId: string | null;
  createdAt: string;
};

/* same colours the client's side wears for the same stages */
const COLUMN_TONE: Record<string, BoardColumn["tone"]> = {
  scoped: "neutral",
  in_production: "info",
  review: "warn",
  delivered: "good",
};

const VIDEO_STATUSES = ["queued", "in_production", "ready", "revisions", "approved"] as const;

const VIDEO_WORD: Record<string, string> = {
  queued: "queued",
  in_production: "being made",
  ready: "with client",
  revisions: "changes in hand",
  approved: "approved",
};

const VIDEO_STRIPE: Record<string, string> = {
  queued: "bg-hair",
  in_production: "bg-blue",
  ready: "bg-gold",
  revisions: "bg-error",
  approved: "bg-green",
};

const dueChip = (p: { dueAt: string | null; status: ProjectStatus }) => {
  if (!p.dueAt) return { due: null, dueTone: "neutral" as const };
  const late = Date.parse(p.dueAt) < Date.now() && isOpen(p.status);
  return { due: `due ${when(p.dueAt)}`, dueTone: (late ? "bad" : "neutral") as "bad" | "neutral" };
};

const REQUEST_TONE: Record<RequestStatus, "info" | "warn" | "good" | "neutral"> = {
  new: "info",
  contacted: "warn",
  quoted: "warn",
  won: "good",
  lost: "neutral",
};

const EMPTY_DRAFT = {
  customerEmail: "",
  contactId: "",
  title: "",
  brief: "",
  quotedCents: "",
  agreedCents: "",
  dueAt: "",
  fromRequestId: "",
};

export function CustomVideoScreen() {
  const [tab, setTab] = useState<"projects" | "enquiries">("projects");
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [enquiries, setEnquiries] = useState<Enquiry[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [draft, setDraft] = useState<typeof EMPTY_DRAFT | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [team, setTeam] = useState<{ email: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setErr("");
    try {
      const h = await authHeader();
      const [p, r, c] = await Promise.all([
        fetch("/api/admin/projects", { headers: h }).then((x) => x.json()),
        fetch("/api/admin/project-requests", { headers: h }).then((x) => x.json()),
        fetch("/api/admin/customers", { headers: h }).then((x) => x.json()),
      ]);
      if (p.error || r.error) return setErr(p.error ?? r.error);
      setProjects(p.projects as Project[]);
      setTeam((p.team as { email: string; name: string }[]) ?? []);
      setEnquiries(r.requests as Enquiry[]);
      setClients((c.customers as Client[]) ?? []);
    } catch {
      setErr("Could not load custom video.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!draft) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { ...(await authHeader()), "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          quotedCents: draft.quotedCents ? Math.round(Number(draft.quotedCents) * 100) : null,
          agreedCents: draft.agreedCents ? Math.round(Number(draft.agreedCents) * 100) : null,
          dueAt: draft.dueAt ? new Date(draft.dueAt).toISOString() : null,
        }),
      });
      const j = await r.json();
      if (!r.ok) return setErr(j.error ?? "Could not create the project.");
      setDraft(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function moveTo(id: string, status: string): Promise<string | null> {
    try {
      const r = await fetch("/api/admin/projects", {
        method: "PATCH",
        headers: { ...(await authHeader()), "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        return (j as { error?: string }).error ?? "Could not move it.";
      }
      await load();
      return null;
    } catch {
      return "Could not move it.";
    }
  }

  async function setStatus(p: Project, status: ProjectStatus) {
    await fetch("/api/admin/projects", {
      method: "PATCH",
      headers: { ...(await authHeader()), "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, status }),
    });
    setOpen(null);
    await load();
  }

  async function saveVideo(projectId: string, id: string, body: Record<string, unknown>) {
    await fetch("/api/admin/projects/videos", {
      method: "PATCH",
      headers: { ...(await authHeader()), "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, id, ...body }),
    });
    await load();
  }

  async function addVideo(projectId: string, title: string) {
    const r = await fetch("/api/admin/projects/videos", {
      method: "POST",
      headers: { ...(await authHeader()), "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, title }),
    });
    if (r.ok) await load();
  }

  async function markEnquiry(e: Enquiry, status: RequestStatus) {
    await fetch("/api/admin/project-requests", {
      method: "PATCH",
      headers: { ...(await authHeader()), "Content-Type": "application/json" },
      body: JSON.stringify({ id: e.id, status }),
    });
    await load();
  }

  if (err && !projects) return <p className="text-body text-error">{err}</p>;
  if (!projects || !enquiries) return <p className="text-body text-muted">Loading...</p>;

  const live = projects.filter((p) => isOpen(p.status));
  /* the client picked in the form, so its contacts can be offered */
  const chosen = clients.find((c) => c.email === draft?.customerEmail) ?? null;
  const openEnquiries = enquiries.filter((e) => e.status !== "won" && e.status !== "lost");

  const opened = open ? projects.find((x) => x.id === open) ?? null : null;

  return (
    <div className="w-full">
      <PageHeader
        title="Custom video"
        description="Bespoke work, and the enquiries that have not become work yet."
        actions={
          <Button variant="brand" icon={<Plus />} onClick={() => setDraft(EMPTY_DRAFT)}>
            New project
          </Button>
        }
      >
        <Tabs
          tabs={[
            { key: "projects" as const, label: "Projects", count: live.length },
            { key: "enquiries" as const, label: "Enquiries", count: openEnquiries.length },
          ]}
          active={tab}
          onChange={setTab}
        />
      </PageHeader>

      {err && <p className="mb-3 text-body-sm text-error">{err}</p>}

      {draft && (
        <Card
          className="mb-4"
          title="New project"
          actions={
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button variant="brand" disabled={busy} onClick={save}>
                {busy ? "Saving..." : "Create"}
              </Button>
            </div>
          }
        >
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Client"
                required
                hint="Add them under Clients first if they are not here yet."
              >
                <Select
                  value={draft.customerEmail}
                  onChange={(e) =>
                    setDraft({ ...draft, customerEmail: e.target.value, contactId: "" })
                  }
                >
                  <option value="">Pick a client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.email}>
                      {c.company || c.name || c.email}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Who we work with" hint="The person at their end running this with us.">
                <Select
                  value={draft.contactId}
                  onChange={(e) => setDraft({ ...draft, contactId: e.target.value })}
                  disabled={!chosen}
                >
                  <option value="">
                    {chosen?.contacts.length ? "Pick a contact" : "No contacts on this client yet"}
                  </option>
                  {(chosen?.contacts ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.title ? `, ${c.title}` : ""} ({c.role})
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Project name" required hint="What you would call it out loud.">
                <Input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Onboarding explainer, 90 sec"
                />
              </Field>
            </div>
            <Field label="The brief" hint="What they asked for, in their words if you have them.">
              <Textarea
                rows={3}
                value={draft.brief}
                onChange={(e) => setDraft({ ...draft, brief: e.target.value })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Quoted" hint="Dollars. What you asked for.">
                <Input
                  type="number"
                  value={draft.quotedCents}
                  onChange={(e) => setDraft({ ...draft, quotedCents: e.target.value })}
                  placeholder="2500"
                />
              </Field>
              <Field label="Agreed" hint="Dollars. What was settled on.">
                <Input
                  type="number"
                  value={draft.agreedCents}
                  onChange={(e) => setDraft({ ...draft, agreedCents: e.target.value })}
                  placeholder="1995"
                />
              </Field>
              <Field label="Due" hint="Optional.">
                <Input
                  type="date"
                  value={draft.dueAt}
                  onChange={(e) => setDraft({ ...draft, dueAt: e.target.value })}
                />
              </Field>
            </div>
          </div>
        </Card>
      )}

      {tab === "projects" ? (
        <>
          {projects.length === 0 ? (
            <EmptyState
              title="No custom projects open"
              description="Most projects start on a call or a referral. Create one and it appears on the board."
              action={
                <Button variant="brand" icon={<Plus />} onClick={() => setDraft(EMPTY_DRAFT)}>
                  New project
                </Button>
              }
            />
          ) : (
            <KanbanBoard
              columns={PROJECT_BOARD.map((col) => ({
                key: col,
                label: STUDIO_LABEL[col],
                tone: COLUMN_TONE[col] ?? "neutral",
              }))}
              items={live.map((p) => {
                const done = p.videos.filter((v) => v.status === "approved").length;
                return {
                  id: p.id,
                  column: p.status,
                  title: p.title,
                  meta: `${p.customerEmail} / ${money(p.money.valueCents)}`,
                  assignee: p.ownerEmail,
                  ...dueChip(p),
                  warn: p.money.outstandingCents > 0 ? `${money(p.money.outstandingCents)} owed` : null,
                  progress: p.videos.length ? `${done}/${p.videos.length}` : null,
                  progressPct: p.videos.length ? (done / p.videos.length) * 100 : null,
                };
              })}
              onOpen={setOpen}
              onMove={moveTo}
            />
          )}

          {/* closing a job must never make it vanish: the finished live
              here, readable and one click from coming back */}
          {projects.some((p) => !isOpen(p.status)) && (
            <div className="mt-6">
              <p className="font-mono text-label uppercase tracking-[0.1em] text-dim">
                Finished
              </p>
              <div className="mt-2 grid gap-2">
                {projects
                  .filter((p) => !isOpen(p.status))
                  .map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-hair bg-surface px-4 py-2.5"
                    >
                      <button
                        type="button"
                        onClick={() => setOpen(p.id)}
                        className="tap min-w-0 flex-1 text-left"
                      >
                        <span className="block truncate text-body-sm font-semibold text-ink">
                          {p.title}
                        </span>
                        <span className="mt-0.5 block truncate font-mono text-label uppercase text-dim">
                          {p.customerEmail} / {money(p.money.valueCents)}
                        </span>
                      </button>
                      <span className="flex shrink-0 items-center gap-2">
                        <Chip tone="neutral">{STUDIO_LABEL[p.status]}</Chip>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void moveTo(p.id, "scoped")}
                        >
                          Reopen
                        </Button>
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      ) : enquiries.length === 0 ? (
        <EmptyState
          icon={<Inbox />}
          title="No enquiries yet"
          description="Quote requests from the website land here the moment somebody sends one."
        />
      ) : (
        <div className="grid gap-2.5">
          {enquiries.map((e) => (
            <Card key={e.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-body font-semibold text-ink">
                      {e.company || e.name || e.email}
                    </p>
                    <Chip tone={REQUEST_TONE[e.status]}>{REQUEST_LABEL[e.status]}</Chip>
                    <span className="font-mono text-label uppercase text-dim">
                      {e.email}
                      {e.phone ? ` / ${e.phone}` : ""} / {when(e.createdAt)}
                    </span>
                  </div>
                  {e.brief && (
                    <p className="mt-1.5 whitespace-pre-wrap text-body-sm text-muted">{e.brief}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Select
                    value={e.status}
                    onChange={(ev) => markEnquiry(e, ev.target.value as RequestStatus)}
                    aria-label={`Status for ${e.email}`}
                  >
                    {REQUEST_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {REQUEST_LABEL[s]}
                      </option>
                    ))}
                  </Select>
                  {!e.projectId && e.status !== "lost" && (
                    <Button
                      variant="brand"
                      size="sm"
                      onClick={() =>
                        setDraft({
                          ...EMPTY_DRAFT,
                          customerEmail: e.email,
                          title: e.company ? `Custom video for ${e.company}` : "Custom video",
                          brief: e.brief ?? "",
                          fromRequestId: e.id,
                        })
                      }
                    >
                      Make it a project
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Drawer open={!!opened} onClose={() => setOpen(null)} title={opened?.title ?? ""}>
        {opened && (
          <ProjectDrawer
            p={opened}
            team={team}
            onStatus={(status) => setStatus(opened, status)}
            onSaveVideo={(id, body) => saveVideo(opened.id, id, body)}
            onAddVideo={(title) => addVideo(opened.id, title)}
          />
        )}
      </Drawer>
    </div>
  );
}

/*
 * One job, opened over the board. Everything the studio needs while a
 * client is on the phone: the money, the videos and who is cutting each,
 * the brief, the invoices, and the notes the client never sees.
 */
function ProjectDrawer({
  p,
  team,
  onStatus,
  onSaveVideo,
  onAddVideo,
}: {
  p: Project;
  team: { email: string; name: string }[];
  onStatus: (s: ProjectStatus) => void;
  onSaveVideo: (id: string, body: Record<string, unknown>) => Promise<void>;
  onAddVideo: (title: string) => Promise<void>;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [linkFor, setLinkFor] = useState<string | null>(null);
  const [lineFor, setLineFor] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  /* closing hides a job from the board, so the button asks twice: the first
     click arms it, the second does it, and it disarms itself after a moment */
  const [confirming, setConfirming] = useState<ProjectStatus | null>(null);
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(null), 4000);
    return () => clearTimeout(t);
  }, [confirming]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip tone={isOpen(p.status) ? "info" : "neutral"}>{STUDIO_LABEL[p.status]}</Chip>
          {p.dueAt && <Chip tone="warn">due {when(p.dueAt)}</Chip>}
          <span className="font-mono text-label uppercase text-dim">{p.customerEmail}</span>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {!isOpen(p.status) ? (
            <Button size="sm" variant="secondary" onClick={() => onStatus("scoped")}>
              Reopen
            </Button>
          ) : (
            (["closed", "cancelled"] as ProjectStatus[]).map((st) => (
              <Button
                key={st}
                size="sm"
                variant={st === "cancelled" ? "danger" : "secondary"}
                onClick={() => {
                  if (confirming === st) {
                    setConfirming(null);
                    onStatus(st);
                  } else {
                    setConfirming(st);
                  }
                }}
              >
                {confirming === st
                  ? st === "cancelled"
                    ? "Click again to cancel it"
                    : "Click again to close it"
                  : STUDIO_LABEL[st]}
              </Button>
            ))
          )}
        </div>
      </div>
      {confirming && (
        <p className="text-body-sm text-muted">
          {confirming === "cancelled" ? "Cancelling" : "Closing"} moves this
          job off the board into Finished below it, where Reopen brings it
          back. Nothing is deleted.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["Agreed", money(p.money.valueCents), "text-gold"],
            ["Paid", money(p.money.paidCents), "text-green"],
            ["Still owed", money(p.money.outstandingCents), p.money.outstandingCents ? "text-error" : "text-ink"],
            ["Videos", String(p.videos.length), "text-ink"],
          ] as const
        ).map(([label, value, tone]) => (
          <div key={label} className="rounded-[8px] border border-hair bg-surface p-3">
            <p className="font-mono text-label uppercase text-dim">{label}</p>
            <p className={`mt-1 font-display text-h4 tabular-nums ${tone}`}>{value}</p>
          </div>
        ))}
      </div>

      <Card title="Videos" description="Each one, where it is, and who is cutting it.">
        {p.videos.length === 0 ? (
          <p className="text-body-sm text-dim">Nothing added yet.</p>
        ) : (
          <ul className="grid gap-2">
            {p.videos.map((v) => (
              <li
                key={v.id}
                className="relative overflow-hidden rounded-[8px] border border-hair bg-surface p-3 pl-4"
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-0 left-0 w-1 ${VIDEO_STRIPE[v.status] ?? "bg-hair"}`}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 text-body-sm font-semibold text-ink">{v.title}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setLinkFor(linkFor === v.id ? null : v.id);
                      setLink(v.videoUrl ?? "");
                    }}
                    className="tap font-mono text-label uppercase text-dim transition-colors hover:text-gold"
                  >
                    {v.videoUrl ? "the cut" : "no cut yet"}
                  </button>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Select
                    value={v.status}
                    onChange={(e) => void onSaveVideo(v.id, { status: e.target.value })}
                    aria-label={`Status for ${v.title}`}
                  >
                    {VIDEO_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {VIDEO_WORD[st]}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={v.assignedTo ?? ""}
                    onChange={(e) => void onSaveVideo(v.id, { assignedTo: e.target.value })}
                    aria-label={`Editor for ${v.title}`}
                  >
                    <option value="">Nobody yet</option>
                    {team.map((t) => (
                      <option key={t.email} value={t.email}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </div>
                {linkFor === v.id && (
                  <div className="mt-2 flex gap-2">
                    <Input
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      placeholder="Link to the cut"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        await onSaveVideo(v.id, { videoUrl: link });
                        setBusy(false);
                        setLinkFor(null);
                      }}
                    >
                      Save
                    </Button>
                  </div>
                )}
                <PipelinePanel
                  v={v}
                  open={lineFor === v.id}
                  onToggle={() => setLineFor(lineFor === v.id ? null : v.id)}
                  onStation={(key, patch, requestApproval) =>
                    onSaveVideo(v.id, { station: { key, ...patch, requestApproval } })
                  }
                  onAddDraft={(url, note) => onSaveVideo(v.id, { action: "add_draft", url, note })}
                />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Brand film, master cut"
            aria-label="New video title"
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || !newTitle.trim()}
            onClick={async () => {
              setBusy(true);
              await onAddVideo(newTitle.trim());
              setBusy(false);
              setNewTitle("");
            }}
          >
            Add
          </Button>
        </div>
      </Card>

      <Card title="The brief">
        {p.brief ? (
          <p className="whitespace-pre-wrap text-body-sm text-muted">{p.brief}</p>
        ) : (
          <p className="text-body-sm text-dim">No brief written down yet.</p>
        )}
      </Card>

      <Card title="Invoices">
        {p.invoices.length === 0 ? (
          <p className="text-body-sm text-muted">
            None raised. Send one from Invoices and pick this job.
          </p>
        ) : (
          <ul className="grid gap-2">
            {p.invoices.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 text-body-sm">
                <span className="text-ink">{i.number}</span>
                <span className="flex items-center gap-2">
                  <Chip tone={i.paid ? "good" : "warn"}>{i.paid ? "paid" : "open"}</Chip>
                  <span className="tabular-nums text-ink">{money(i.totalCents)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ItemNotes target={{ projectId: p.id }} authHeader={authHeader} />
    </div>
  );
}

/*
 * The production line inside one video, from Tanvir's side. Six stations:
 * flip who holds each one, keep the file on it, mark what the client
 * provided, and hand a station to the client for approval, which emails
 * them and lights their portal. Animation gets its drafts as versions so
 * a note about 0:12 keeps pointing at the cut it was written on.
 */
function PipelinePanel({
  v,
  open,
  onToggle,
  onStation,
  onAddDraft,
}: {
  v: Project["videos"][number];
  open: boolean;
  onToggle: () => void;
  onStation: (
    key: keyof PipelineShape,
    patch: Partial<StationShape>,
    requestApproval?: boolean,
  ) => Promise<void>;
  onAddDraft: (url: string, note: string) => Promise<void>;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const line = v.pipeline;
  const doneCount = STATION_META.filter((m) => line[m.key]?.state === "done").length;

  const run = async (tag: string, fn: () => Promise<void>) => {
    setBusy(tag);
    await fn();
    setBusy(null);
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={onToggle}
        className="tap flex w-full items-center justify-between font-mono text-label uppercase text-dim transition-colors hover:text-gold"
      >
        <span>Production line, {doneCount} of 6 done</span>
        <span className="flex items-center gap-1.5">
          {STATION_META.map((m) => (
            <span
              key={m.key}
              title={`${m.label}: ${STATION_STATE_WORD[line[m.key]?.state ?? "todo"]}`}
              className={`h-1.5 w-4 rounded-full ${STATION_DOT[line[m.key]?.state ?? "todo"]}`}
            />
          ))}
          <span aria-hidden="true">{open ? "\u2212" : "+"}</span>
        </span>
      </button>

      {open && (
        <div className="mt-2 grid gap-1.5">
          {v.revisionRound > 0 && (
            <p className="font-mono text-label uppercase text-dim">
              revision round {v.revisionRound}
            </p>
          )}
          {STATION_META.map((m) => {
            const st = line[m.key] ?? { state: "todo" as const };
            const gated = Boolean(st.gate) && !st.provided;
            return (
              <div key={m.key} className="rounded-[8px] border border-hair bg-canvas p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={`h-2 w-2 rounded-full ${STATION_DOT[st.state]}`}
                    />
                    <span className="text-body-sm font-semibold text-ink">{m.label}</span>
                    {st.provided && <Chip tone="neutral">client provided</Chip>}
                    {gated && <Chip tone="warn">needs their approval</Chip>}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {m.providable && (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() =>
                          void run(m.key, () => onStation(m.key, { provided: !st.provided }))
                        }
                        className="tap font-mono text-label uppercase text-dim transition-colors hover:text-gold"
                      >
                        {st.provided ? "ours after all" : "theirs"}
                      </button>
                    )}
                    {m.gateable && (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void run(m.key, () => onStation(m.key, { gate: !st.gate }))}
                        className="tap font-mono text-label uppercase text-dim transition-colors hover:text-gold"
                      >
                        {st.gate ? "no approval" : "ask approval"}
                      </button>
                    )}
                    <Select
                      value={st.state}
                      disabled={st.provided}
                      onChange={(e) =>
                        void run(m.key, () =>
                          onStation(m.key, { state: e.target.value as StationShape["state"] }),
                        )
                      }
                      aria-label={`${m.label} state`}
                    >
                      {(Object.keys(STATION_STATE_WORD) as StationShape["state"][]).map((k) => (
                        <option key={k} value={k}>
                          {STATION_STATE_WORD[k]}
                        </option>
                      ))}
                    </Select>
                  </span>
                </div>

                {m.key === "animation" ? (
                  <div className="mt-2 flex gap-2">
                    <Input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="New draft link, becomes the next version"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy !== null || !draft.trim()}
                      onClick={() =>
                        void run("draft", async () => {
                          await onAddDraft(draft.trim(), "");
                          setDraft("");
                        })
                      }
                    >
                      Add draft
                    </Button>
                  </div>
                ) : (
                  !st.provided &&
                  m.key !== "sfx" && (
                    <div className="mt-2 flex gap-2">
                      <Input
                        value={urls[m.key] ?? st.url ?? ""}
                        onChange={(e) => setUrls({ ...urls, [m.key]: e.target.value })}
                        placeholder={
                          m.key === "design" ? "Figma link" : `Link to the ${m.label.toLowerCase()}`
                        }
                      />
                      {(urls[m.key] ?? "") !== (st.url ?? "") && urls[m.key] !== undefined && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy !== null}
                          onClick={() =>
                            void run(m.key, () => onStation(m.key, { url: urls[m.key] ?? "" }))
                          }
                        >
                          Save
                        </Button>
                      )}
                    </div>
                  )
                )}

                {gated && st.state !== "done" && st.state !== "with_client" && (
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={busy !== null || (!st.url && m.key !== "delivery" && m.key !== "animation") || (m.key === "animation" && !v.videoUrl)}
                      onClick={() =>
                        void run(`send-${m.key}`, () =>
                          onStation(m.key, { state: "with_client" }, true),
                        )
                      }
                    >
                      Send for their approval
                    </Button>
                  </div>
                )}
                {st.state === "with_client" && (
                  <p className="mt-1.5 font-mono text-label uppercase text-gold">
                    with the client{st.at ? ` since ${when(st.at)}` : ""}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
