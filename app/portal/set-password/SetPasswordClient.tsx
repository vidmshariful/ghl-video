"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";

/*
 * Where the "set your password" / "reset password" email link lands. The
 * link carries a Supabase recovery token that detectSessionInUrl turns
 * into a short-lived recovery session; with it, updateUser sets a new
 * password. Used for both first-time setup and forgot-password. If the
 * link is stale or opened directly, we show a clear path back to login.
 */
const fieldCls =
  "w-full rounded-[3px] border border-hair bg-surface px-4 py-3.5 text-body text-ink placeholder:text-dim focus:border-gold focus:outline-none";

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
    // The recovery token in the URL is processed asynchronously; a session
    // arriving through onAuthStateChange means the link is valid.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (active && session) setPhase("ready");
    });
    // Grace period so we never flash "expired" while the token is still
    // being read from the URL.
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
    setTimeout(() => router.push("/portal"), 1400);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center border-b border-hair bg-surface/60 px-6 py-4">
        <Link href="/portal" className="font-display text-body font-bold text-ink">
          GHL <span className="text-gradient">VIDEO</span>
          <span className="ml-2 font-mono text-label uppercase text-muted">/ Portal</span>
        </Link>
      </header>

      <section className="relative flex flex-1 items-center py-12 md:py-16">
        <div className="shell">
          <div className="mx-auto max-w-md">
            <p className="font-mono text-label uppercase text-gold">[ Your portal ]</p>

            {phase === "checking" ? (
              <>
                <h1 className="mt-4 font-display text-h2 text-ink">One moment.</h1>
                <p className="mt-3 text-body text-muted">Checking your link...</p>
              </>
            ) : phase === "noSession" ? (
              <>
                <h1 className="mt-4 font-display text-h2 text-ink">This link has expired.</h1>
                <p className="mt-3 text-body text-muted">
                  Password links are single-use and time-limited. Head back to
                  sign in and request a fresh one.
                </p>
                <Link
                  href="/portal"
                  className="tap mt-6 inline-flex rounded-[3px] bg-brand-gradient px-8 py-3.5 text-body font-semibold text-canvas transition-all hover:brightness-110"
                >
                  Back to sign in
                </Link>
              </>
            ) : phase === "done" ? (
              <>
                <h1 className="mt-4 font-display text-h2 text-ink">Password set.</h1>
                <p className="mt-3 text-body text-muted">
                  You are signed in. Taking you to your portal...
                </p>
              </>
            ) : (
              <>
                <h1 className="mt-4 font-display text-h2 text-ink">Set your password.</h1>
                <form onSubmit={submit} className="mt-8 grid gap-4">
                  <p className="text-body text-muted">
                    Choose a password for your GHL Video portal. You will use it
                    with your email from now on.
                  </p>
                  <label className="grid gap-2">
                    <span className="font-mono text-label uppercase text-muted">
                      New password
                    </span>
                    <input
                      type="password"
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={fieldCls}
                      placeholder="At least 8 characters"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="font-mono text-label uppercase text-muted">
                      Confirm password
                    </span>
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
                    className="tap mt-1 rounded-[3px] bg-brand-gradient px-8 py-3.5 text-body font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60"
                  >
                    {busy ? "Saving..." : "Save password and sign in"}
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
