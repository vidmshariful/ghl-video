"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, Inbox, Plus, X } from "lucide-react";
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
import { initialsOf } from "@/components/portal/board";
import { pages } from "@/lib/site";
import { ItemNotes } from "@/components/portal/board";
import {
  PROJECT_LIST,
  REQUEST_LABEL,
  REQUEST_STATUSES,
  STUDIO_LABEL,
  isOpen,
  type ProjectStatus,
  type RequestStatus,
} from "@/lib/projects";

/*
 * Custom video, the simple way (owner decision, 21 August 2026).
 *
 * A project IS the video. The list carries the studio's own categories,
 * Backlog through Cutdowns, and opening a project is a full screen, not a
 * side panel. Inside: the six-station production line, the extra formats
 * cut after approval, the money, the brief, the notes. Nobody is assigned
 * here; production lives in ClickUp, and this screen exists to run the
 * client relationship.
 */

type Station = {
  state: "todo" | "with_us" | "with_client" | "done";
  provided?: boolean;
  gate?: boolean;
  url?: string | null;
  at?: string | null;
  eta?: string | null;
};
type Pipeline = Record<
  "script" | "voiceover" | "design" | "animation" | "sfx" | "delivery",
  Station
>;

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
  category: string | null;
  tags: string[];
  pipeline: Pipeline;
  ball: "us" | "client" | null;
  quotedCents: number | null;
  agreedCents: number | null;
  ownerEmail: string | null;
  dueAt: string | null;
  createdAt: string;
  invoices: { id: string; number: string; totalCents: number; paid: boolean }[];
  money: Money;
  mainVideo: { id: string; videoUrl: string | null; revisionRound: number } | null;
  formats: { id: string; title: string; status: string; videoUrl: string | null }[];
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

const REQUEST_TONE: Record<RequestStatus, "info" | "warn" | "good" | "neutral"> = {
  new: "info",
  contacted: "warn",
  quoted: "warn",
  won: "good",
  lost: "neutral",
};

/* the list's colour language, one dot per category */
const STATUS_DOT: Record<string, string> = {
  backlog: "bg-hair",
  planning: "bg-blue/60",
  in_progress: "bg-blue",
  review: "bg-gold",
  revision: "bg-error",
  approved: "bg-green",
  cutdowns: "bg-gold/60",
};

const STATION_META: { key: keyof Pipeline; label: string; providable: boolean; gateable: boolean }[] = [
  { key: "script", label: "Scripting", providable: true, gateable: false },
  { key: "voiceover", label: "Voiceover", providable: true, gateable: false },
  { key: "design", label: "Concept and Design", providable: false, gateable: true },
  { key: "animation", label: "Animation", providable: false, gateable: false },
  { key: "sfx", label: "Sound Design", providable: false, gateable: false },
  { key: "delivery", label: "Delivery", providable: false, gateable: false },
];

const STATION_STATE_WORD: Record<Station["state"], string> = {
  todo: "Not started",
  with_us: "With us",
  with_client: "With client",
  done: "Done",
};

const STATION_DOT: Record<Station["state"], string> = {
  todo: "bg-hair",
  with_us: "bg-blue",
  with_client: "bg-gold",
  done: "bg-green",
};

const FORMAT_WORD: Record<string, string> = {
  queued: "Backlog",
  in_production: "In progress",
  ready: "Review",
  revisions: "Revision",
  approved: "Done",
};

const day = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

const CATEGORIES = pages.custom.formats.items.map((f) => f.name);

/* the shared column skeleton, so the header and every row line up */
const TABLE_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:grid-cols-[minmax(0,2.3fr)_8.5rem_6.5rem_minmax(0,1fr)_3rem_5.5rem_5rem]";

