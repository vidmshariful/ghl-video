"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Archive,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  File as FileIcon,
  FileText,
  Film,
  ImageIcon,
  Inbox,
  Music,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
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
  script: string | null;
  referenceUrl: string | null;
  source: string | null;
  status: ProjectStatus;
  /* the producer pinned this stage by hand, so the line stops moving it */
  stageLocked: boolean;
  category: string | null;
  tags: string[];
  pipeline: Pipeline;
  ball: "us" | "client" | null;
  quotedCents: number | null;
  agreedCents: number | null;
  ownerEmail: string | null;
  dueAt: string | null;
  contactId: string | null;
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
  script: "",
  reference: "",
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
        contacts={clients.find((c) => c.email === opened.customerEmail)?.contacts ?? []}
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
            {/* kept apart from the brief: this is the words that get
                recorded, and on a client-submitted job it is the thing the
                producer opens first */}
            <Field label="The script" hint="The words to be recorded. A client on a retainer sends this themselves.">
              <Textarea
                rows={6}
                value={draft.script}
                onChange={(e) => setDraft({ ...draft, script: e.target.value })}
              />
            </Field>
            <Field label="Reference" hint="A video they want this one to feel like.">
              <Input
                value={draft.reference}
                onChange={(e) => setDraft({ ...draft, reference: e.target.value })}
                placeholder="https://youtube.com/..."
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
  contacts,
  onBack,
  onPatch,
  onReload,
}: {
  p: Project;
  team: { email: string; name: string }[];
  contacts: { id: string; name: string; email: string | null; role: string; title: string | null }[];
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
  /* the edit-details popup, per the platform rule that adding or editing a
     thing opens as a popup rather than editing in place */
  const [editing, setEditing] = useState(false);
  const emptyForm = {
    title: p.title,
    contactId: p.contactId ?? "",
    brief: p.brief ?? "",
    script: p.script ?? "",
    reference: p.referenceUrl ?? "",
    /* dollars in the form, cents on the wire, same as the create modal */
    quoted: p.quotedCents != null ? String(p.quotedCents / 100) : "",
    agreed: p.agreedCents != null ? String(p.agreedCents / 100) : "",
  };
  const [form, setForm] = useState(emptyForm);
  const openEdit = () => {
    /* seed from the live project every open, so a reload never leaves the
       form showing yesterday's numbers */
    setForm({
      title: p.title,
      contactId: p.contactId ?? "",
      brief: p.brief ?? "",
    script: p.script ?? "",
    reference: p.referenceUrl ?? "",
      quoted: p.quotedCents != null ? String(p.quotedCents / 100) : "",
      agreed: p.agreedCents != null ? String(p.agreedCents / 100) : "",
    });
    setEditing(true);
  };
  const saveDetails = async () => {
    if (!form.title.trim()) {
      setPageErr("A project needs a name.");
      return;
    }
    setBusy("edit");
    setPageErr("");
    const e = await onPatch({
      title: form.title.trim(),
      contactId: form.contactId || null,
      brief: form.brief,
      script: form.script,
      reference: form.reference,
      quotedCents: form.quoted === "" ? null : Math.round(Number(form.quoted) * 100),
      agreedCents: form.agreed === "" ? null : Math.round(Number(form.agreed) * 100),
    });
    setBusy(null);
    if (e) setPageErr(e);
    else setEditing(false);
  };
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

      {/* edit the details that are not quick-edited in the header: the name,
          who we work with, the brief, and the money */}
      <Modal open={editing} onClose={() => setEditing(false)} title="Edit project details">
        <div className="grid gap-4">
          <Field label="Project name" required hint="What you would call it out loud.">
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Onboarding explainer, 90 sec"
            />
          </Field>
          <Field label="Who we work with" hint="The person at their end running this with us.">
            <Select
              value={form.contactId}
              onChange={(e) => setForm({ ...form, contactId: e.target.value })}
            >
              <option value="">
                {contacts.length ? "Nobody set" : "No contacts on this client yet"}
              </option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.title ? `, ${c.title}` : ""} ({c.role})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="The brief" hint="What they asked for, in their words if you have them.">
            <Textarea
              rows={4}
              value={form.brief}
              onChange={(e) => setForm({ ...form, brief: e.target.value })}
            />
          </Field>
          <Field label="The script" hint="The words to be recorded. A retainer client sends this themselves.">
            <Textarea
              rows={8}
              value={form.script}
              onChange={(e) => setForm({ ...form, script: e.target.value })}
            />
          </Field>
          <Field label="Reference" hint="A video they want this one to feel like.">
            <Input
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="https://youtube.com/..."
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Quoted" hint="Dollars. What you asked for. Empty for none.">
              <Input
                type="number"
                min={0}
                value={form.quoted}
                onChange={(e) => setForm({ ...form, quoted: e.target.value })}
                placeholder="2500"
              />
            </Field>
            <Field label="Agreed" hint="Dollars. What was settled on. Empty for none.">
              <Input
                type="number"
                min={0}
                value={form.agreed}
                onChange={(e) => setForm({ ...form, agreed: e.target.value })}
                placeholder="1995"
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-hair pt-4">
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button variant="brand" disabled={busy === "edit"} onClick={saveDetails}>
              {busy === "edit" ? "Saving..." : "Save details"}
            </Button>
          </div>
        </div>
      </Modal>

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
            <Button size="sm" variant="secondary" onClick={openEdit}>
              Edit details
            </Button>
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
            {isOpen(p.status) ? (
              <>
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[p.status] ?? "bg-hair"}`}
                  />
                  <Select
                    value={p.status}
                    disabled={busy === "stage"}
                    aria-label="Project stage"
                    onChange={(e) => void run("stage", { stage: e.target.value })}
                  >
                    {PROJECT_LIST.map((s) => (
                      <option key={s} value={s}>
                        {STUDIO_LABEL[s]}
                      </option>
                    ))}
                  </Select>
                </span>
                <span className="mt-1 block font-mono text-label uppercase text-dim">
                  {p.stageLocked ? (
                    <>
                      set by you /{" "}
                      <button
                        type="button"
                        disabled={busy === "unlock"}
                        onClick={() => void run("unlock", { stageLocked: false })}
                        className="tap text-blue underline underline-offset-2 disabled:opacity-50"
                      >
                        follow the line again
                      </button>
                    </>
                  ) : (
                    "follows the production line"
                  )}
                </span>
                <Headline p={p} />
              </>
            ) : (
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${STATUS_DOT[p.status] ?? "bg-hair"}`}
                />
                <span className="text-ink">{STUDIO_LABEL[p.status]}</span>
              </span>
            )}
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
              description="Six stations. Click any one to manage it: move it along, set its file, name the date."
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
            <ActivityCard p={p} />
            <ProjectThread projectId={p.id} />
            {p.brief && (
              <Card title="The brief">
                <p className="whitespace-pre-wrap text-body-sm text-muted">{p.brief}</p>
              </Card>
            )}
            <AdminAttachments projectId={p.id} />
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
 * The six stations. Each row is clean and says only where it stands and
 * where its file is; everything you do to a station, the move, the file, the
 * drafts, whose it is, whether it gates, the date, a correction, happens in
 * one popup you open by clicking the row (owner decision, 23 August 2026,
 * one place per station rather than buttons scattered across the row).
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
  const [managing, setManaging] = useState<(typeof STATION_META)[number] | null>(null);
  const line = p.pipeline;

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
        const fileUrl =
          m.key === "animation" ? st.url ?? p.mainVideo?.videoUrl ?? null : st.url ?? null;

        return (
          <div key={m.key} className="overflow-hidden rounded-[8px] border border-hair bg-canvas">
            <button
              type="button"
              onClick={() => setManaging(m)}
              className="tap flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-surface"
            >
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
                {gated && <Chip tone="neutral">approval gate</Chip>}
                {st.eta && st.state !== "done" && (
                  <span className="font-mono text-label uppercase text-dim">
                    expected {day(st.eta)}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-3 font-mono text-label uppercase">
                {st.state === "with_client" && (
                  <span className="text-gold">with client{st.at ? ` since ${when(st.at)}` : ""}</span>
                )}
                <span className="text-muted">Manage</span>
              </span>
            </button>

            {/* the file lives with its station, so there is no second list of
                links to keep in sync */}
            {fileUrl && (
              <div className="flex items-center gap-3 border-t border-hair px-3 py-1.5">
                <span className="min-w-0 flex-1 truncate font-mono text-label text-dim">{fileUrl}</span>
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="tap font-mono text-label uppercase text-muted transition-colors hover:text-gold"
                >
                  Open
                </a>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard?.writeText(fileUrl)}
                  className="tap font-mono text-label uppercase text-dim transition-colors hover:text-ink"
                >
                  Copy
                </button>
              </div>
            )}
          </div>
        );
      })}

      <StationModal
        m={managing}
        st={managing ? (line[managing.key] ?? { state: "todo" }) : null}
        mainVideoUrl={p.mainVideo?.videoUrl ?? null}
        busy={busy}
        onClose={() => setManaging(null)}
        onRun={onRun}
      />
    </div>
  );
}

