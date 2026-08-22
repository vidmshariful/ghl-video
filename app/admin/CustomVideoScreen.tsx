"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, Inbox, Plus, X } from "lucide-react";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Tabs,
  Textarea,
} from "@/components/portal/ui";
import { authHeader, money, when } from "./client";
import { initialsOf } from "@/components/portal/board";
import { pages } from "@/lib/site";
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

export function CustomVideoScreen({
  openProjectId = null,
  onOpenProject,
}: {
  openProjectId?: string | null;
  onOpenProject?: (id: string | null) => void;
}) {
  const [tab, setTab] = useState<"projects" | "enquiries">("projects");
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [enquiries, setEnquiries] = useState<Enquiry[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [team, setTeam] = useState<{ email: string; name: string }[]>([]);
  const [draft, setDraft] = useState<typeof EMPTY_DRAFT | null>(null);
  const [open, setOpenState] = useState<string | null>(openProjectId);
  useEffect(() => setOpenState(openProjectId), [openProjectId]);
  const setOpen = (id: string | null) => {
    setOpenState(id);
    onOpenProject?.(id);
  };
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

      <Modal open={!!draft} onClose={() => setDraft(null)} title="New project">
        {draft && (
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
            <div className="flex justify-end gap-2 border-t border-hair pt-4">
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button variant="brand" disabled={busy} onClick={save}>
                {busy ? "Saving..." : "Create"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

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
  const [tab, setTab] = useState<"manage" | "review">("manage");
  const [busy, setBusy] = useState<string | null>(null);
  const [pageErr, setPageErr] = useState("");
  const [confirming, setConfirming] = useState<ProjectStatus | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [openNotes, setOpenNotes] = useState(0);
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

  const invoice = p.invoices[0] ?? null;
  const paidState = p.money.paidCents >= p.money.valueCents && p.money.valueCents > 0
    ? { word: "paid", tone: "good" as const }
    : p.money.paidCents > 0
      ? { word: "part paid", tone: "warn" as const }
      : p.money.valueCents > 0
        ? { word: "unpaid", tone: "bad" as const }
        : { word: "no price yet", tone: "neutral" as const };

  return (
    <div className="w-full">
      <Button variant="ghost" size="sm" icon={<ArrowLeft />} onClick={onBack}>
        All custom video
      </Button>

      {/* ---- section 1: the header, everything about this job ---- */}
      <div className="mt-4 rounded-[12px] border border-hair bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-h3 text-ink">{p.title}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-muted">
              <span className="text-ink">{p.customerEmail}</span>
              {p.category && <span className="text-dim">/ {p.category}</span>}
              <span className="font-mono text-label uppercase text-dim">
                opened {when(p.createdAt)}
              </span>
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {!isOpen(p.status) ? (
              <Button size="sm" variant="secondary" onClick={() => void run("reopen", { status: "backlog" })}>
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

        {/* every fact about the job, in the order it gets asked for */}
        <dl className="mt-4 grid gap-x-6 gap-y-3 border-t border-hair pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Status">
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${STATUS_DOT[p.status] ?? "bg-hair"}`} />
              <span className="text-ink">{STUDIO_LABEL[p.status]}</span>
            </span>
            <Headline p={p} />
          </Fact>

          <Fact label="Due">
            <Input
              type="date"
              value={p.dueAt ? p.dueAt.slice(0, 10) : ""}
              onChange={(e) =>
                void run("due", {
                  dueAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                })
              }
              aria-label="Deadline"
            />
          </Fact>

          <Fact label="Producer">
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
          </Fact>

          <Fact label="Category">
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
          </Fact>

          <Fact label="Agreed">
            <span className="font-display text-h4 tabular-nums text-gold">
              {money(p.money.valueCents)}
            </span>
          </Fact>

          <Fact label="Payment">
            <span className="flex flex-wrap items-center gap-2">
              <Chip tone={paidState.tone}>{paidState.word}</Chip>
              {p.money.outstandingCents > 0 && (
                <span className="font-mono text-label uppercase text-dim">
                  {money(p.money.outstandingCents)} owed
                </span>
              )}
            </span>
          </Fact>

          <Fact label="Invoice">
            {invoice ? (
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-ink">{invoice.number}</span>
                <Chip tone={invoice.paid ? "good" : "warn"}>{invoice.paid ? "paid" : "open"}</Chip>
                {p.invoices.length > 1 && (
                  <span className="font-mono text-label uppercase text-dim">
                    +{p.invoices.length - 1} more
                  </span>
                )}
              </span>
            ) : (
              <span className="text-body-sm text-dim">None raised yet</span>
            )}
          </Fact>

          <Fact label="Tags">
            <span className="flex flex-wrap items-center gap-1.5">
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
              <Input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                placeholder="Add"
                aria-label="New tag"
                className="w-20"
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const t = tagDraft.trim().toLowerCase();
                  setTagDraft("");
                  if (t && !p.tags.includes(t)) void run("tags", { tags: [...p.tags, t] });
                }}
              />
            </span>
          </Fact>
        </dl>
      </div>

      {pageErr && <p className="mt-3 text-body-sm text-error">{pageErr}</p>}

      {/* ---- two tabs, and only two ---- */}
      <div className="mt-4">
        <Tabs
          tabs={[
            { key: "manage" as const, label: "Manage the project" },
            { key: "review" as const, label: "Review room", count: openNotes || undefined },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === "manage" ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
          {/* column one: the work */}
          <div className="grid min-w-0 gap-3">
            <Card
              title="Production line"
              description="Six stations. One move each, everything rarer behind Edit."
            >
              <StationList p={p} busy={busy} onRun={run} />
            </Card>

            <Card
              title="Extra formats"
              description="Cut after the main video is approved: reels, shorts, square crops."
            >
              <FormatList p={p} onReload={onReload} />
            </Card>
          </div>

          {/* column two: the record */}
          <div className="grid min-w-0 gap-3">
            <FilesCard p={p} />
            <ActivityCard p={p} />
            <ProjectThread projectId={p.id} />
            {p.brief && (
              <Card title="The brief">
                <p className="whitespace-pre-wrap text-body-sm text-muted">{p.brief}</p>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <ReviewRoom projectId={p.id} title={p.title} onCount={setOpenNotes} />
        </div>
      )}
    </div>
  );
}

/* one labelled fact in the header grid */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-label uppercase tracking-[0.08em] text-dim">{label}</dt>
      <dd className="mt-1 text-body-sm text-muted">{children}</dd>
    </div>
  );
}

/* what the whole job is waiting for, in one line */
function Headline({ p }: { p: Project }) {
  const withClient = STATION_META.filter((m) => p.pipeline[m.key]?.state === "with_client");
  if (withClient.length > 0) {
    const at = withClient.map((m) => p.pipeline[m.key]?.at).filter(Boolean).sort()[0];
    return (
      <span className="font-mono text-label uppercase text-gold">
        waiting on the client{at ? ` since ${when(String(at))}` : ""}
      </span>
    );
  }
  const next = STATION_META.find((m) => p.pipeline[m.key]?.state !== "done");
  if (!next) return <span className="font-mono text-label uppercase text-green">all stations done</span>;
  const st = p.pipeline[next.key];
  return (
    <span className="font-mono text-label uppercase text-dim">
      {st?.state === "with_us" ? `in hand: ${next.label}` : `next: ${next.label}`}
    </span>
  );
}

/*
 * The six stations, each with exactly one action: Start it, send it for
 * approval, or mark it done. Everything rarer, whose file it is, whether
 * it gates, the expected date, a correction, lives behind the small Edit
 * on each row. Tanvir moves stations; the stage and the client's screen
 * follow on their own.
 */
function StationList({
  p,
  busy,
  onRun,
}: {
  p: Project;
  busy: string | null;
  onRun: (tag: string, body: Record<string, unknown>) => Promise<void>;
}) {
  const [draftUrl, setDraftUrl] = useState("");
  const [settingsFor, setSettingsFor] = useState<(typeof STATION_META)[number] | null>(null);
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
        const waitingOnFile = Boolean(st.provided) && st.state !== "done" && !st.url;
        const hasFile = m.key === "animation" ? Boolean(st.url || p.mainVideo?.videoUrl) : Boolean(st.url);

        /* the one thing to do next at this station, if anything */
        let action: { label: string; run: () => void; primary?: boolean } | null = null;
        if (st.state === "todo" && !waitingOnFile) {
          action = { label: "Start", run: () => void station(m.key, { state: "with_us" }) };
        } else if (st.state === "with_us") {
          if (gated && (hasFile || m.key === "delivery")) {
            action = {
              label: "Send for approval",
              primary: true,
              run: () => void station(m.key, { state: "with_client" }, true),
            };
          } else if (!gated) {
            action = { label: "Mark done", run: () => void station(m.key, { state: "done" }) };
          }
        }

        return (
          <div key={m.key} className="rounded-[8px] border border-hair bg-canvas px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${STATION_DOT[st.state]}`} />
                <span className="text-body-sm font-semibold text-ink">{m.label}</span>
                <span className="font-mono text-label uppercase text-dim">
                  {STATION_STATE_WORD[st.state]}
                </span>
                {st.provided && (
                  <Chip tone={st.url || st.state === "done" ? "neutral" : "warn"}>
                    {st.url || st.state === "done" ? "client provided" : "waiting on their file"}
                  </Chip>
                )}
                {gated && st.state === "with_us" && !hasFile && m.key !== "delivery" && (
                  <span className="font-mono text-label uppercase text-dim">needs its link</span>
                )}
                {st.eta && st.state !== "done" && (
                  <span className="font-mono text-label uppercase text-dim">
                    expected {day(st.eta)}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {st.url && (
                  <a
                    href={st.url}
                    target="_blank"
                    rel="noreferrer"
                    className="tap font-mono text-label uppercase text-muted transition-colors hover:text-gold"
                  >
                    Open it
                  </a>
                )}
                {action && (
                  <Button
                    size="sm"
                    variant={action.primary ? "primary" : "secondary"}
                    disabled={busy !== null}
                    onClick={action.run}
                  >
                    {action.label}
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => setSettingsFor(m)}
                  className="tap font-mono text-label uppercase text-dim transition-colors hover:text-gold"
                >
                  Edit
                </button>
              </span>
            </div>

            {/* drafts are the daily motion of animation, so its input stays
                on the row */}
            {m.key === "animation" && st.state !== "done" && (
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
            )}

            {st.state === "with_client" && (
              <p className="mt-1.5 font-mono text-label uppercase text-gold">
                with the client{st.at ? ` since ${when(st.at)}` : ""}
              </p>
            )}
          </div>
        );
      })}

      <StationSettings
        m={settingsFor}
        st={settingsFor ? (line[settingsFor.key] ?? { state: "todo" }) : null}
        busy={busy}
        onClose={() => setSettingsFor(null)}
        onSave={(patch) => {
          if (settingsFor) void station(settingsFor.key, patch);
        }}
      />
    </div>
  );
}

/* the rare knobs, out of the way until asked for */
function StationSettings({
  m,
  st,
  busy,
  onClose,
  onSave,
}: {
  m: (typeof STATION_META)[number] | null;
  st: Station | null;
  busy: string | null;
  onClose: () => void;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(st?.url ?? ""), [st?.url, m?.key]);
  if (!m || !st) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;
  return (
    <Modal open onClose={onClose} title={`${m.label} settings`}>
      <div className="grid gap-4">
        <Field
          label={st.provided ? `Link to their ${m.label.toLowerCase()}` : `Link to the ${m.label.toLowerCase()}`}
          hint="The file or page this station is about. The client can open it."
        >
          <div className="flex gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={m.key === "design" ? "Figma link" : "https://..."}
            />
            {url !== (st.url ?? "") && (
              <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => onSave({ url })}>
                Save
              </Button>
            )}
          </div>
        </Field>

        <div className="flex flex-wrap gap-4">
          {m.providable && (
            <label className="flex items-center gap-2 text-body-sm text-muted">
              <input
                type="checkbox"
                checked={Boolean(st.provided)}
                onChange={(e) => onSave({ provided: e.target.checked })}
                className="h-4 w-4 accent-[var(--gold)]"
              />
              The client provides this
            </label>
          )}
          {m.gateable && (
            <label className="flex items-center gap-2 text-body-sm text-muted">
              <input
                type="checkbox"
                checked={Boolean(st.gate)}
                onChange={(e) => onSave({ gate: e.target.checked })}
                className="h-4 w-4 accent-[var(--gold)]"
              />
              Needs their approval
            </label>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Expected date" hint="The client sees this on their line.">
            <Input
              type="date"
              value={st.eta ? st.eta.slice(0, 10) : ""}
              onChange={(e) => onSave({ eta: e.target.value || null })}
            />
          </Field>
          <Field label="Correct the state" hint="For fixing a slip, not for daily moves.">
            <Select
              value={st.state}
              onChange={(e) => onSave({ state: e.target.value })}
              aria-label={`${m.label} state`}
            >
              {(Object.keys(STATION_STATE_WORD) as Station["state"][]).map((k) => (
                <option key={k} value={k}>
                  {STATION_STATE_WORD[k]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/* the extra formats: title, link once done, one of four states *//* the extra formats: title, link once done, one of four states */
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

/*
 * The conversation the client sees too: one thread per project, shared
 * with their project page and the review screen. Not to be confused with
 * team notes below it, which the client never reads.
 */
function ProjectThread({ projectId }: { projectId: string }) {
  const [notes, setNotes] = useState<
    { id: string; side: string; name: string; body: string; stamp: string | null; at: string }[] | null
  >(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/projects/talk?projectId=${projectId}`, {
        headers: await authHeader(),
      });
      const j = await r.json();
      setNotes(r.ok ? (j.notes ?? []) : []);
    } catch {
      setNotes([]);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send() {
    if (!draft.trim()) return;
    setBusy(true);
    await fetch("/api/admin/projects/talk", {
      method: "POST",
      headers: { ...(await authHeader()), "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, body: draft.trim() }),
    });
    setDraft("");
    await load();
    setBusy(false);
  }

  return (
    <Card
      title="Messages"
      description="The one inbox this client has. Video feedback is not here: it lives in the review room, pinned to the second it is about."
    >
      {notes === null ? (
        <p className="text-body-sm text-muted">Loading...</p>
      ) : notes.length === 0 ? (
        <p className="text-body-sm text-dim">Nothing said yet.</p>
      ) : (
        <ol className="grid max-h-72 gap-2.5 overflow-y-auto pr-1">
          {notes.map((n) => (
            <li key={n.id} className={`border-l pl-3 ${n.side === "studio" ? "border-gold/50" : "border-blue/50"}`}>
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
          placeholder="Message this client"
          aria-label="Note to the client"
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

/* every link this job has, gathered. Nothing new is stored here. */
function FilesCard({ p }: { p: Project }) {
  const rows: { label: string; url: string | null; note?: string }[] = [
    ...STATION_META.filter((m) => m.key !== "sfx").map((m) => ({
      label: m.label,
      url: p.pipeline[m.key]?.url ?? null,
      note:
        p.pipeline[m.key]?.provided && !p.pipeline[m.key]?.url
          ? "the client owes this"
          : undefined,
    })),
    ...p.formats.map((f) => ({ label: f.title, url: f.videoUrl })),
  ];
  return (
    <Card title="Files" description="Every link on this job, in one place.">
      <ul className="grid gap-1.5">
        {rows.map((r) => (
          <li
            key={r.label}
            className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-hair bg-canvas px-3 py-2"
          >
            <span className="min-w-0 text-body-sm text-ink">{r.label}</span>
            {r.url ? (
              <span className="flex shrink-0 items-center gap-2">
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="tap font-mono text-label uppercase text-gold transition-colors hover:text-ink"
                >
                  Open it
                </a>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard?.writeText(r.url!)}
                  className="tap font-mono text-label uppercase text-dim transition-colors hover:text-ink"
                >
                  Copy
                </button>
              </span>
            ) : (
              <span className="shrink-0 font-mono text-label uppercase text-dim">
                {r.note ?? "not in yet"}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* what has happened, written by the work itself */
function ActivityCard({ p }: { p: Project }) {
  const events: { at: string; body: string }[] = [
    { at: p.createdAt, body: "Project booked in." },
  ];
  for (const m of STATION_META) {
    const st = p.pipeline[m.key];
    if (!st?.at) continue;
    if (st.state === "done") events.push({ at: st.at, body: `${m.label} finished.` });
    else if (st.state === "with_client")
      events.push({ at: st.at, body: `${m.label} sent to the client.` });
    else if (st.state === "with_us") events.push({ at: st.at, body: `${m.label} started.` });
  }
  events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return (
    <Card title="Activity" description="Written by the work, never typed.">
      <ol className="grid max-h-64 gap-2.5 overflow-y-auto pr-1">
        {events.map((e, i) => (
          <li key={`${e.at}-${i}`} className="border-l border-hair pl-3">
            <p className="text-body-sm text-muted">{e.body}</p>
            <p className="mt-0.5 font-mono text-label uppercase text-dim">{when(e.at)}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/* ---------------- the review room ---------------- */

type ReviewNote = {
  id: string;
  side: "client" | "studio";
  name: string;
  body: string;
  atSeconds: number | null;
  stamp: string | null;
  version: number | null;
  parentId: string | null;
  resolved: boolean;
  at: string;
};
type Cut = { id: string; version: number; videoUrl: string; createdAt: string };

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/*
 * Watch what the client watched, read their notes pinned to the second
 * they mean, answer them, and mark them done.
 *
 * This is the piece custom projects never had: their feedback used to
 * arrive as a line of text with no video attached to it. A note belongs to
 * the cut it was written on, so v1's notes stay with v1 when v2 lands.
 */
function ReviewRoom({
  projectId,
  title,
  onCount,
}: {
  projectId: string;
  title: string;
  onCount?: (n: number) => void;
}) {
  const [notes, setNotes] = useState<ReviewNote[] | null>(null);
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [watching, setWatching] = useState<Cut | null>(null);
  const [text, setText] = useState("");
  const [pin, setPin] = useState(true);
  const [at, setAt] = useState(0);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [duration, setDuration] = useState(0);
  const video = useRef<HTMLVideoElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/projects/notes?projectId=${projectId}`, {
        headers: await authHeader(),
      });
      const j = await r.json();
      if (!r.ok) return setErr(j.error ?? "Could not load the review.");
      const list = (j.notes ?? []) as ReviewNote[];
      const vs = (j.versions ?? []) as Cut[];
      setNotes(list);
      setCuts(vs);
      setWatching((w) => (w && vs.some((v) => v.id === w.id) ? w : (vs[0] ?? null)));
      onCount?.(list.filter((n) => n.side === "client" && !n.resolved && !n.parentId).length);
    } catch {
      setErr("Could not load the review.");
    }
  }, [projectId, onCount]);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/projects/notes", {
        method: "POST",
        headers: { ...(await authHeader()), "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ...body }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setErr((j as { error?: string }).error ?? "That did not go through.");
      else await load();
    } finally {
      setBusy(false);
    }
  }

  function seek(seconds: number) {
    const el = video.current;
    if (!el) return;
    el.currentTime = seconds;
    void el.play().catch(() => {});
  }

  if (notes === null && !err) return <p className="text-body-sm text-muted">Loading the review...</p>;

  const top = (notes ?? []).filter((n) => !n.parentId);
  const repliesOf = (id: string) => (notes ?? []).filter((n) => n.parentId === id);
  const currentVersion = watching?.version ?? null;
  const onThisCut = top.filter(
    (n) => currentVersion == null || (n.version ?? currentVersion) === currentVersion,
  );
  const earlier = top.filter(
    (n) => currentVersion != null && (n.version ?? currentVersion) !== currentVersion,
  );
  const openCount = top.filter((n) => n.side === "client" && !n.resolved).length;

  const marks = onThisCut
    .filter((n) => n.atSeconds != null)
    .map((n) => ({ id: n.id, at: n.atSeconds as number, resolved: n.resolved, side: n.side }));

  const noteCard = (n: ReviewNote) => (
    <li
      key={n.id}
      className={`rounded-[8px] border p-3 ${
        n.side === "client" ? "border-gold/30 bg-gold/5" : "border-hair bg-surface"
      } ${n.resolved ? "opacity-60" : ""}`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-body-sm font-semibold text-ink">{n.name}</span>
        {n.stamp && (
          <button
            type="button"
            onClick={() => seek(n.atSeconds ?? 0)}
            className="tap rounded-full border border-gold/40 px-2 py-0.5 font-mono text-label text-gold transition-colors hover:bg-gold/10"
          >
            {n.stamp}
          </button>
        )}
        {n.side === "client" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void post({ resolveId: n.id, resolved: !n.resolved })}
            className="tap ml-auto font-mono text-label uppercase text-dim transition-colors hover:text-green"
          >
            {n.resolved ? "Reopen" : "Mark done"}
          </button>
        )}
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-body-sm text-muted">{n.body}</p>
      <p className="mt-1 font-mono text-label uppercase text-dim">
        {when(n.at)}
        {n.version && cuts.length > 1 ? ` / on v${n.version}` : ""}
      </p>

      {repliesOf(n.id).map((r) => (
        <div key={r.id} className="mt-2 border-l-2 border-blue/40 pl-3">
          <span className="text-body-sm font-semibold text-ink">{r.name}</span>
          <p className="mt-0.5 whitespace-pre-wrap text-body-sm text-muted">{r.body}</p>
          <p className="mt-0.5 font-mono text-label uppercase text-dim">{when(r.at)}</p>
        </div>
      ))}

      {replyTo === n.id ? (
        <div className="mt-2 flex gap-2">
          <Input
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Answer this note"
            aria-label="Reply"
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || !replyText.trim()}
            onClick={async () => {
              await post({ body: replyText.trim(), parentId: n.id });
              setReplyText("");
              setReplyTo(null);
            }}
          >
            Send
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setReplyTo(n.id)}
          className="tap mt-1.5 font-mono text-label uppercase text-dim transition-colors hover:text-gold"
        >
          Reply
        </button>
      )}
    </li>
  );

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
      {/* the cut itself */}
      <div className="grid min-w-0 gap-3">
        <Card
          title={cuts.length ? `Watching v${watching?.version ?? ""}` : "No cut yet"}
          description={
            cuts.length
              ? "Press a timestamp on any note and the video jumps there."
              : "Paste a draft link on the Animation station and it appears here."
          }
          actions={
            cuts.length > 1 ? (
              <div className="flex flex-wrap gap-1.5">
                {cuts.map((c) => (
                  <Button
                    key={c.id}
                    size="sm"
                    variant={watching?.id === c.id ? "primary" : "secondary"}
                    onClick={() => setWatching(c)}
                  >
                    v{c.version}
                  </Button>
                ))}
              </div>
            ) : undefined
          }
        >
          {watching ? (
            <div className="grid gap-2">
              <video
                ref={video}
                src={watching.videoUrl}
                controls
                onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
                className="w-full rounded-[8px] bg-canvas"
              />
              {marks.length > 0 && duration > 0 && (
                <div className="relative h-2 rounded-full bg-hair">
                  {marks.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => seek(m.at)}
                      aria-label={`Jump to ${mmss(m.at)}`}
                      style={{ left: `${Math.min(99, (m.at / duration) * 100)}%` }}
                      className={`absolute -top-0.5 h-3 w-1 rounded-full ${
                        m.resolved ? "bg-hair" : m.side === "client" ? "bg-gold" : "bg-blue"
                      }`}
                    />
                  ))}
                </div>
              )}
              <p className="font-mono text-label uppercase text-dim">
                {cuts.length > 1 && watching.id !== cuts[0].id
                  ? `an older cut / sent ${when(watching.createdAt)}`
                  : `current cut / sent ${when(watching.createdAt)}`}
                {cuts.length > 1 && watching.id !== cuts[0].id && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (confirm(`Remove cut v${watching.version}? The client can no longer watch it.`))
                        void post({ removeVersionId: watching.id });
                    }}
                    className="tap ml-3 text-dim transition-colors hover:text-error"
                  >
                    remove this cut
                  </button>
                )}
              </p>
            </div>
          ) : (
            <p className="text-body-sm text-dim">
              Nothing to watch. Add a draft on the Manage tab and the client sees
              it the moment you send it for approval.
            </p>
          )}
        </Card>

        {watching && (
          <Card title="Write a note">
            <div className="grid gap-2">
              <Textarea
                rows={2}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What you want them to know, or what you fixed"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-body-sm text-muted">
                  <input
                    type="checkbox"
                    checked={pin}
                    onChange={(e) => setPin(e.target.checked)}
                    className="h-4 w-4 accent-[var(--gold)]"
                  />
                  Pin this to {mmss(at)}
                </label>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy || !text.trim()}
                  onClick={async () => {
                    await post({ body: text.trim(), atSeconds: pin ? Math.floor(at) : null });
                    setText("");
                  }}
                >
                  Add note
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* their notes */}
      <div className="grid min-w-0 gap-3">
        <Card
          title="Their feedback"
          description={
            openCount > 0
              ? `${openCount} ${openCount === 1 ? "note" : "notes"} still to answer.`
              : "Everything they asked for has been answered."
          }
        >
          {err && <p className="mb-2 text-body-sm text-error">{err}</p>}
          {onThisCut.length === 0 ? (
            <p className="text-body-sm text-dim">
              No notes on this cut. When {title} goes out for approval, whatever
              they say lands here pinned to the second they mean.
            </p>
          ) : (
            <ul className="grid gap-2">{onThisCut.map(noteCard)}</ul>
          )}
        </Card>

        {earlier.length > 0 && (
          <Card title="On earlier cuts" description="Kept, so a fixed note stops shouting.">
            <ul className="grid gap-2">{earlier.map(noteCard)}</ul>
          </Card>
        )}
      </div>
    </div>
  );
}
