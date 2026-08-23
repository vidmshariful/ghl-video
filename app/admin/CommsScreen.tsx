"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Mail } from "lucide-react";
import { Button, Card, Chip, Input, Modal, PageHeader, Tabs, Textarea } from "@/components/portal/ui";
import { authHeader, supabase } from "./client";
import { EmailLogView } from "./EmailLogView";
import {
  COMM_ACTIONS,
  COMM_GROUPS,
  NOTIFICATION_DEFAULTS,
  NOTIFICATION_SAMPLE,
  TO_LABEL,
  notifId,
  type CommAction,
  type CommGroupKey,
  type CommMode,
} from "@/lib/comms";
import type { Audience } from "@/lib/notifications-types";
import {
  DEFAULT_TEMPLATES,
  SITE_URL,
  TEMPLATE_VARIABLES,
  renderTemplate,
  wrapEmail,
} from "@/lib/email/templates";

/*
 * Emails and notifications, by feature.
 *
 * The old screen was one dropdown of template keys. It could not say when an
 * email fires, who reads it, or whether the bell says something too, so the
 * team edited copy blind. This screen is the other way round: the action
 * first (the client approved a cut, a brief landed), and under it every email
 * and every bell that action fires, each with its own switch and its own Edit.
 * The list of actions lives in lib/comms.ts beside the defaults, so a new
 * event shows up here the day it is built.
 */

type EmailRow = { key: string; subject: string; body: string; enabled: boolean };
type NotifRow = { audience: Audience; kind: string; title: string; body: string | null; enabled: boolean };
type Counts = Record<string, { sent: number; failed: number; skipped: number; held: number }>;

type Data = {
  brevoConfigured: boolean;
  emailTemplates: EmailRow[];
  notificationTemplates: NotifRow[];
  emailCounts: Counts;
  bellCounts: Record<string, number>;
  windowDays: number;
};

/* sample values so the email preview and the test send show something real */
const EMAIL_SAMPLE: Record<string, string> = {
  customer_name: "Alex",
  customer_email: "alex@agency.com",
  product_name: "Marketing Video: Unified Inbox",
  order_code: "FEXP-031",
  amount: "$495",
  update_message: "Your first cut is ready for review. Take a look and send any changes.",
  stage: "In review",
  video_title: "Unified Inbox walkthrough",
  video_list: "<li>Unified Inbox walkthrough</li><li>Calendars explained</li>",
  stage_label: "Animation",
  project_title: "Brand film, 90 seconds",
  headline: "Animation approved: Brand film, 90 seconds",
  message: "Love it. One tweak on the ending, then we are done.",
  where: " at 0:12",
  days_waiting: "3",
  digest_lines: "<li>Unified Inbox walkthrough: with you</li>",
  plan_name: "Growth plan",
  old_amount: "$997",
  new_amount: "$1,200",
  effective_date: "Oct 1",
  reason: "More minutes on the plan.",
  invoice_number: "INV-1042",
  due_line: ", due Sep 12",
  due_date: "Sep 12",
  pay_url: `${SITE_URL}/invoice/example/`,
  line_items: "Custom explainer, 60 seconds: $2,500",
  notes: "Thank you for the quick turnaround on the brief.",
  name: "Alex",
  email: "alex@agency.com",
  channel: "YouTube",
  audience: "12,000 subscribers",
  partner_name: "Alex",
  partner_email: "alex@agency.com",
  member_name: "Sam",
  member_email: "sam@agency.com",
  owner_name: "Jordan",
  portal_label: "customer portal",
  review_ask: "",
  intake_url: `${SITE_URL}/checkout/intake/example`,
  contact_url: `${SITE_URL}/contact`,
  partners_url: `${SITE_URL}/partners`,
  portal_url: `${SITE_URL}/portal`,
  delivery_url: `${SITE_URL}/portal`,
  admin_url: `${SITE_URL}/admin`,
};

const MODE_LABEL: Record<CommMode, string> = {
  automatic: "Automatic",
  manual: "By hand",
  scheduled: "Scheduled",
};
const MODE_TONE: Record<CommMode, "info" | "neutral" | "warn"> = {
  automatic: "info",
  manual: "neutral",
  scheduled: "warn",
};

