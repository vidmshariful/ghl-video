"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";

/*
 * Where a partner's "set your password" email link lands, the partner
 * twin of /portal/set-password. The link carries a Supabase recovery
 * token that detectSessionInUrl turns into a short-lived session; with
 * it, updateUser sets the password, then we head into /partners.
 */
const fieldCls =
  "w-full rounded-[8px] border border-hair bg-surface px-4 py-3.5 text-body text-ink placeholder:text-dim focus:border-gold focus:outline-none";

export function SetPasswordClient() {
  const router = useRouter();
  const [phase, setPhase] = useState<"checking" | "ready" | "noSession" | "done">(
    "checking",
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (active && session) setPhase("ready");
    });
    // grace period so we never flash "expired" while the token is read
    const t = setTimeout(async () => {
      if (!active) return;
      const { data } = await supabase.auth.getSession();
      setPhase((p) => (p !== "checking" ? p : data.session ? "ready" : "noSession"));
    }, 2500);
    return () => {
      active = false;
      clearTimeout(t);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (password.length < 8) return setErr("Use at least 8 characters.");
    if (password !== confirm) return setErr("The two passwords do not match.");
    setBusy(true);
    setErr("");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setErr(error.message);
    setPhase("done");
    setTimeout(() => router.push("/partners"), 1400);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center border-b border-hair bg-surface/60 px-6 py-4">
        <Link href="/partners" className="font-display text-body font-bold text-ink">
          GHL <span className="text-gradient">VIDEO</span>
          <span className="ml-2 font-mono text-label uppercase text-muted">/ Partners</span>
        </Link>
      </header>

      <section className="relative flex flex-1 items-center py-12 md:py-16">
        <div className="shell">
          <div className="mx-auto max-w-md">
            <p className="font-mono text-label uppercase text-gold">[ Partner portal ]</p>

            {phase === "checking" ? (
              <>
                <h1 className="mt-4 font-display text-h2 text-ink">One moment.</h1>
                <p className="mt-3 text-body text-muted">Checking your link...</p>
              </>
            ) : phase === "noSession" ? (
              <>
                <h1 className="mt-4 font-display text-h2 text-ink">That link has expired.</h1>
                <p className="mt-3 text-body text-muted">
                  Password links are single-use and expire quickly. Head back to the
                  sign-in page and request a fresh one.
                </p>
                <Link
                  href="/partners"
                  className="tap mt-6 inline-block rounded-[8px] bg-brand-gradient px-8 py-3.5 text-body font-semibold text-canvas transition-all hover:brightness-110"
                >
                  Back to sign in
                </Link>
              </>
            ) : phase === "done" ? (
              <>
                <h1 className="mt-4 font-display text-h2 text-ink">Password set.</h1>
                <p className="mt-3 text-body text-muted">Taking you to your portal...</p>
              </>
            ) : (
              <>
                <h1 className="mt-4 font-display text-h2 text-ink">Set your password.</h1>
                <form onSubmit={submit} className="mt-8 grid gap-4">
                  <label className="grid gap-2">
                    <span className="font-mono text-label uppercase text-muted">New password</span>
                    <input
                      type="password"
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={fieldCls}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="font-mono text-label uppercase text-muted">Repeat it</span>
                    <input
                      type="password"
                      required
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className={fieldCls}
                    />
                  </label>
                  {err && <p className="text-body-sm text-error">{err}</p>}
                  <button
                    type="submit"
                    disabled={busy}
                    className="tap mt-1 rounded-[8px] bg-brand-gradient px-8 py-3.5 text-body font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60"
                  >
                    {busy ? "Saving..." : "Save password"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
