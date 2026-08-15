"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminModal } from "./Modal";
import { authHeader, supabase } from "./client";
import type { View } from "./nav";
import {
  ROLES,
  ROLE_LABELS,
  ROLE_BLURB,
  ROLE_DEFAULT_FEATURES,
  TOGGLEABLE_VIEWS,
  effectiveFeatures,
  type Role,
} from "./roles";

type TeamRow = {
  email: string;
  name: string | null;
  role: Role;
  features: string[] | null;
  created_at: string;
};

const GROUPS = ["Sales", "Production", "Affiliate", "Products & Packs", "CMS", "Settings"] as const;

const btnGold =
  "tap rounded-[8px] bg-brand-gradient px-5 py-2.5 text-body-sm font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60";
const btnGhost =
  "tap rounded-[8px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold";
const inputCls =
  "mt-2 w-full rounded-[8px] border border-hair bg-canvas px-4 py-2.5 text-body text-ink focus:border-gold focus:outline-none disabled:opacity-60";
const labelCls = "font-mono text-label uppercase text-muted";

function RoleBadge({ role }: { role: Role }) {
  const cls =
    role === "admin"
      ? "border-gold/40 bg-gold/10 text-gold"
      : "border-hair bg-hair/30 text-muted";
  return (
    <span className={`rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${cls}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}

export function TeamScreen({
  meEmail,
  embedded = false,
}: {
  meEmail: string;
  /* true when rendered as a Settings tab: the tab bar already names it */
  embedded?: boolean;
}) {
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<TeamRow | "new" | null>(null);

  const load = useCallback(async () => {
    setErr("");
    try {
      const r = await fetch("/api/admin/team", { headers: await authHeader() });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not load the team.");
      setTeam(j.team ?? []);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(row: TeamRow) {
    if (!confirm(`Remove ${row.name || row.email}? They lose admin access immediately.`)) return;
    setErr("");
    setNotice("");
    try {
      const r = await fetch("/api/admin/team", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ email: row.email }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not remove them.");
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function sendLoginLink(row: TeamRow) {
    setErr("");
    setNotice("");
    const { error } = await supabase.auth.resetPasswordForEmail(row.email, {
      redirectTo: `${window.location.origin}/portal/set-password/`,
    });
    if (error) setErr(error.message);
    else setNotice(`Sent a set-password link to ${row.email}.`);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          {!embedded && <h1 className="font-display text-h2 text-ink">Team</h1>}
          <p className={`${embedded ? "" : "mt-1 "}max-w-xl text-body-sm text-muted`}>
            Who can sign in to manage the platform, and what each person can see. New
            teammates get a link to set their own password.
          </p>
        </div>
        <button type="button" onClick={() => setEditing("new")} className={btnGold}>
          Add teammate
        </button>
      </div>

      {notice ? <p className="mt-4 text-body-sm text-gold">{notice}</p> : null}
      {err ? <p className="mt-4 text-body-sm text-error">{err}</p> : null}

      <div className="mt-6 overflow-hidden rounded-[12px] border border-hair">
        {!loaded ? (
          <p className="p-6 text-body-sm text-muted">Loading team...</p>
        ) : team.length === 0 ? (
          <p className="p-6 text-body-sm text-muted">No teammates yet.</p>
        ) : (
          <ul className="divide-y divide-hair">
            {team.map((row) => {
              const isMe = row.email.toLowerCase() === meEmail.toLowerCase();
              const access =
                row.role === "admin"
                  ? "Full access"
                  : `${effectiveFeatures(row.role, row.features).length} of ${TOGGLEABLE_VIEWS.length} sections`;
              return (
                <li
                  key={row.email}
                  className="flex flex-wrap items-center gap-x-4 gap-y-3 bg-surface/40 p-4 md:p-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold text-ink">
                      <span className="truncate">{row.name || row.email}</span>
                      {isMe ? (
                        <span className="font-mono text-label uppercase text-dim">you</span>
                      ) : null}
                    </p>
                    <p className="truncate text-body-sm text-muted">{row.email}</p>
                  </div>
                  <RoleBadge role={row.role} />
                  <span className="w-32 text-body-sm text-muted">{access}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <button type="button" onClick={() => sendLoginLink(row)} className={btnGhost}>
                      Send login link
                    </button>
                    <button type="button" onClick={() => setEditing(row)} className={btnGhost}>
                      Edit
                    </button>
                    {!isMe ? (
                      <button
                        type="button"
                        onClick={() => remove(row)}
                        className="tap rounded-[8px] border border-hair px-4 py-2 font-mono text-label uppercase text-dim transition-colors hover:border-error/60 hover:text-error"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {editing ? (
        <TeamForm
          row={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setNotice("");
            load();
          }}
        />
      ) : null}
    </div>
  );
}

function TeamForm({
  row,
  onClose,
  onSaved,
}: {
  row: TeamRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!row;
  const [name, setName] = useState(row?.name ?? "");
  const [email, setEmail] = useState(row?.email ?? "");
  const [role, setRole] = useState<Role>(row?.role ?? "sales_rep");
  const [features, setFeatures] = useState<Set<View>>(
    () => new Set(row ? effectiveFeatures(row.role, row.features) : ROLE_DEFAULT_FEATURES.sales_rep),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function changeRole(next: Role) {
    setRole(next);
    setFeatures(new Set(ROLE_DEFAULT_FEATURES[next]));
  }

  function toggle(key: View) {
    setFeatures((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const payload = {
        email: isEdit ? row!.email : email.trim().toLowerCase(),
        name: name.trim(),
        role,
        features: role === "admin" ? null : [...features],
      };
      const r = await fetch("/api/admin/team", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not save.");
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <AdminModal
      open
      onClose={onClose}
      title={isEdit ? "Edit teammate" : "Add teammate"}
      subtitle={isEdit ? row!.email : "They will get a link to set their password."}
    >
      <form onSubmit={save} className="grid gap-5">
        <label className="block">
          <span className={labelCls}>Full name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
            placeholder="Jordan Reeves"
          />
        </label>
        <label className="block">
          <span className={labelCls}>Email</span>
          <input
            type="email"
            required
            disabled={isEdit}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            placeholder="jordan@vidiosa.com"
          />
        </label>

        <div>
          <span className={labelCls}>Role</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => changeRole(r)}
                className={`tap rounded-[8px] border px-4 py-2 text-body-sm transition-colors ${
                  role === r
                    ? "border-gold/60 bg-gold/10 font-semibold text-gold"
                    : "border-hair text-muted hover:border-gold/40 hover:text-ink"
                }`}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-body-sm text-muted">{ROLE_BLURB[role]}</p>
        </div>

        {role === "admin" ? (
          <p className="rounded-[8px] border border-gold/25 bg-gold/[0.05] px-4 py-3 text-body-sm text-muted">
            Admins see and do everything, including managing the team. The menu list
            below does not apply.
          </p>
        ) : (
          <div>
            <span className={labelCls}>Menu access</span>
            <p className="mt-1 text-body-sm text-dim">
              Dashboard is always on. Check what this person can open.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {GROUPS.map((g) => {
                const items = TOGGLEABLE_VIEWS.filter((v) => v.group === g);
                return (
                  <div key={g} className="rounded-[8px] border border-hair p-3">
                    <p className="mb-2 font-mono text-label uppercase tracking-[0.1em] text-gold/70">
                      {g}
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {items.map((it) => (
                        <label
                          key={it.key}
                          className="flex cursor-pointer items-center gap-2.5 text-body-sm text-ink"
                        >
                          <input
                            type="checkbox"
                            checked={features.has(it.key)}
                            onChange={() => toggle(it.key)}
                            className="h-4 w-4 accent-[#FCC000]"
                          />
                          <span>{it.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {err ? <p className="text-body-sm text-error">{err}</p> : null}

        <div className="flex items-center gap-3 border-t border-hair pt-5">
          <button type="submit" disabled={busy} className={btnGold}>
            {busy ? "Saving..." : isEdit ? "Save changes" : "Add teammate"}
          </button>
          <button type="button" onClick={onClose} className={btnGhost}>
            Cancel
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