/* one station, managed end to end in a single popup */
function StationModal({
  m,
  st,
  mainVideoUrl,
  busy,
  onClose,
  onRun,
}: {
  m: (typeof STATION_META)[number] | null;
  st: Station | null;
  mainVideoUrl: string | null;
  busy: string | null;
  onClose: () => void;
  onRun: (tag: string, body: Record<string, unknown>) => Promise<void>;
}) {
  const [url, setUrl] = useState("");
  const [draft, setDraft] = useState("");
  useEffect(() => {
    setUrl(st?.url ?? "");
    setDraft("");
  }, [st?.url, m?.key]);
  if (!m || !st) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;

  const station = (patch: Record<string, unknown>, requestApproval?: boolean) =>
    void onRun(`st-${m.key}`, { station: { key: m.key, ...patch, requestApproval } });

  const gated = Boolean(st.gate) && !st.provided;
  const hasFile = m.key === "animation" ? Boolean(st.url || mainVideoUrl) : Boolean(st.url);
  const busyNow = busy !== null;

  /* the one move that makes sense next, if any */
  let primary: { label: string; run: () => void } | null = null;
  if (st.state === "todo") {
    primary = { label: "Start this station", run: () => station({ state: "with_us" }) };
  } else if (st.state === "with_us") {
    if (gated && (hasFile || m.key === "delivery")) {
      primary = {
        label: "Send to the client for approval",
        run: () => station({ state: "with_client" }, true),
      };
    } else if (!gated) {
      primary = { label: "Mark it done", run: () => station({ state: "done" }) };
    }
  } else if (st.state === "with_client") {
    primary = { label: "Bring it back to us", run: () => station({ state: "with_us" }) };
  }

  return (
    <Modal open onClose={onClose} title={m.label}>
      <div className="grid gap-4">
        {/* where it stands, and the move */}
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={st.state === "with_client" ? "warn" : st.state === "done" ? "good" : "neutral"}>
            {STATION_STATE_WORD[st.state]}
          </Chip>
          {primary && (
            <Button variant="brand" disabled={busyNow} onClick={primary.run}>
              {primary.label}
            </Button>
          )}
        </div>
        {gated && st.state === "with_us" && !hasFile && m.key !== "delivery" && (
          <p className="text-body-sm text-gold">
            Add the link below first, then you can send it for their approval.
          </p>
        )}

        {/* the file */}
        <Field
          label={st.provided ? `Link to their ${m.label.toLowerCase()}` : `The file or link`}
          hint="What this station is about. The client can open it."
        >
          <div className="flex flex-wrap gap-2">
            <div className="min-w-[14rem] flex-1">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={m.key === "design" ? "Figma or Drive link" : "https://..."}
              />
            </div>
            {url.trim() !== (st.url ?? "") && (
              <Button variant="secondary" disabled={busyNow} onClick={() => station({ url: url.trim() || null })}>
                Save link
              </Button>
            )}
            {st.url && (
              <>
                <Button variant="ghost" href={st.url} target="_blank">
                  Open
                </Button>
                <Button variant="ghost" onClick={() => void navigator.clipboard?.writeText(st.url!)}>
                  Copy
                </Button>
              </>
            )}
          </div>
        </Field>

        {/* animation drafts are versioned, so each link the client reviews is
            kept, not overwritten */}
        {m.key === "animation" && (
          <Field label="Add a draft" hint="Each link becomes the next version the client reviews.">
            <div className="flex flex-wrap gap-2">
              <div className="min-w-[14rem] flex-1">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="New draft link"
                />
              </div>
              <Button
                variant="secondary"
                disabled={busyNow || !draft.trim()}
                onClick={async () => {
                  await onRun("draft", { action: "add_draft", url: draft.trim() });
                  setDraft("");
                }}
              >
                Add draft
              </Button>
            </div>
          </Field>
        )}

        {/* who it is and whether it stops for them */}
        {(m.providable || m.gateable) && (
          <div className="flex flex-wrap gap-4 border-t border-hair pt-4">
            {m.providable && (
              <label className="flex items-center gap-2 text-body-sm text-muted">
                <input
                  type="checkbox"
                  checked={Boolean(st.provided)}
                  onChange={(e) => station({ provided: e.target.checked })}
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
                  onChange={(e) => station({ gate: e.target.checked })}
                  className="h-4 w-4 accent-[var(--gold)]"
                />
                Needs their approval
              </label>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Expected date" hint="The client sees this on their line.">
            <Input
              type="date"
              value={st.eta ? st.eta.slice(0, 10) : ""}
              onChange={(e) => station({ eta: e.target.value || null })}
            />
          </Field>
          <Field label="Correct the state" hint="For fixing a slip, not for daily moves.">
            <Select
              value={st.state}
              onChange={(e) => station({ state: e.target.value })}
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

/* ---------------- attachments ---------------- */

type AdminFile = {
  id: string;
  name: string;
  sizeBytes: number;
  kind: "image" | "video" | "audio" | "pdf" | "doc" | "archive" | "file";
  uploadedBy: "client" | "studio";
  uploaderName: string | null;
  at: string;
  url: string | null;
};

const FILE_ICON: Record<AdminFile["kind"], typeof FileIcon> = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  pdf: FileText,
  doc: FileText,
  archive: Archive,
  file: FileIcon,
};

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/*
 * The studio's view of a project's attachments: the same list the client sees,
 * so a file either side adds shows on both. We drop a reference in for them, or
 * clear out what we no longer need. Nothing over 10 MB.
 */
function AdminAttachments({ projectId }: { projectId: string }) {
  const [files, setFiles] = useState<AdminFile[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/projects/files?projectId=${projectId}`, {
        headers: await authHeader(),
      });
      const j = await r.json();
      if (r.ok) setFiles((j.files ?? []) as AdminFile[]);
      else setErr(j.error ?? "Could not load the files.");
    } catch {
      setErr("Could not load the files.");
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(list: FileList | null) {
    if (!list || !list.length) return;
    setErr("");
    setBusy(true);
    for (const file of Array.from(list)) {
      if (file.size > 10 * 1024 * 1024) {
        setErr(`${file.name} is over 10 MB.`);
        continue;
      }
      const fd = new FormData();
      fd.append("projectId", projectId);
      fd.append("file", file);
      const r = await fetch("/api/admin/projects/files", {
        method: "POST",
        headers: await authHeader(),
        body: fd,
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErr((j as { error?: string }).error ?? "That upload did not go through.");
      }
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    await load();
  }

  async function remove(id: string) {
    setBusy(true);
    await fetch(`/api/admin/projects/files?projectId=${projectId}&fileId=${id}`, {
      method: "DELETE",
      headers: await authHeader(),
    }).catch(() => null);
    setBusy(false);
    setConfirmId(null);
    await load();
  }

  return (
    <Card
      title="Attachments"
      description="Files shared with the client. What they send lands here; drop a reference in for them."
      actions={
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <span className="inline-flex items-center gap-1.5">
            <Upload size={13} aria-hidden="true" /> Add file
          </span>
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
          className="tap flex w-full flex-col items-center gap-2 rounded-[8px] border border-dashed border-hair px-3 py-6 text-center transition-colors hover:border-gold/50"
        >
          <Paperclip size={18} className="text-dim" aria-hidden="true" />
          <span className="text-body-sm text-dim">
            No files yet. Add one, or ask the client for what you need.
          </span>
        </button>
      ) : (
        <ul className="grid gap-2">
          {files.map((f) => {
            const Icon = FILE_ICON[f.kind];
            return (
              <li
                key={f.id}
                className="flex items-center gap-3 rounded-[8px] border border-hair bg-surface p-2"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[6px] border border-hair bg-canvas">
                  {f.kind === "image" && f.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Icon size={16} className="text-muted" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm font-semibold text-ink" title={f.name}>
                    {f.name}
                  </p>
                  <p className="font-mono text-label uppercase tracking-[0.08em] text-dim">
                    {fileSize(f.sizeBytes)} /{" "}
                    {f.uploadedBy === "studio"
                      ? `from ${f.uploaderName ?? "us"}`
                      : "from the client"}
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
                      <Trash2 size={13} aria-hidden="true" />
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

/* ---------------- the review room ---------------- */

type ReviewNote = {
  id: string;
  side: "client" | "studio";
  name: string;
  body: string;
  atSeconds: number | null;
  stamp: string | null;
  /* the production-line stage this note is about */
  stage: string | null;
  version: number | null;
  parentId: string | null;
  resolved: boolean;
  at: string;
};
type StageInfo = {
  key: string;
  label: string;
  medium: "doc" | "audio" | "pdf" | "video" | null;
  url: string | null;
  state: "todo" | "with_us" | "with_client" | "done";
  gate: boolean;
  provided: boolean;
  open: number;
};

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/* a Google Doc share link embeds read-only through /preview */
const reviewDocEmbed = (url: string) => url.replace(/\/(edit|view)(\?[^#]*)?(#.*)?$/, "/preview");

/*
 * Watch what the client watched, read their notes pinned to the second
 * they mean, answer them, and mark them done.
 *
 * This is the piece custom projects never had: their feedback used to
 * arrive as a line of text with no video attached to it. A note belongs to
 * the cut it was written on, so v1's notes stay with v1 when v2 lands.
 */
/* how a stage's file reads, so the room can label what it is showing */
const MEDIUM_WORD: Record<string, string> = {
  doc: "Script document",
  audio: "Voiceover audio",
  pdf: "Concept PDF",
  video: "Video",
};

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
  const [stages, setStages] = useState<StageInfo[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [pin, setPin] = useState(true);
  const [at, setAt] = useState(0);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [duration, setDuration] = useState(0);
  const media = useRef<HTMLVideoElement & HTMLAudioElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/projects/notes?projectId=${projectId}`, {
        headers: await authHeader(),
      });
      const j = await r.json();
      if (!r.ok) return setErr(j.error ?? "Could not load the review.");
      const list = (j.notes ?? []) as ReviewNote[];
      const sts = (j.stages ?? []) as StageInfo[];
      setNotes(list);
      setStages(sts);
      /* open the file they are waiting on: first with unanswered notes, else
         the first that has something to show, else the first stage */
      setActive((cur) =>
        cur && sts.some((s) => s.key === cur)
          ? cur
          : ((sts.find((s) => s.open > 0) ?? sts.find((s) => s.url) ?? sts[0])?.key ?? null),
      );
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
    const el = media.current;
    if (!el) return;
    el.currentTime = seconds;
    void el.play?.().catch(() => {});
  }

  if (notes === null && !err) return <p className="text-body-sm text-muted">Loading the review...</p>;

  const stage = stages.find((s) => s.key === active) ?? null;
  const timed = stage?.medium === "audio" || stage?.medium === "video";
  const forStage = (notes ?? []).filter((n) => n.stage === active);
  const top = forStage.filter((n) => !n.parentId);
  const repliesOf = (id: string) => (notes ?? []).filter((n) => n.parentId === id);
  const openCount = top.filter((n) => n.side === "client" && !n.resolved).length;

  const marks = timed
    ? top
        .filter((n) => n.atSeconds != null)
        .map((n) => ({ id: n.id, at: n.atSeconds as number, resolved: n.resolved, side: n.side }))
    : [];

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
      <p className="mt-1 font-mono text-label uppercase text-dim">{when(n.at)}</p>

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

  const viewer = () => {
    if (!stage) return null;
    if (!stage.url)
      return (
        <p className="text-body-sm text-dim">
          Nothing on this file yet. It appears here the moment you send it to the client.
        </p>
      );
    if (stage.medium === "video")
      return (
        <video
          ref={media}
          key={stage.key}
          src={stage.url}
          controls
          preload="metadata"
          onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          className="max-h-[60vh] w-full rounded-[8px] bg-canvas"
        />
      );
    if (stage.medium === "audio")
      return (
        <audio
          ref={media}
          key={stage.key}
          src={stage.url}
          controls
          preload="metadata"
          onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          className="w-full"
        />
      );
    if (stage.medium === "pdf")
      return (
        <div className="overflow-hidden rounded-[8px] border border-hair bg-canvas">
          <iframe src={stage.url} title={stage.label} className="h-[58vh] w-full border-0" />
        </div>
      );
    /* doc */
    return (
      <div className="overflow-hidden rounded-[8px] border border-hair bg-white">
        <iframe src={reviewDocEmbed(stage.url)} title={stage.label} className="h-[58vh] w-full border-0" />
      </div>
    );
  };

  const stateWord = (s: StageInfo) =>
    s.provided
      ? "Given by the client"
      : s.state === "with_client"
        ? "With the client now"
        : s.state === "done"
          ? s.gate
            ? "Approved"
            : "Done"
          : s.state === "with_us"
            ? "With us"
            : "Not started";

  return (
    <div className="grid gap-3">
      {/* one chip per file the client can speak to */}
      <div className="flex flex-wrap gap-1.5">
        {stages.map((s) => {
          const on = s.key === active;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setActive(s.key)}
              className={`tap flex items-center gap-2 rounded-[8px] border px-3 py-1.5 text-body-sm transition-colors ${
                on
                  ? "border-gold/60 bg-gold/10 text-ink"
                  : "border-hair bg-surface text-muted hover:border-gold/40 hover:text-ink"
              }`}
            >
              {s.label}
              {s.open > 0 && (
                <span className="rounded-full bg-gold px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none text-canvas">
                  {s.open}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {stage && (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
          {/* the file itself */}
          <div className="grid min-w-0 gap-3">
            <Card
              title={stage.label}
              description={`${stage.medium ? MEDIUM_WORD[stage.medium] : "File"} / ${stateWord(stage)}`}
              actions={
                stage.url ? (
                  <a
                    href={stage.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tap rounded-[8px] border border-hair px-3 py-1.5 font-mono text-label uppercase text-muted transition-colors hover:border-blue/60 hover:text-blue"
                  >
                    Open
                  </a>
                ) : undefined
              }
            >
              <div className="grid gap-2">
                {viewer()}
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
              </div>
            </Card>

            {stage.url && (
              <Card title="Write a note">
                <div className="grid gap-2">
                  <Textarea
                    rows={2}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="What you want them to know, or what you fixed"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {timed ? (
                      <label className="flex items-center gap-2 text-body-sm text-muted">
                        <input
                          type="checkbox"
                          checked={pin}
                          onChange={(e) => setPin(e.target.checked)}
                          className="h-4 w-4 accent-[var(--gold)]"
                        />
                        Pin this to {mmss(at)}
                      </label>
                    ) : (
                      <span />
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy || !text.trim()}
                      onClick={async () => {
                        await post({
                          body: text.trim(),
                          atSeconds: timed && pin ? Math.floor(at) : null,
                          stage: stage.key,
                        });
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

          {/* what they asked for on this file */}
          <div className="grid min-w-0 gap-3">
            <Card
              title="Their feedback"
              description={
                openCount > 0
                  ? `${openCount} ${openCount === 1 ? "note" : "notes"} still to answer.`
                  : "Nothing outstanding on this file."
              }
            >
              {err && <p className="mb-2 text-body-sm text-error">{err}</p>}
              {top.length === 0 ? (
                <p className="text-body-sm text-dim">
                  Nothing on {stage.label.toLowerCase()} yet. When {title} reaches the client,
                  whatever they say about this file lands here.
                </p>
              ) : (
                <ul className="grid gap-2">{top.map(noteCard)}</ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