const EMPTY_DRAFT = {
  customerEmail: "",
  contactId: "",
  title: "",
  category: "",
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
  const [team, setTeam] = useState<{ email: string; name: string }[]>([]);
  const [draft, setDraft] = useState<typeof EMPTY_DRAFT | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
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

  async function patchProject(id: string, body: Record<string, unknown>): Promise<string | null> {
    try {
      const r = await fetch("/api/admin/projects", {
        method: "PATCH",
        headers: { ...(await authHeader()), "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        return (j as { error?: string }).error ?? "That did not save.";
      }
      await load();
      return null;
    } catch {
      return "That did not save.";
    }
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

  const chosen = clients.find((c) => c.email === draft?.customerEmail) ?? null;
  const openEnquiries = enquiries.filter((e) => e.status !== "won" && e.status !== "lost");
  const live = projects.filter((p) => isOpen(p.status));

  /* ---- one project, opened as a full screen ---- */
  const opened = open ? projects.find((x) => x.id === open) ?? null : null;
  if (opened) {
    return (
      <ProjectPage
        p={opened}
        team={team}
        onBack={() => setOpen(null)}
        onPatch={(body) => patchProject(opened.id, body)}
        onReload={load}
      />
    );
  }

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
              <Field label="Category" hint="The format being made. Same four the site sells.">
                <Select
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                >
                  <option value="">Pick one</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
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
              description="Most projects start on a call or a referral. Create one and it appears in the list."
              action={
                <Button variant="brand" icon={<Plus />} onClick={() => setDraft(EMPTY_DRAFT)}>
                  New project
                </Button>
              }
            />
          ) : (
            <div className="grid gap-1">
              {/* the header every group's rows align to */}
              <div className={`${TABLE_GRID} px-3.5 pb-1`}>
                <span className="font-mono text-label uppercase tracking-[0.08em] text-dim">
                  Project
                </span>
                <span className="hidden font-mono text-label uppercase tracking-[0.08em] text-dim lg:block">
                  Category
                </span>
                <span className="hidden font-mono text-label uppercase tracking-[0.08em] text-dim lg:block">
                  Line
                </span>
                <span className="hidden font-mono text-label uppercase tracking-[0.08em] text-dim lg:block">
                  Tags
                </span>
                <span className="hidden font-mono text-label uppercase tracking-[0.08em] text-dim lg:block">
                  PM
                </span>
                <span className="hidden text-right font-mono text-label uppercase tracking-[0.08em] text-dim lg:block">
                  Owed
                </span>
                <span className="text-right font-mono text-label uppercase tracking-[0.08em] text-dim">
                  Due
                </span>
              </div>

              {PROJECT_LIST.map((cat) => {
                const rows = live.filter((p) => p.status === cat);
                const shut = collapsed.has(cat);
                return (
                  <div key={cat}>
                    <button
                      type="button"
                      onClick={() => {
                        const next = new Set(collapsed);
                        if (shut) next.delete(cat);
                        else next.add(cat);
                        setCollapsed(next);
                      }}
                      className="tap flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left transition-colors hover:bg-surface"
                      aria-expanded={!shut}
                    >
                      {shut ? (
                        <ChevronRight size={14} className="text-dim" aria-hidden="true" />
                      ) : (
                        <ChevronDown size={14} className="text-dim" aria-hidden="true" />
                      )}
                      <span
                        aria-hidden="true"
                        className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[cat]}`}
                      />
                      <span className="font-mono text-label uppercase tracking-[0.08em] text-ink">
                        {STUDIO_LABEL[cat]}
                      </span>
                      <span className="font-mono text-label tabular-nums text-dim">
                        {rows.length}
                      </span>
                    </button>

                    {!shut && rows.length > 0 && (
                      <ul className="mb-2 ml-1.5 grid gap-px overflow-hidden rounded-[8px] border border-hair">
                        {rows.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => setOpen(p.id)}
                              className={`tap ${TABLE_GRID} w-full bg-surface px-3.5 py-2.5 text-left transition-colors hover:bg-card`}
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-body-sm font-semibold text-ink">
                                  {p.title}
                                </span>
                                <span className="mt-0.5 block truncate font-mono text-label uppercase text-dim">
                                  {p.customerEmail}
                                </span>
                              </span>
                              <span className="hidden min-w-0 lg:block">
                                {p.category ? (
                                  <span className="truncate text-body-sm text-muted">
                                    {p.category}
                                  </span>
                                ) : (
                                  <span className="font-mono text-label uppercase text-dim">
                                    not set
                                  </span>
                                )}
                              </span>
                              <span className="hidden items-center gap-1 lg:flex">
                                {(
                                  ["script", "voiceover", "design", "animation", "sfx", "delivery"] as const
                                ).map((k) => (
                                  <span
                                    key={k}
                                    title={k}
                                    className={`h-1.5 w-3 rounded-full ${STATION_DOT[p.pipeline[k]?.state ?? "todo"]}`}
                                  />
                                ))}
                              </span>
                              <span className="hidden min-w-0 items-center gap-1.5 lg:flex">
                                {p.ball === "client" && <Chip tone="warn">with client</Chip>}
                                {p.tags.slice(0, 2).map((t) => (
                                  <span
                                    key={t}
                                    className="truncate rounded-full border border-hair px-2 py-0.5 font-mono text-label text-muted"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </span>
                              <span className="hidden lg:block">
                                {p.ownerEmail ? (
                                  <span
                                    title={p.ownerEmail}
                                    className="grid h-6 w-6 place-items-center rounded-full border border-hair bg-card font-mono text-label font-bold text-ink"
                                  >
                                    {initialsOf(p.ownerEmail)}
                                  </span>
                                ) : (
                                  <span className="font-mono text-label text-dim">?</span>
                                )}
                              </span>
                              <span className="hidden text-right font-mono text-label uppercase tabular-nums lg:block">
                                {p.money.outstandingCents > 0 ? (
                                  <span className="text-gold">{money(p.money.outstandingCents)}</span>
                                ) : (
                                  <span className="text-dim">paid</span>
                                )}
                              </span>
                              <span
                                className={`text-right font-mono text-label uppercase ${
                                  p.dueAt && Date.parse(p.dueAt) < Date.now()
                                    ? "text-error"
                                    : "text-dim"
                                }`}
                              >
                                {p.dueAt ? day(p.dueAt) : ""}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}

              {/* closing a job must never make it vanish */}
              {projects.some((p) => !isOpen(p.status)) && (
                <div className="mt-5">
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
                              onClick={() => void patchProject(p.id, { status: "backlog" })}
                            >
                              Reopen
                            </Button>
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
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
    </div>
  );
}

/*
 * One project, full screen. The stage, the money, the six-station line,
 * the extra formats, the brief, the invoices, the notes the client never
 * sees. Everything Tanvir needs while a client is on the phone, on one
 * page with no side panel.
 */
function ProjectPage({
  p,
  team,
  onBack,
  onPatch,
  onReload,
}: {
  p: Project;
  team: { email: string; name: string }[];
  onBack: () => void;
  onPatch: (body: Record<string, unknown>) => Promise<string | null>;
  onReload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [pageErr, setPageErr] = useState("");
  const [confirming, setConfirming] = useState<ProjectStatus | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(null), 4000);
    return () => clearTimeout(t);
  }, [confirming]);

  const run = async (tag: string, body: Record<string, unknown>) => {
    setBusy(tag);
    setPageErr("");
    const e = await onPatch(body);
    if (e) setPageErr(e);
    setBusy(null);
  };

  return (
    <div className="w-full">
      <Button variant="ghost" size="sm" icon={<ArrowLeft />} onClick={onBack}>
        All custom video
      </Button>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-h3 text-ink">{p.title}</h1>
          <p className="mt-0.5 text-body-sm text-muted">
            {p.customerEmail}
            <span className="ml-2 font-mono text-label uppercase text-dim">
              opened {when(p.createdAt)}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {!isOpen(p.status) ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void run("reopen", { status: "backlog" })}
            >
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
                    void run(st, { status: st });
                  } else setConfirming(st);
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
        <p className="mt-2 text-body-sm text-muted">
          {confirming === "cancelled" ? "Cancelling" : "Closing"} moves this job
          into Finished at the foot of the list, where Reopen brings it back.
          Nothing is deleted.
        </p>
      )}

      {/* the stage, one click per category */}
      {isOpen(p.status) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="flex flex-wrap overflow-hidden rounded-[6px] border border-hair">
            {PROJECT_LIST.map((st) => (
              <button
                key={st}
                type="button"
                disabled={busy !== null || st === p.status}
                onClick={() => void run("stage", { status: st })}
                className={`tap px-2.5 py-1.5 font-mono text-label uppercase transition-colors ${
                  st === p.status ? "bg-gold text-canvas" : "text-dim hover:text-ink"
                }`}
              >
                {STUDIO_LABEL[st]}
              </button>
            ))}
          </span>
        </div>
      )}

      {pageErr && <p className="mt-3 text-body-sm text-error">{pageErr}</p>}

      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start">
        {/* ---- the work side ---- */}
        <div className="grid min-w-0 gap-3">
          <Card
            title="Production line"
            description="The six stations of the main video. Files, approvals and expected dates live here."
          >
            <StationList p={p} busy={busy} onRun={run} />
          </Card>

          <Card
            title="Extra formats"
            description="Cut after the main video is approved: reels, shorts, square crops. A title, a link when done, one of four states."
          >
            <FormatList p={p} onReload={onReload} />
          </Card>

          <Card title="The brief">
            {p.brief ? (
              <p className="whitespace-pre-wrap text-body-sm text-muted">{p.brief}</p>
            ) : (
              <p className="text-body-sm text-dim">No brief written down yet.</p>
            )}
          </Card>
        </div>

        {/* ---- the relationship side ---- */}
        <div className="grid min-w-0 gap-3">
          <Card title="The job">
            <dl className="grid gap-2.5 text-body-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Deadline</dt>
                <dd>
                  <Input
                    type="date"
                    value={p.dueAt ? p.dueAt.slice(0, 10) : ""}
                    onChange={(e) =>
                      void run("due", {
                        dueAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                      })
                    }
                    aria-label="Deadline"
                    className="w-[9.5rem]"
                  />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Category</dt>
                <dd>
                  <Select
                    value={p.category ?? ""}
                    onChange={(e) => void run("category", { category: e.target.value || null })}
                    aria-label="Video category"
                  >
                    <option value="">Not set</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Project manager</dt>
                <dd>
                  <Select
                    value={p.ownerEmail ?? ""}
                    onChange={(e) => void run("pm", { ownerEmail: e.target.value || null })}
                    aria-label="Project manager"
                  >
                    <option value="">Nobody yet</option>
                    {team.map((t) => (
                      <option key={t.email} value={t.email}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">Agreed</dt>
                <dd className="font-display tabular-nums text-gold">{money(p.money.valueCents)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">Paid</dt>
                <dd className="tabular-nums text-green">{money(p.money.paidCents)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">Still owed</dt>
                <dd className={`tabular-nums ${p.money.outstandingCents ? "text-error" : "text-ink"}`}>
                  {money(p.money.outstandingCents)}
                </dd>
              </div>
            </dl>
          </Card>

          <Card title="Tags">
            <div className="flex flex-wrap items-center gap-1.5">
              {p.tags.map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1 rounded-full border border-hair px-2 py-0.5 font-mono text-label text-muted"
                >
                  {t}
                  <button
                    type="button"
                    aria-label={`Remove tag ${t}`}
                    onClick={() => void run("tags", { tags: p.tags.filter((x) => x !== t) })}
                    className="tap text-dim transition-colors hover:text-error"
                  >
                    <X size={11} aria-hidden="true" />
                  </button>
                </span>
              ))}
              {p.tags.length === 0 && (
                <span className="text-body-sm text-dim">None yet. Rush, VIP, agency, whatever helps.</span>
              )}
            </div>
            <div className="mt-2.5 flex gap-2">
              <Input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                placeholder="Add a tag"
                aria-label="New tag"
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={busy !== null || !tagDraft.trim()}
                onClick={() => {
                  const t = tagDraft.trim().toLowerCase();
                  setTagDraft("");
                  if (t && !p.tags.includes(t)) void run("tags", { tags: [...p.tags, t] });
                }}
              >
                Add
              </Button>
            </div>
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
      </div>
    </div>
  );
}

/* the six stations with their controls, project level */
function StationList({
  p,
  busy,
  onRun,
}: {
  p: Project;
  busy: string | null;
  onRun: (tag: string, body: Record<string, unknown>) => Promise<void>;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [draftUrl, setDraftUrl] = useState("");
  const line = p.pipeline;

  const station = (key: keyof Pipeline, patch: Record<string, unknown>, requestApproval?: boolean) =>
    onRun(`st-${key}`, { station: { key, ...patch, requestApproval } });

  return (
    <div className="grid gap-1.5">
      {p.mainVideo && p.mainVideo.revisionRound > 0 && (
        <p className="font-mono text-label uppercase text-dim">
          revision round {p.mainVideo.revisionRound}
        </p>
      )}
      {STATION_META.map((m) => {
        const st = line[m.key] ?? { state: "todo" as const };
        const gated = Boolean(st.gate) && !st.provided;
        return (
          <div key={m.key} className="rounded-[8px] border border-hair bg-canvas p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className={`h-2 w-2 rounded-full ${STATION_DOT[st.state]}`} />
                <span className="text-body-sm font-semibold text-ink">{m.label}</span>
                {st.provided && <Chip tone="neutral">client provided</Chip>}
                {gated && <Chip tone="warn">needs their approval</Chip>}
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                {m.providable && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void station(m.key, { provided: !st.provided })}
                    className="tap font-mono text-label uppercase text-dim transition-colors hover:text-gold"
                  >
                    {st.provided ? "ours after all" : "theirs"}
                  </button>
                )}
                {m.gateable && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void station(m.key, { gate: !st.gate })}
                    className="tap font-mono text-label uppercase text-dim transition-colors hover:text-gold"
                  >
                    {st.gate ? "no approval" : "ask approval"}
                  </button>
                )}
                <Select
                  value={st.state}
                  disabled={st.provided}
                  onChange={(e) => void station(m.key, { state: e.target.value })}
                  aria-label={`${m.label} state`}
                >
                  {(Object.keys(STATION_STATE_WORD) as Station["state"][]).map((k) => (
                    <option key={k} value={k}>
                      {STATION_STATE_WORD[k]}
                    </option>
                  ))}
                </Select>
                {!st.provided && st.state !== "done" && (
                  <Input
                    type="date"
                    value={st.eta ? st.eta.slice(0, 10) : ""}
                    onChange={(e) => void station(m.key, { eta: e.target.value || null })}
                    aria-label={`${m.label} expected date`}
                    title="When you expect this station to land. The client sees it."
                    className="w-[8.5rem]"
                  />
                )}
              </span>
            </div>

            {m.key === "animation" ? (
              <div className="mt-2 flex gap-2">
                <Input
                  value={draftUrl}
                  onChange={(e) => setDraftUrl(e.target.value)}
                  placeholder="New draft link, becomes the next version"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy !== null || !draftUrl.trim()}
                  onClick={async () => {
                    await onRun("draft", { action: "add_draft", url: draftUrl.trim() });
                    setDraftUrl("");
                  }}
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
                      onClick={() => void station(m.key, { url: urls[m.key] ?? "" })}
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
                  disabled={
                    busy !== null ||
                    (!st.url && m.key !== "delivery" && m.key !== "animation") ||
                    (m.key === "animation" && !p.mainVideo?.videoUrl)
                  }
                  onClick={() => void station(m.key, { state: "with_client" }, true)}
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
  );
}

/* the extra formats: title, link once done, one of four states */
function FormatList({ p, onReload }: { p: Project; onReload: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [links, setLinks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const call = async (method: "POST" | "PATCH", body: Record<string, unknown>) => {
    setBusy(true);
    await fetch("/api/admin/projects/videos", {
      method,
      headers: { ...(await authHeader()), "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: p.id, ...body }),
    });
    await onReload();
    setBusy(false);
  };

  return (
    <div className="grid gap-2">
      {p.formats.length === 0 ? (
        <p className="text-body-sm text-dim">
          None yet. Add them once the main video is approved and the client
          wants a reel or a short.
        </p>
      ) : (
        <ul className="grid gap-1.5">
          {p.formats.map((f) => (
            <li key={f.id} className="rounded-[8px] border border-hair bg-canvas p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 flex-1 text-body-sm font-semibold text-ink">{f.title}</span>
                <Select
                  value={f.status}
                  onChange={(e) => void call("PATCH", { id: f.id, status: e.target.value })}
                  aria-label={`State for ${f.title}`}
                >
                  {Object.entries(FORMAT_WORD).map(([k, w]) => (
                    <option key={k} value={k}>
                      {w}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  value={links[f.id] ?? f.videoUrl ?? ""}
                  onChange={(e) => setLinks({ ...links, [f.id]: e.target.value })}
                  placeholder="Video link, added once it is ready for review"
                />
                {(links[f.id] ?? "") !== (f.videoUrl ?? "") && links[f.id] !== undefined && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void call("PATCH", { id: f.id, videoUrl: links[f.id] ?? "" })}
                  >
                    Save
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Vertical reel, 30 seconds"
          aria-label="New format title"
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={busy || !title.trim()}
          onClick={async () => {
            await call("POST", { title: title.trim() });
            setTitle("");
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}