const AUDIENCE_WORD: Record<Audience, string> = { admin: "the team", customer: "the client", partner: "the partner" };

export function CommsScreen() {
  const [tab, setTab] = useState<"features" | "log">("features");
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<
    | { type: "email"; key: string }
    | { type: "bell"; audience: Audience; kind: string }
    | null
  >(null);
  const [group, setGroup] = useState<CommGroupKey | "all">("all");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/comms", { headers: await authHeader() });
      const j = await r.json();
      if (!r.ok) return setErr(j.error ?? "Could not load.");
      setData(j as Data);
    } catch {
      setErr("Could not load.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const emailRow = (key: string) => data?.emailTemplates.find((t) => t.key === key) ?? null;
  const bellRow = (audience: Audience, kind: string) =>
    data?.notificationTemplates.find((t) => t.audience === audience && t.kind === kind) ?? null;

  /* the on/off switch writes immediately; the words wait for Save */
  async function setEmailEnabled(key: string, enabled: boolean) {
    const def = DEFAULT_TEMPLATES.find((t) => t.key === key);
    const row = emailRow(key);
    const { error } = await supabase.from("email_templates").upsert(
      {
        key,
        name: def?.name ?? key,
        description: def?.description ?? "",
        subject: row?.subject ?? def?.subject ?? "",
        body: row?.body ?? def?.body ?? "",
        enabled,
      },
      { onConflict: "key" },
    );
    if (error) setErr(error.message);
    await load();
  }
  async function setBellEnabled(audience: Audience, kind: string, enabled: boolean) {
    const def = NOTIFICATION_DEFAULTS[notifId(audience, kind)];
    const row = bellRow(audience, kind);
    const { error } = await supabase.from("notification_templates").upsert(
      {
        audience,
        kind,
        title: row?.title ?? def?.title ?? kind,
        body: row?.body ?? def?.body ?? null,
        enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "audience,kind" },
    );
    if (error) setErr(error.message);
    await load();
  }

  const groups = useMemo(
    () => COMM_GROUPS.filter((g) => group === "all" || g.key === group),
    [group],
  );

  const sentIn = (key: string) => data?.emailCounts[key];
  const firedIn = (audience: Audience, kind: string) => data?.bellCounts[notifId(audience, kind)] ?? 0;

  return (
    <div>
      <PageHeader
        title="Emails and notifications"
        description="Everything the platform says on its own, listed under the action that says it. Switch any one off, or change its words. The GHL Video frame around every email is added automatically."
      />

      {data && !data.brevoConfigured && (
        <Card tone="dark" title="Email is switched off at the server">
          <p className="text-body-sm text-chrome-muted">
            BREVO_API_KEY is not set, so every email below is logged as skipped and never sent. Bells still
            work. Set the key in Vercel and redeploy.
          </p>
        </Card>
      )}
      {err && <p className="mt-3 text-body-sm text-error">{err}</p>}

      <div className="mt-4">
        <Tabs
          tabs={[
            { key: "features", label: "By feature" },
            { key: "log", label: "Log" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === "log" ? (
        <div className="mt-5">
          <EmailLogView />
        </div>
      ) : (
        <>
          {/* jump to one feature, or read them all */}
          <div className="mt-5 flex flex-wrap gap-1.5">
            <FilterChip on={group === "all"} onClick={() => setGroup("all")}>
              All
            </FilterChip>
            {COMM_GROUPS.map((g) => (
              <FilterChip key={g.key} on={group === g.key} onClick={() => setGroup(g.key)}>
                {g.label}
              </FilterChip>
            ))}
          </div>

          <div className="mt-5 grid gap-5">
            {groups.map((g) => {
              const actions = COMM_ACTIONS.filter((a) => a.group === g.key);
              return (
                <Card key={g.key} title={g.label} description={g.blurb}>
                  <div className="grid gap-4">
                    {actions.map((a) => (
                      <ActionBlock
                        key={a.key}
                        action={a}
                        loading={!data}
                        emailRow={emailRow}
                        bellRow={bellRow}
                        sentIn={sentIn}
                        firedIn={firedIn}
                        windowDays={data?.windowDays ?? 30}
                        onToggleEmail={setEmailEnabled}
                        onToggleBell={setBellEnabled}
                        onEditEmail={(key) => setEditing({ type: "email", key })}
                        onEditBell={(audience, kind) => setEditing({ type: "bell", audience, kind })}
                      />
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {editing?.type === "email" && (
        <EmailEditor
          templateKey={editing.key}
          row={emailRow(editing.key)}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
      {editing?.type === "bell" && (
        <BellEditor
          audience={editing.audience}
          kind={editing.kind}
          row={bellRow(editing.audience, editing.kind)}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap rounded-[8px] border px-3 py-1.5 text-body-sm transition-colors ${
        on ? "border-gold/60 bg-gold/10 text-ink" : "border-hair bg-surface text-muted hover:border-gold/40 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/* one action: what fires it, then each email and bell it sends as a row */
function ActionBlock({
  action,
  loading,
  emailRow,
  bellRow,
  sentIn,
  firedIn,
  windowDays,
  onToggleEmail,
  onToggleBell,
  onEditEmail,
  onEditBell,
}: {
  action: CommAction;
  loading: boolean;
  emailRow: (key: string) => EmailRow | null;
  bellRow: (audience: Audience, kind: string) => NotifRow | null;
  sentIn: (key: string) => Counts[string] | undefined;
  firedIn: (audience: Audience, kind: string) => number;
  windowDays: number;
  onToggleEmail: (key: string, enabled: boolean) => Promise<void>;
  onToggleBell: (audience: Audience, kind: string, enabled: boolean) => Promise<void>;
  onEditEmail: (key: string) => void;
  onEditBell: (audience: Audience, kind: string) => void;
}) {
  const nothing = action.emails.length === 0 && action.notifications.length === 0;
  return (
    <div className="rounded-[8px] border border-hair bg-canvas">
      <div className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <p className="text-body-sm font-semibold text-ink">{action.label}</p>
          <p className="mt-0.5 max-w-[70ch] text-body-sm text-muted">{action.when}</p>
        </div>
        <Chip tone={MODE_TONE[action.mode]}>{MODE_LABEL[action.mode]}</Chip>
      </div>

      {nothing ? (
        <p className="border-t border-hair px-4 py-2.5 font-mono text-label uppercase text-dim">
          Sends nothing of its own
        </p>
      ) : (
        <ul className="border-t border-hair">
          {action.emails.map((e) => {
            const def = DEFAULT_TEMPLATES.find((t) => t.key === e.key);
            const row = emailRow(e.key);
            const enabled = row?.enabled ?? true;
            const c = sentIn(e.key);
            return (
              <ChannelRow
                key={`e-${e.key}`}
                icon={<Mail size={14} aria-hidden="true" />}
                kindWord="Email"
                name={def?.name ?? e.key}
                to={TO_LABEL[e.to] + (e.note ? `, ${e.note}` : "")}
                activity={
                  c
                    ? `${c.sent} sent${c.failed ? `, ${c.failed} failed` : ""}${c.held ? `, ${c.held} held` : ""}${c.skipped ? `, ${c.skipped} skipped` : ""} in ${windowDays} days`
                    : `none in ${windowDays} days`
                }
                enabled={enabled}
                edited={Boolean(row && (row.subject !== def?.subject || row.body !== def?.body))}
                loading={loading}
                onToggle={(v) => onToggleEmail(e.key, v)}
                onEdit={() => onEditEmail(e.key)}
              />
            );
          })}
          {action.notifications.map((n) => {
            const def = NOTIFICATION_DEFAULTS[notifId(n.audience, n.kind)];
            const row = bellRow(n.audience, n.kind);
            const enabled = row?.enabled ?? true;
            const fired = firedIn(n.audience, n.kind);
            return (
              <ChannelRow
                key={`n-${n.audience}-${n.kind}`}
                icon={<Bell size={14} aria-hidden="true" />}
                kindWord={`Bell, ${AUDIENCE_WORD[n.audience]}`}
                name={renderTemplate(row?.title ?? def?.title ?? n.kind, NOTIFICATION_SAMPLE)}
                to={TO_LABEL[n.to] + (n.note ? `, ${n.note}` : "")}
                activity={fired ? `${fired} in ${windowDays} days` : `none in ${windowDays} days`}
                enabled={enabled}
                edited={Boolean(row && def && (row.title !== def.title || (row.body ?? "") !== def.body))}
                loading={loading}
                onToggle={(v) => onToggleBell(n.audience, n.kind, v)}
                onEdit={() => onEditBell(n.audience, n.kind)}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ChannelRow({
  icon,
  kindWord,
  name,
  to,
  activity,
  enabled,
  edited,
  loading,
  onToggle,
  onEdit,
}: {
  icon: React.ReactNode;
  kindWord: string;
  name: string;
  to: string;
  activity: string;
  enabled: boolean;
  edited: boolean;
  loading: boolean;
  onToggle: (v: boolean) => void;
  onEdit: () => void;
}) {
  return (
    <li
      className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-hair px-4 py-2.5 last:border-b-0 ${
        enabled ? "" : "opacity-60"
      }`}
    >
      <span className="grid h-7 w-7 place-items-center rounded-[6px] border border-hair bg-surface text-muted">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-body-sm text-ink">
          <span className="font-mono text-label uppercase tracking-[0.08em] text-dim">{kindWord} / </span>
          {name}
          {edited && (
            <span className="ml-2 font-mono text-label uppercase tracking-[0.08em] text-gold">edited</span>
          )}
        </p>
        <p className="truncate font-mono text-label uppercase tracking-[0.08em] text-dim">
          To {to}. {activity}.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <label className="flex cursor-pointer items-center gap-1.5 text-body-sm text-muted" title={enabled ? "On" : "Off"}>
          <input
            type="checkbox"
            checked={enabled}
            disabled={loading}
            onChange={(e) => onToggle(e.target.checked)}
            className="h-4 w-4 accent-[var(--gold)]"
            aria-label={`${name} on or off`}
          />
          <span className="font-mono text-label uppercase">{enabled ? "On" : "Off"}</span>
        </label>
        <Button size="sm" variant="secondary" onClick={onEdit} disabled={loading}>
          Edit
        </Button>
      </div>
    </li>
  );
}

/* ---------- the email editor, in a modal ---------- */
function EmailEditor({
  templateKey,
  row,
  onClose,
  onSaved,
}: {
  templateKey: string;
  row: EmailRow | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const def = DEFAULT_TEMPLATES.find((t) => t.key === templateKey);
  const [subject, setSubject] = useState(row?.subject ?? def?.subject ?? "");
  const [body, setBody] = useState(row?.body ?? def?.body ?? "");
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const vars = TEMPLATE_VARIABLES[templateKey] ?? [];
  const action = COMM_ACTIONS.find((a) => a.emails.some((e) => e.key === templateKey));
  const toWord = action?.emails.find((e) => e.key === templateKey)?.to;

  async function save() {
    setBusy("save");
    setErr("");
    const { error } = await supabase.from("email_templates").upsert(
      {
        key: templateKey,
        name: def?.name ?? templateKey,
        description: def?.description ?? "",
        subject,
        body,
        enabled: row?.enabled ?? true,
      },
      { onConflict: "key" },
    );
    setBusy(null);
    if (error) return setErr(error.message);
    await onSaved();
    onClose();
  }

  async function sendTest() {
    setBusy("test");
    setErr("");
    setMsg("");
    try {
      const r = await fetch("/api/admin/email/test", {
        method: "POST",
        headers: { ...(await authHeader()), "content-type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      const j = await r.json();
      if (!r.ok) setErr(j.error ?? "Test send failed.");
      else setMsg(`Test sent to ${j.to}.`);
    } catch {
      setErr("Test send failed.");
    }
    setBusy(null);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={def?.name ?? templateKey}
      subtitle={
        <>
          {action ? `Fires when: ${action.when}` : null}
          {toWord ? ` Goes to ${TO_LABEL[toWord].toLowerCase()}.` : null}
          {def?.description ? ` ${def.description}` : null}
        </>
      }
      maxWidth="max-w-6xl"
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="grid gap-3">
          <label className="block">
            <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Subject</span>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className="block">
            <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Message (HTML)</span>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              spellCheck={false}
              className="h-72 font-mono text-body-sm"
            />
          </label>
          <div className="rounded-[8px] border border-hair bg-canvas p-3">
            <p className="font-mono text-label uppercase tracking-[0.08em] text-muted">Variables you can use</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {vars.map((v) => (
                <code key={v} className="rounded-[6px] border border-hair bg-surface px-2 py-0.5 font-mono text-label text-gold/80">
                  {`{{${v}}}`}
                </code>
              ))}
              {vars.length === 0 && <span className="text-body-sm text-dim">None for this one.</span>}
            </div>
          </div>
          {err && <p className="text-body-sm text-error">{err}</p>}
          {msg && <p className="text-body-sm text-green">{msg}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="brand" disabled={busy !== null} onClick={save}>
              {busy === "save" ? "Saving..." : "Save"}
            </Button>
            <Button variant="secondary" disabled={busy !== null} onClick={sendTest}>
              {busy === "test" ? "Sending..." : "Send test to me"}
            </Button>
            <Button
              variant="secondary"
              disabled={busy !== null}
              onClick={() => {
                setSubject(def?.subject ?? "");
                setBody(def?.body ?? "");
                setMsg("Default loaded. Save to keep it.");
              }}
            >
              Reset to default
            </Button>
          </div>
        </div>
        <div>
          <p className="mb-2 font-mono text-label uppercase tracking-[0.08em] text-muted">
            Preview, with sample data. Subject: {renderTemplate(subject, EMAIL_SAMPLE)}
          </p>
          <iframe
            title="Email preview"
            sandbox=""
            srcDoc={wrapEmail(renderTemplate(body, EMAIL_SAMPLE))}
            className="h-[34rem] w-full rounded-[8px] border border-hair bg-white"
          />
        </div>
      </div>
    </Modal>
  );
}

/* ---------- the bell editor, in a modal ---------- */
function BellEditor({
  audience,
  kind,
  row,
  onClose,
  onSaved,
}: {
  audience: Audience;
  kind: string;
  row: NotifRow | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const def = NOTIFICATION_DEFAULTS[notifId(audience, kind)];
  const [title, setTitle] = useState(row?.title ?? def?.title ?? "");
  const [body, setBody] = useState(row?.body ?? def?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const action = COMM_ACTIONS.find((a) => a.notifications.some((n) => n.audience === audience && n.kind === kind));

  async function save() {
    setBusy(true);
    setErr("");
    const { error } = await supabase.from("notification_templates").upsert(
      {
        audience,
        kind,
        title: title.trim() || def?.title || kind,
        body: body.trim() || null,
        enabled: row?.enabled ?? true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "audience,kind" },
    );
    setBusy(false);
    if (error) return setErr(error.message);
    await onSaved();
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Bell to ${AUDIENCE_WORD[audience]}: ${def?.title ?? kind}`}
      subtitle={action ? `Fires when: ${action.when}` : undefined}
      maxWidth="max-w-3xl"
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-3">
          <label className="block">
            <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Title</span>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </label>
          <label className="block">
            <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Line under it</span>
            <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={300} />
          </label>
          <div className="rounded-[8px] border border-hair bg-canvas p-3">
            <p className="font-mono text-label uppercase tracking-[0.08em] text-muted">Variables you can use</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(def?.variables ?? []).map((v) => (
                <code key={v} className="rounded-[6px] border border-hair bg-surface px-2 py-0.5 font-mono text-label text-gold/80">
                  {`{{${v}}}`}
                </code>
              ))}
              {!def && <span className="text-body-sm text-dim">None for this one.</span>}
            </div>
          </div>
          {err && <p className="text-body-sm text-error">{err}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="brand" disabled={busy} onClick={save}>
              {busy ? "Saving..." : "Save"}
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setTitle(def?.title ?? "");
                setBody(def?.body ?? "");
              }}
            >
              Reset to default
            </Button>
          </div>
        </div>

        {/* how it will read in the bell */}
        <div>
          <p className="mb-2 font-mono text-label uppercase tracking-[0.08em] text-muted">Preview</p>
          <div className="rounded-[8px] border border-hair bg-surface p-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gold" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-body-sm font-semibold text-ink">{renderTemplate(title, NOTIFICATION_SAMPLE) || "(no title)"}</p>
                {body.trim() && (
                  <p className="mt-0.5 text-body-sm text-muted">{renderTemplate(body, NOTIFICATION_SAMPLE)}</p>
                )}
                <p className="mt-1 font-mono text-label uppercase text-dim">just now</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
