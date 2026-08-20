"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Inbox, Plus } from "lucide-react";
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
  videos: { id: string; title: string; status: string }[];
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

const EMPTY_DRAFT = {
  customerEmail: "",
  title: "",
  brief: "",
  quotedCents: "",
  agreedCents: "",
  dueAt: "",
  fromRequestId: "",
};

export function CustomVideoScreen() {
  const [tab, setTab] = useState<"jobs" | "enquiries">("jobs");
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [enquiries, setEnquiries] = useState<Enquiry[] | null>(null);
  const [draft, setDraft] = useState<typeof EMPTY_DRAFT | null>(null);
  const [open, setOpen] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setErr("");
    try {
      const h = await authHeader();
      const [p, r] = await Promise.all([
        fetch("/api/admin/projects", { headers: h }).then((x) => x.json()),
        fetch("/api/admin/project-requests", { headers: h }).then((x) => x.json()),
      ]);
      if (p.error || r.error) return setErr(p.error ?? r.error);
      setProjects(p.projects as Project[]);
      setEnquiries(r.requests as Enquiry[]);
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
      if (!r.ok) return setErr(j.error ?? "Could not create the job.");
      setDraft(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function move(p: Project, dir: 1 | -1) {
    const i = PROJECT_BOARD.indexOf(p.status);
    const next = PROJECT_BOARD[i + dir];
    if (!next) return;
    await fetch("/api/admin/projects", {
      method: "PATCH",
      headers: { ...(await authHeader()), "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, status: next }),
    });
    await load();
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
  const openEnquiries = enquiries.filter((e) => e.status !== "won" && e.status !== "lost");
  const pipelineCents = live.reduce((s, p) => s + p.money.valueCents, 0);
  const owedCents = live.reduce((s, p) => s + p.money.outstandingCents, 0);

  /* one job, opened */
  if (open) {
    const p = projects.find((x) => x.id === open.id) ?? open;
    return (
      <div className="w-full">
        <Button variant="ghost" size="sm" icon={<ArrowLeft />} onClick={() => setOpen(null)}>
          All custom video
        </Button>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-h2 text-ink">{p.title}</h1>
            <p className="mt-1 text-body text-muted">{p.customerEmail}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Chip tone={isOpen(p.status) ? "info" : "neutral"}>{STUDIO_LABEL[p.status]}</Chip>
              {p.dueAt && <Chip tone="warn">due {when(p.dueAt)}</Chip>}
              <span className="font-mono text-label uppercase text-dim">
                opened {when(p.createdAt)}
                {p.ownerEmail ? ` / ${p.ownerEmail}` : ""}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {(["delivered", "closed", "cancelled"] as ProjectStatus[]).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={s === "cancelled" ? "danger" : "secondary"}
                onClick={() => setStatus(p, s)}
              >
                {STUDIO_LABEL[s]}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <Card>
            <p className="font-mono text-label uppercase text-dim">Agreed</p>
            <p className="mt-2 font-display text-h2 tabular-nums text-gold">
              {money(p.money.valueCents)}
            </p>
            {p.agreedCents == null && p.quotedCents != null && (
              <p className="mt-1 text-body-sm text-muted">quoted, not yet agreed</p>
            )}
          </Card>
          <Card>
            <p className="font-mono text-label uppercase text-dim">Paid</p>
            <p className="mt-2 font-display text-h2 tabular-nums text-green">
              {money(p.money.paidCents)}
            </p>
          </Card>
          <Card>
            <p className="font-mono text-label uppercase text-dim">Still owed</p>
            <p
              className={`mt-2 font-display text-h2 tabular-nums ${p.money.outstandingCents ? "text-error" : "text-ink"}`}
            >
              {money(p.money.outstandingCents)}
            </p>
          </Card>
          <Card>
            <p className="font-mono text-label uppercase text-dim">Videos</p>
            <p className="mt-2 font-display text-h2 tabular-nums text-ink">{p.videos.length}</p>
          </Card>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
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
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Custom video"
        description="Bespoke work, and the enquiries that have not become work yet."
        actions={
          <Button variant="brand" icon={<Plus />} onClick={() => setDraft(EMPTY_DRAFT)}>
            New job
          </Button>
        }
      >
        <Tabs
          tabs={[
            { key: "jobs" as const, label: "Jobs", count: live.length },
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
          title="New job"
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
              <Field label="Client email" required hint="Who the work is for.">
                <Input
                  value={draft.customerEmail}
                  onChange={(e) => setDraft({ ...draft, customerEmail: e.target.value })}
                  placeholder="keith@speedmobi.com"
                />
              </Field>
              <Field label="Job name" required hint="What you would call it out loud.">
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

      {tab === "jobs" ? (
        <>
          <div className="mb-3 grid gap-3 sm:grid-cols-3">
            <Card>
              <p className="font-mono text-label uppercase text-dim">Live jobs</p>
              <p className="mt-2 font-display text-h2 tabular-nums text-ink">{live.length}</p>
            </Card>
            <Card>
              <p className="font-mono text-label uppercase text-dim">Agreed, in flight</p>
              <p className="mt-2 font-display text-h2 tabular-nums text-gold">
                {money(pipelineCents)}
              </p>
            </Card>
            <Card>
              <p className="font-mono text-label uppercase text-dim">Still owed</p>
              <p
                className={`mt-2 font-display text-h2 tabular-nums ${owedCents ? "text-error" : "text-ink"}`}
              >
                {money(owedCents)}
              </p>
            </Card>
          </div>

          {live.length === 0 ? (
            <EmptyState
              title="No custom jobs open"
              description="Most jobs start on a call or a referral. Create one and it appears on the board."
              action={
                <Button variant="brand" icon={<Plus />} onClick={() => setDraft(EMPTY_DRAFT)}>
                  New job
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {PROJECT_BOARD.map((col) => {
                const inCol = live.filter((p) => p.status === col);
                return (
                  <div key={col} className="rounded-[12px] border border-hair bg-sunken/40 p-3">
                    <div className="mb-2.5 flex items-baseline justify-between">
                      <h2 className="font-mono text-label uppercase text-dim">
                        {STUDIO_LABEL[col]}
                      </h2>
                      <span className="font-mono text-label tabular-nums text-dim">
                        {inCol.length}
                      </span>
                    </div>
                    <div className="grid gap-2">
                      {inCol.length === 0 && (
                        <p className="px-1 py-2 text-body-sm text-dim">Nothing here.</p>
                      )}
                      {inCol.map((p) => (
                        <div
                          key={p.id}
                          className="rounded-[8px] border border-hair bg-surface p-3"
                        >
                          <button
                            type="button"
                            onClick={() => setOpen(p)}
                            className="tap block w-full text-left"
                          >
                            <p className="text-body-sm font-semibold text-ink">{p.title}</p>
                            <p className="mt-0.5 truncate font-mono text-label uppercase text-dim">
                              {p.customerEmail}
                            </p>
                          </button>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="font-mono text-body-sm tabular-nums text-ink">
                              {money(p.money.valueCents)}
                            </span>
                            {p.money.outstandingCents > 0 && (
                              <Chip tone="warn">{money(p.money.outstandingCents)} owed</Chip>
                            )}
                          </div>
                          <div className="mt-2 flex gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<ArrowLeft />}
                              disabled={PROJECT_BOARD.indexOf(p.status) === 0}
                              onClick={() => move(p, -1)}
                              aria-label="Move back a stage"
                            >
                              Back
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={<ArrowRight />}
                              disabled={
                                PROJECT_BOARD.indexOf(p.status) === PROJECT_BOARD.length - 1
                              }
                              onClick={() => move(p, 1)}
                              aria-label="Move forward a stage"
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
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
                      Make it a job
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
