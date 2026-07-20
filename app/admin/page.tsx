"use client";

import { createClient, type Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { SB_ANON, SB_URL } from "@/lib/chrome";
import { sitePages } from "@/lib/pages-list";
import { site } from "@/lib/site";

/*
 * The managing area: /admin. Password login (Supabase Auth), sidebar
 * with two screens for now:
 *   1. Header & Footer Code: edit the tracking snippets; saving fires
 *      the database trigger that republishes the site.
 *   2. Pages: every page the site ships, with its link, including the
 *      SEO pages that are reachable by direct link only.
 * Writes are enforced server-side by row-level security; this UI is
 * just a friendly face on the same rules.
 */

const supabase = createClient(SB_URL, SB_ANON);

type View = "code" | "pages";

/* ---------------------------------------------------------------- */
/* Login                                                             */
/* ---------------------------------------------------------------- */
function Login({ onError, error }: { onError: (m: string) => void; error: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    onError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) onError(error.message === "Invalid login credentials" ? "Wrong email or password." : error.message);
    setBusy(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <form
        onSubmit={signIn}
        className="w-full max-w-sm rounded-card border border-hair bg-surface p-8"
      >
        <p className="font-display text-h4 font-semibold text-ink">
          GHL Video <span className="text-gradient">Site Admin</span>
        </p>
        <p className="mt-2 text-body-sm text-muted">
          Sign in to manage the website.
        </p>
        <label className="mt-6 block">
          <span className="font-mono text-label uppercase text-muted">Email</span>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-[3px] border border-hair bg-canvas px-4 py-3 text-body text-ink focus:border-gold focus:outline-none"
          />
        </label>
        <label className="mt-4 block">
          <span className="font-mono text-label uppercase text-muted">Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-[3px] border border-hair bg-canvas px-4 py-3 text-body text-ink focus:border-gold focus:outline-none"
          />
        </label>
        {error && <p className="mt-4 text-body-sm text-error">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="tap mt-6 w-full rounded-[3px] bg-brand-gradient px-6 py-3 text-body font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Signing in" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Screen 1: Header & Footer code                                    */
/* ---------------------------------------------------------------- */
function CodeScreen() {
  const [head, setHead] = useState("");
  const [body, setBody] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("site_settings")
      .select("head_scripts, body_end_scripts")
      .eq("id", 1)
      .single()
      .then(({ data, error }) => {
        if (error) setStatus({ kind: "err", msg: "Could not load settings: " + error.message });
        else {
          setHead(data.head_scripts ?? "");
          setBody(data.body_end_scripts ?? "");
        }
        setLoaded(true);
      });
  }, []);

  async function save() {
    setSaving(true);
    setStatus(null);
    const { error } = await supabase
      .from("site_settings")
      .update({ head_scripts: head, body_end_scripts: body, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setStatus(
      error
        ? { kind: "err", msg: "Save failed: " + error.message }
        : { kind: "ok", msg: "Saved. The site is republishing itself now, live in about 2 minutes." },
    );
    setSaving(false);
  }

  if (!loaded) return <p className="text-body text-muted">Loading settings...</p>;

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-h3 text-ink">Header &amp; Footer Code</h1>
      <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
        Tracking and verification snippets. The first box is injected at the
        top of every page, the second right before the closing body tag.
        Saving republishes the website automatically.
      </p>

      <label className="mt-8 block">
        <span className="font-mono text-label uppercase text-muted">
          Header code (GTM, pixels, analytics)
        </span>
        <textarea
          value={head}
          onChange={(e) => setHead(e.target.value)}
          rows={12}
          spellCheck={false}
          className="mt-2 w-full rounded-[6px] border border-hair bg-[#05060a] p-4 font-mono text-body-sm leading-relaxed text-ink focus:border-gold focus:outline-none"
        />
      </label>

      <label className="mt-6 block">
        <span className="font-mono text-label uppercase text-muted">
          Footer code (noscript tags, chat widget)
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          spellCheck={false}
          className="mt-2 w-full rounded-[6px] border border-hair bg-[#05060a] p-4 font-mono text-body-sm leading-relaxed text-ink focus:border-gold focus:outline-none"
        />
      </label>

      <div className="mt-6 flex items-center gap-5">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="tap rounded-[3px] bg-brand-gradient px-8 py-3 text-body font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60"
        >
          {saving ? "Saving" : "Save and publish"}
        </button>
        {status && (
          <p className={`text-body-sm ${status.kind === "ok" ? "text-green" : "text-error"}`}>
            {status.msg}
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Screen 2: Pages                                                   */
/* ---------------------------------------------------------------- */
function PagesScreen() {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(url);
      setTimeout(() => setCopied(null), 1600);
    });
  }

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-h3 text-ink">Pages</h1>
      <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
        Every page the website ships. Pages marked direct link only are not
        in the navigation; this list is where you get their links.
      </p>
      <ul className="mt-8 overflow-hidden rounded-card border border-hair">
        {sitePages.map((p) => {
          const url = `${site.url}${p.path}`;
          return (
            <li
              key={p.path}
              className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-hair bg-surface px-5 py-4 first:border-t-0"
            >
              <div className="min-w-0">
                <p className="text-body font-semibold text-ink">
                  {p.name}
                  {p.note && (
                    <span className="ml-3 inline-flex rounded-full border border-hair bg-canvas px-2.5 py-0.5 font-mono text-label uppercase text-dim">
                      {p.note}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 font-mono text-body-sm text-muted">{url}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => copy(url)}
                  className="tap rounded-[3px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
                >
                  {copied === url ? "Copied" : "Copy link"}
                </button>
                <a
                  href={p.path}
                  target="_blank"
                  rel="noopener"
                  className="tap rounded-[3px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
                >
                  Open
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Shell                                                             */
/* ---------------------------------------------------------------- */
export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("code");
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return null;
  if (!session) return <Login onError={setLoginError} error={loginError} />;

  const items: { key: View; label: string }[] = [
    { key: "code", label: "Header & Footer Code" },
    { key: "pages", label: "Pages" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {/* top bar */}
      <header className="flex items-center justify-between border-b border-hair bg-surface px-6 py-4">
        <p className="font-display text-body font-bold">
          GHL VIDEO <span className="font-mono text-label uppercase text-muted">/ Site Admin</span>
        </p>
        <div className="flex items-center gap-4">
          <span className="hidden font-mono text-label text-dim sm:inline">
            {session.user.email}
          </span>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="tap rounded-[3px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        {/* side menu */}
        <nav className="border-b border-hair bg-surface/50 p-4 md:w-64 md:border-b-0 md:border-r">
          <ul className="flex gap-2 md:flex-col">
            {items.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => setView(item.key)}
                  className={`tap w-full rounded-[6px] px-4 py-2.5 text-left text-body transition-colors ${
                    view === item.key
                      ? "bg-gold/15 font-semibold text-gold"
                      : "text-muted hover:bg-white/[0.04] hover:text-ink"
                  }`}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* content */}
        <section className="flex-1 p-6 md:p-10">
          {view === "code" ? <CodeScreen /> : <PagesScreen />}
        </section>
      </div>
    </div>
  );
}
