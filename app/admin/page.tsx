"use client";

import { type Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { sitePages } from "@/lib/pages-list";
import { site } from "@/lib/site";
import { supabase } from "./client";
import type { View } from "./nav";
import { DashboardScreen } from "./DashboardScreen";
import { OrdersScreen } from "./OrdersScreen";
import { SubscriptionsScreen } from "./SubscriptionsScreen";
import { ProductsScreen } from "./ProductsScreen";
import { CustomersScreen } from "./CustomersScreen";

/*
 * The managing area: /admin. Supabase Auth login, a sidebar, and one
 * screen per concern: Dashboard, Orders, Products, Customers, plus the
 * site tools (Header & Footer Code, Pages, Video List). Reads/writes run
 * through the shared client and are enforced by row-level security.
 * Screens live in their own files; this file is the shell + login + the
 * three site-tool screens.
 */

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
/* Screen 3: Video List (staging store: does NOT touch the website)  */
/* ---------------------------------------------------------------- */
type VideoRow = {
  id: number;
  title: string;
  library: "new" | "classic";
  video_type: string;
  category: string;
  video_url: string;
  checkout_url: string;
  price: number | null;
  on_site: boolean;
  notes: string;
};

const VIDEO_TYPES = [
  "Explainer",
  "Feature Explainer",
  "Demo",
  "Ads / Promo",
  "Animated GIF",
  "Short Explainer",
  "Marketing",
  "Feature Animation",
];

const EMPTY_VIDEO: Omit<VideoRow, "id"> = {
  title: "",
  library: "new",
  video_type: "Explainer",
  category: "",
  video_url: "",
  checkout_url: "",
  price: null,
  on_site: false,
  notes: "",
};

function VideoForm({
  initial,
  onDone,
  onCancel,
}: {
  initial: Partial<VideoRow>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState({ ...EMPTY_VIDEO, ...initial });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, val: unknown) => setV((x) => ({ ...x, [k]: val }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const payload = {
      title: v.title,
      library: v.library,
      video_type: v.video_type,
      category: v.category,
      video_url: v.video_url,
      checkout_url: v.checkout_url,
      price: v.price === null || (v.price as unknown) === "" ? null : Number(v.price),
      notes: v.notes,
      updated_at: new Date().toISOString(),
    };
    const q = supabase.from("videos");
    const { error } = "id" in initial && initial.id
      ? await q.update(payload).eq("id", initial.id)
      : await q.insert({ ...payload, on_site: false });
    if (error) { setErr(error.message); setBusy(false); return; }
    onDone();
  }

  const field =
    "mt-1.5 w-full rounded-[3px] border border-hair bg-canvas px-3 py-2.5 text-body text-ink focus:border-gold focus:outline-none";
  const lab = "font-mono text-label uppercase text-muted";

  return (
    <form onSubmit={save} className="rounded-card border border-gold/40 bg-surface p-6">
      <p className="font-display text-h4 font-semibold text-ink">
        {"id" in initial && initial.id ? "Edit video" : "Add a video"}
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className={lab}>Title</span>
          <input required value={v.title} onChange={(e) => set("title", e.target.value)} className={field} />
        </label>
        <label>
          <span className={lab}>Library</span>
          <select value={v.library} onChange={(e) => set("library", e.target.value)} className={field}>
            <option value="new">New Library</option>
            <option value="classic">Classic Library</option>
          </select>
        </label>
        <label>
          <span className={lab}>Video type</span>
          <select value={v.video_type} onChange={(e) => set("video_type", e.target.value)} className={field}>
            {VIDEO_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          <span className={lab}>Category</span>
          <input list="video-categories" value={v.category} onChange={(e) => set("category", e.target.value)} className={field} placeholder="All-in-one, AI Receptionist..." />
          <datalist id="video-categories">
            {["All-in-one", "AI Receptionist", "Unified Inbox", "Reputation Management", "Full platform overview"].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label>
          <span className={lab}>Price (USD)</span>
          <input type="number" min="0" value={v.price ?? ""} onChange={(e) => set("price", e.target.value === "" ? null : Number(e.target.value))} className={field} />
        </label>
        <label className="sm:col-span-2">
          <span className={lab}>Video link (preview / Wistia / mp4)</span>
          <input value={v.video_url} onChange={(e) => set("video_url", e.target.value)} className={field} placeholder="https://..." />
        </label>
        <label className="sm:col-span-2">
          <span className={lab}>Checkout link</span>
          <input value={v.checkout_url} onChange={(e) => set("checkout_url", e.target.value)} className={field} placeholder="https://order.ghlvideo.com/..." />
        </label>
        <label className="sm:col-span-2">
          <span className={lab}>Notes</span>
          <input value={v.notes} onChange={(e) => set("notes", e.target.value)} className={field} />
        </label>
      </div>
      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}
      <div className="mt-5 flex gap-3">
        <button type="submit" disabled={busy} className="tap rounded-[3px] bg-brand-gradient px-6 py-2.5 text-body font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60">
          {busy ? "Saving" : "Save video"}
        </button>
        <button type="button" onClick={onCancel} className="tap rounded-[3px] border border-hair px-6 py-2.5 text-body text-muted transition-colors hover:text-ink">
          Cancel
        </button>
      </div>
    </form>
  );
}

function VideosScreen() {
  const [rows, setRows] = useState<VideoRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<VideoRow | "new" | null>(null);
  const [err, setErr] = useState("");

  async function load() {
    const { data, error } = await supabase
      .from("videos")
      .select("*")
      .order("library", { ascending: true })
      .order("video_type", { ascending: true })
      .order("title", { ascending: true });
    if (error) setErr(error.message);
    else setRows(data as VideoRow[]);
    setLoaded(true);
  }
  useEffect(() => { load(); }, []);

  async function remove(row: VideoRow) {
    if (!window.confirm(`Delete "${row.title}" from the list?`)) return;
    const { error } = await supabase.from("videos").delete().eq("id", row.id);
    if (error) setErr(error.message);
    else load();
  }

  if (!loaded) return <p className="text-body text-muted">Loading videos...</p>;

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-h3 text-ink">Video List</h1>
          <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
            The master list: every video with its preview link and checkout
            link. {rows.length} videos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="tap rounded-[3px] bg-brand-gradient px-6 py-2.5 text-body font-semibold text-canvas transition-all hover:brightness-110"
        >
          Add video
        </button>
      </div>

      <div className="mt-4 rounded-[8px] border border-gold/30 bg-gold/[0.06] px-4 py-3 text-body-sm text-muted">
        Changes here do <b className="text-gold">not</b> update the website.
        This is the staging list: add or edit videos, then tell Claude Code
        to update the website to match this list.
      </div>

      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}

      {editing && (
        <div className="mt-6">
          <VideoForm
            initial={editing === "new" ? {} : editing}
            onDone={() => { setEditing(null); load(); }}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {/* two main categories, sub-grouped by video type */}
      {(
        [
          ["new", "New Videos"],
          ["classic", "Classic Old Videos"],
        ] as const
      ).map(([lib, libLabel]) => {
        const libRows = rows.filter((r) => r.library === lib);
        if (!libRows.length) return null;
        const typeIdx = (t: string) => {
          const i = VIDEO_TYPES.indexOf(t);
          return i === -1 ? VIDEO_TYPES.length : i;
        };
        const types = [...new Set(libRows.map((r) => r.video_type))].sort(
          (a, b) => typeIdx(a) - typeIdx(b),
        );
        return (
          <section key={lib} className="mt-10">
            <div className="flex items-baseline gap-3 border-b border-hair pb-3">
              <h2 className="font-display text-h4 font-semibold text-ink">
                {libLabel}
              </h2>
              <span className="font-mono text-label uppercase text-dim">
                {libRows.length} videos
              </span>
            </div>
            {types.map((t) => {
              const typeRows = libRows.filter((r) => r.video_type === t);
              return (
                <div key={t} className="mt-6">
                  <p className="font-mono text-label uppercase text-gold">
                    {t || "Untyped"}{" "}
                    <span className="text-dim">{typeRows.length}</span>
                  </p>
                  <ul className="mt-2.5 overflow-hidden rounded-card border border-hair">
                    {typeRows.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-hair bg-surface px-5 py-3.5 first:border-t-0">
                        <div className="min-w-0">
                          <p className="text-body font-semibold text-ink">
                            {r.title}
                            {r.price != null && (
                              <span className="ml-3 font-mono text-body-sm text-gold">${r.price}</span>
                            )}
                            {!r.on_site && (
                              <span className="ml-3 inline-flex rounded-full border border-gold/40 bg-canvas px-2.5 py-0.5 font-mono text-label uppercase text-gold">
                                not on site
                              </span>
                            )}
                          </p>
                          {(r.category || r.notes) && (
                            <p className="mt-0.5 font-mono text-label uppercase text-dim">
                              {r.category}
                              {r.category && r.notes ? " / " : ""}
                              {r.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {r.video_url && (
                            <a href={r.video_url} target="_blank" rel="noopener" className="tap rounded-[3px] border border-hair px-3.5 py-1.5 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold">
                              Video
                            </a>
                          )}
                          {r.checkout_url && (
                            <a href={r.checkout_url} target="_blank" rel="noopener" className="tap rounded-[3px] border border-hair px-3.5 py-1.5 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold">
                              Checkout
                            </a>
                          )}
                          <button type="button" onClick={() => setEditing(r)} className="tap rounded-[3px] border border-hair px-3.5 py-1.5 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold">
                            Edit
                          </button>
                          <button type="button" onClick={() => remove(r)} className="tap rounded-[3px] border border-hair px-3.5 py-1.5 font-mono text-label uppercase text-dim transition-colors hover:border-error/60 hover:text-error">
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Shell                                                             */
/* ---------------------------------------------------------------- */
export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Being logged in is not enough: this area is for the admins allowlist.
  useEffect(() => {
    if (!session) {
      setIsAdmin(null);
      return;
    }
    supabase.rpc("is_admin").then(({ data }) => setIsAdmin(data === true));
  }, [session]);

  if (!ready) return null;
  if (!session) return <Login onError={setLoginError} error={loginError} />;
  if (isAdmin === null) return null;
  if (!isAdmin)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-display text-h3 text-ink">Not authorized</p>
        <p className="max-w-sm text-body text-muted">
          {session.user.email} is not an admin. If you are a customer, your area
          is at <span className="text-gold">/portal</span>.
        </p>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="tap rounded-[3px] border border-hair px-5 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
        >
          Sign out
        </button>
      </div>
    );

  const items: { key: View; label: string }[] = [
    { key: "dashboard", label: "Dashboard" },
    { key: "orders", label: "Orders" },
    { key: "subscriptions", label: "Subscriptions" },
    { key: "products", label: "Products & Pricing" },
    { key: "customers", label: "Customers" },
    { key: "code", label: "Header & Footer Code" },
    { key: "pages", label: "Pages" },
    { key: "videos", label: "Video List" },
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
          {view === "dashboard" ? (
            <DashboardScreen onNavigate={setView} />
          ) : view === "orders" ? (
            <OrdersScreen />
          ) : view === "subscriptions" ? (
            <SubscriptionsScreen />
          ) : view === "products" ? (
            <ProductsScreen />
          ) : view === "customers" ? (
            <CustomersScreen />
          ) : view === "code" ? (
            <CodeScreen />
          ) : view === "pages" ? (
            <PagesScreen />
          ) : (
            <VideosScreen />
          )}
        </section>
      </div>
    </div>
  );
}
