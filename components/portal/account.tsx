"use client";

import { useRef, useState } from "react";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";
import { PortalAvatar } from "@/components/portal/Shell";

/*
 * Shared account pieces for the three portals' Settings screens: the
 * profile-photo uploader and the in-place password change. Both talk to
 * Supabase auth / the portal APIs with the same session the shell holds.
 */

const fieldCls =
  "w-full rounded-[8px] border border-hair bg-canvas px-4 py-3 text-body text-ink placeholder:text-dim focus:border-gold focus:outline-none";
const btnGhost =
  "tap rounded-[8px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-50";

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* ---------------- profile photo ---------------- */
export function AvatarUploader({
  name,
  email,
  avatarUrl,
  endpoint,
  onChanged,
}: {
  name?: string | null;
  email: string;
  avatarUrl: string | null;
  /* e.g. "/api/portal/me/avatar" */
  endpoint: string;
  onChanged: (avatarUrl: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    setErr("");
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch(endpoint, {
        method: "POST",
        headers: await authHeaders(),
        body: form,
      });
      const j = await r.json();
      if (!r.ok || !j.avatarUrl) setErr(j.error ?? "Could not save the photo. Try again.");
      else onChanged(j.avatarUrl as string);
    } catch {
      setErr("Could not save the photo. Try again.");
    }
    setBusy(false);
  }

  async function remove() {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(endpoint, { method: "DELETE", headers: await authHeaders() });
      if (r.ok) onChanged(null);
      else setErr("Could not remove the photo. Try again.");
    } catch {
      setErr("Could not remove the photo. Try again.");
    }
    setBusy(false);
  }

  return (
    <div>
      <p className="font-mono text-label uppercase text-muted">Profile photo</p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <PortalAvatar name={name} email={email} url={avatarUrl} size="xl" />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className={btnGhost}
          >
            {busy ? "Working" : avatarUrl ? "Change photo" : "Upload photo"}
          </button>
          {avatarUrl ? (
            <button type="button" disabled={busy} onClick={remove} className={btnGhost}>
              Remove
            </button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
      </div>
      <p className="mt-2 text-body-sm text-dim">PNG, JPG, or WebP, up to 2 MB.</p>
      {err && <p className="mt-2 text-body-sm text-error">{err}</p>}
    </div>
  );
}

/* ---------------- password ---------------- */
export function PasswordCard({ resetRedirect }: { resetRedirect: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [linkNotice, setLinkNotice] = useState("");

  async function change(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setOk("");
    if (next.length < 8) return setErr("Use at least 8 characters.");
    if (next !== confirm) return setErr("The new passwords do not match.");
    setBusy(true);
    const { data } = await supabase.auth.getSession();
    const email = data.session?.user.email;
    if (!email) {
      setBusy(false);
      return setErr("Your session expired. Sign in again.");
    }
    const check = await supabase.auth.signInWithPassword({ email, password: current });
    if (check.error) {
      setBusy(false);
      return setErr("Your current password did not match.");
    }
    const { error } = await supabase.auth.updateUser({ password: next });
    setBusy(false);
    if (error) return setErr(error.message);
    setCurrent("");
    setNext("");
    setConfirm("");
    setOk("Password changed.");
  }

  async function sendLink() {
    setLinkNotice("");
    const { data } = await supabase.auth.getSession();
    const email = data.session?.user.email;
    if (!email) return setLinkNotice("Your session expired. Sign in again.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${resetRedirect}`,
    });
    setLinkNotice(error ? error.message : `We sent a password link to ${email}.`);
  }

  return (
    <div className="rounded-[12px] border border-hair bg-surface p-6">
      <p className="font-mono text-label uppercase text-muted">Password</p>
      <form onSubmit={change} className="mt-4 grid max-w-md gap-4">
        <label className="grid gap-2">
          <span className="font-mono text-label uppercase text-muted">Current password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={fieldCls}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className="font-mono text-label uppercase text-muted">New password</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className={fieldCls}
            />
          </label>
          <label className="grid gap-2">
            <span className="font-mono text-label uppercase text-muted">Repeat it</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={fieldCls}
            />
          </label>
        </div>
        {err && <p className="text-body-sm text-error">{err}</p>}
        {ok && <p className="text-body-sm text-green">{ok}</p>}
        <div>
          <button
            type="submit"
            disabled={busy}
            className="tap rounded-[8px] bg-brand-gradient px-6 py-2.5 text-body font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60"
          >
            {busy ? "Saving" : "Change password"}
          </button>
        </div>
      </form>
      <div className="mt-5 border-t border-hair pt-4">
        <button
          type="button"
          onClick={sendLink}
          className="tap text-left text-body-sm text-muted transition-colors hover:text-gold"
        >
          Forgot your current one? Send a set-password link by email
        </button>
        {linkNotice && <p className="mt-2 text-body-sm text-gold">{linkNotice}</p>}
      </div>
    </div>
  );
}
