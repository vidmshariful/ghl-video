"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Input } from "@/components/portal/ui";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";
import { teamFeaturesFor, type TeamFeature } from "@/lib/team-features";

/*
 * The "Your team" card in the customer and partner Settings: add a VA or
 * teammate, choose what they can use, and manage them. Owner-only; the
 * routes behind `endpoint` enforce that. Members get an invite email and
 * flip from Invited to Active the first time they work in the account.
 */

type Member = {
  id: string;
  name: string | null;
  email: string;
  features: string[] | null;
  status: "invited" | "active" | "paused";
  addedAt: string;
};

const STATUS_CHIP: Record<Member["status"], { label: string; cls: string }> = {
  active: { label: "Active", cls: "border-green/40 text-green" },
  invited: { label: "Invited", cls: "border-gold/40 text-gold" },
  paused: { label: "Paused", cls: "border-hair text-dim" },
};

const addedOn = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });


async function teamFetch(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const r = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  });
  return r.json();
}

function FeaturePicker({
  defs,
  checked,
  onToggle,
}: {
  defs: TeamFeature[];
  checked: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {defs.map((f) => (
        <label
          key={f.key}
          className="flex cursor-pointer items-start gap-3 rounded-[8px] border border-hair bg-canvas px-4 py-3 transition-colors hover:border-gold/40"
        >
          <input
            type="checkbox"
            checked={checked.has(f.key)}
            onChange={() => onToggle(f.key)}
            className="mt-1 h-4 w-4 accent-[var(--gold)]"
          />
          <span>
            <span className="block text-body-sm font-semibold text-ink">{f.label}</span>
            <span className="mt-0.5 block text-body-sm text-dim">{f.blurb}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function MemberForm({
  accountType,
  initial,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  accountType: "customer" | "partner";
  initial?: Member;
  busy: boolean;
  error: string;
  onSubmit: (v: { name: string; email: string; features: string[] | null }) => void;
  onCancel: () => void;
}) {
  const defs = teamFeaturesFor(accountType);
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(initial?.features ?? defs.map((f) => f.key)),
  );
  const isEdit = Boolean(initial);

  function toggle(key: string) {
    setChecked((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        // everything ticked stays "full access", so features added later
        // are granted automatically; a partial pick is an explicit list
        const features = checked.size === defs.length ? null : [...checked];
        onSubmit({ name, email, features });
      }}
      className="mt-4 grid gap-4 rounded-[8px] border border-hair bg-surface/60 p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="font-mono text-label uppercase text-muted">Their name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
        </label>
        <label className="grid gap-2">
          <span className="font-mono text-label uppercase text-muted">Their email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isEdit}
          />
        </label>
      </div>
      <div>
        <span className="font-mono text-label uppercase text-muted">What they can use</span>
        <div className="mt-2">
          <FeaturePicker defs={defs} checked={checked} onToggle={toggle} />
        </div>
      </div>
      {error && <p className="text-body-sm text-error">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="brand" type="submit" disabled={busy}>
          {busy ? "Saving" : isEdit ? "Save changes" : "Add and send invite"}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function TeamCard({
  endpoint,
  accountType,
}: {
  /* e.g. "/api/portal/team" */
  endpoint: string;
  accountType: "customer" | "partner";
}) {
  const defs = teamFeaturesFor(accountType);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [editing, setEditing] = useState<Member | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const j = await teamFetch(endpoint);
      if (j.members) setMembers(j.members);
    } catch {
      /* keep whatever we had */
    }
  }, [endpoint]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(v: { name: string; email: string; features: string[] | null }) {
    setBusy(true);
    setErr("");
    setNotice("");
    const isEdit = editing !== "new" && editing !== null;
    const j = await teamFetch(endpoint, {
      method: isEdit ? "PATCH" : "POST",
      body: JSON.stringify(isEdit ? { id: (editing as Member).id, ...v } : v),
    });
    setBusy(false);
    if (j.error) {
      setErr(j.error);
      return;
    }
    setEditing(null);
    setNotice(isEdit ? "Saved." : `Invite sent to ${v.email.trim().toLowerCase()}.`);
    load();
  }

  async function remove(m: Member) {
    if (!confirm(`Remove ${m.name || m.email}? They lose access immediately.`)) return;
    setNotice("");
    await teamFetch(endpoint, { method: "DELETE", body: JSON.stringify({ id: m.id }) });
    load();
  }

  async function act(m: Member, action: "pause" | "resume" | "resend") {
    setNotice("");
    setErr("");
    const j = await teamFetch(endpoint, {
      method: "PATCH",
      body: JSON.stringify({ id: m.id, action }),
    });
    if (j.error) {
      setErr(j.error);
      return;
    }
    setNotice(
      action === "resend"
        ? `Invite sent again to ${m.email}.`
        : action === "pause"
          ? `${m.name || m.email} is paused. They cannot sign in to this account until you resume them.`
          : `${m.name || m.email} is back in.`,
    );
    load();
  }

  const summary = (m: Member) =>
    m.features == null ? "Full access" : `${m.features.length} of ${defs.length} areas`;

  return (
    <div className="rounded-[12px] border border-hair bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-label uppercase text-muted">Your team</p>
          <p className="mt-1 max-w-xl text-body-sm text-muted">
            Give a VA or teammate their own sign-in to work in this portal. You
            choose what they can use; they get every update and notification for
            the areas you grant.
          </p>
        </div>
        {editing === null ? (
          <Button variant="brand" onClick={() => setEditing("new")}>
            Add a teammate
          </Button>
        ) : null}
      </div>

      {notice && <p className="mt-3 text-body-sm text-green">{notice}</p>}

      {editing === "new" ? (
        <MemberForm
          accountType={accountType}
          busy={busy}
          error={err}
          onSubmit={save}
          onCancel={() => {
            setEditing(null);
            setErr("");
          }}
        />
      ) : null}

      <div className="mt-4">
        {members === null ? (
          <p className="text-body-sm text-muted">Loading your team...</p>
        ) : members.length === 0 && editing === null ? (
          <p className="text-body-sm text-dim">
            No teammates yet. Add one and they get an email with their way in.
          </p>
        ) : (
          <ul className="grid gap-2">
            {members.map((m) =>
              editing !== null && editing !== "new" && editing.id === m.id ? (
                <li key={m.id}>
                  <MemberForm
                    accountType={accountType}
                    initial={m}
                    busy={busy}
                    error={err}
                    onSubmit={save}
                    onCancel={() => {
                      setEditing(null);
                      setErr("");
                    }}
                  />
                </li>
              ) : (
                <li
                  key={m.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-hair bg-canvas px-4 py-3 ${
                    m.status === "paused" ? "opacity-70" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-body font-semibold text-ink">
                      {m.name || m.email}
                    </p>
                    <p className="truncate font-mono text-label text-dim">
                      {m.email} / added {addedOn(m.addedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${STATUS_CHIP[m.status].cls}`}
                    >
                      {STATUS_CHIP[m.status].label}
                    </span>
                    <span className="font-mono text-label uppercase text-muted">
                      {summary(m)}
                    </span>
                    {m.status === "invited" ? (
                      <Button variant="secondary" onClick={() => act(m, "resend")}>
                        Resend invite
                      </Button>
                    ) : null}
                    <Button variant="secondary" onClick={() => setEditing(m)}>
                      Edit
                    </Button>
                    {m.status === "active" ? (
                      <Button variant="secondary" onClick={() => act(m, "pause")}>
                        Pause
                      </Button>
                    ) : m.status === "paused" ? (
                      <button
                        type="button"
                        onClick={() => act(m, "resume")}
                        className="tap rounded-[8px] border border-gold/40 px-4 py-2 font-mono text-label uppercase text-gold transition-colors hover:border-gold"
                      >
                        Resume
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => remove(m)}
                      className="tap rounded-[8px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-error/60 hover:text-error"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
