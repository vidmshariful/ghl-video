"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { authHeader, when } from "./client";
import { sitePages } from "@/lib/pages-list";
import { site } from "@/lib/site";
import {
  DESC_MAX,
  DESC_MIN,
  TITLE_MAX,
  TITLE_MIN,
  type Finding,
  type LinkStatus,
  type PageFacts,
} from "@/lib/seo-audit";

/*
 * SEO: the three things we control ourselves, before any Google account is
 * connected. Health checks the live site and says what is wrong in plain
 * language. Pages edits the title and description Google shows, without a
 * deploy. Redirects forwards a retired URL so its ranking is not thrown away.
 */

type Tab = "health" | "pages" | "redirects";

type SeoPageRow = {
  path: string;
  title: string | null;
  description: string | null;
  og_image: string | null;
  noindex: boolean;
  updated_at: string;
  updated_by: string | null;
};

type RedirectRow = {
  id: string;
  source: string;
  destination: string;
  permanent: boolean;
  active: boolean;
  hits: number;
  last_hit_at: string | null;
  note: string | null;
  created_at: string;
};

type AuditRow = {
  id: string;
  started_at: string;
  pages_checked: number;
  error_count: number;
  warn_count: number;
  findings: Finding[];
  pages: PageFacts[];
};

const field =
  "mt-1.5 w-full rounded-[8px] border border-hair bg-canvas px-3 py-2.5 text-body text-ink focus:border-gold focus:outline-none";
const lab = "font-mono text-label uppercase text-muted";
const btnGold =
  "tap rounded-[8px] bg-brand-gradient px-5 py-2.5 text-body-sm font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60";
const btnGhost =
  "tap rounded-[8px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-50";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(await authHeader()),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const j = (await r.json()) as T & { error?: string };
  if (!r.ok && j.error) throw new Error(j.error);
  return j;
}

export function SeoScreen() {
  const [tab, setTab] = useState<Tab>("health");

  return (
    <div className="w-full">
      <h1 className="font-display text-h2 text-ink">SEO</h1>
      <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
        What Google sees, and what to fix. Health checks the live site, Pages
        edits the words in the search result, Redirects keeps a retired URL
        working.
      </p>

      <div className="mt-6 flex gap-1 border-b border-hair">
        {(
          [
            ["health", "Health"],
            ["pages", "Pages"],
            ["redirects", "Redirects"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`tap rounded-t-[8px] px-4 py-2.5 text-body-sm transition-colors ${
              tab === k
                ? "border border-b-0 border-hair bg-surface font-semibold text-gold"
                : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "health" ? <HealthTab /> : tab === "pages" ? <PagesTab /> : <RedirectsTab />}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Health                                                            */
/* ---------------------------------------------------------------- */

const SEV_STYLE: Record<Finding["severity"], string> = {
  error: "border-error/40 bg-error/10 text-error",
  warn: "border-gold/40 bg-gold/10 text-gold",
  info: "border-hair bg-hair/30 text-muted",
};
const SEV_LABEL: Record<Finding["severity"], string> = {
  error: "Fix now",
  warn: "Worth fixing",
  info: "Note",
};

function HealthTab() {
  const [latest, setLatest] = useState<AuditRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, step: "" });
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<"all" | Finding["severity"]>("all");

  const load = useCallback(async () => {
    try {
      const j = await api<{ latest: AuditRow | null }>("/api/admin/seo/audit");
      setLatest(j.latest);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* The check runs from the browser in small batches: the server measures a
     few pages per call, so a slow page can never time the whole run out and
     the operator watches it move. */
  async function run() {
    setRunning(true);
    setErr("");
    try {
      const plan = await api<{ paths: string[] }>("/api/admin/seo/audit");
      const paths = plan.paths;
      const BATCH = 6;
      const pages: PageFacts[] = [];

      setProgress({ done: 0, total: paths.length, step: "Reading pages" });
      for (let i = 0; i < paths.length; i += BATCH) {
        const slice = paths.slice(i, i + BATCH);
        const j = await api<{ pages: PageFacts[] }>("/api/admin/seo/audit", {
          method: "POST",
          body: JSON.stringify({ mode: "crawl", paths: slice }),
        });
        pages.push(...j.pages);
        setProgress({ done: Math.min(i + BATCH, paths.length), total: paths.length, step: "Reading pages" });
      }

      /* every internal link we found that is not already a page we read */
      const known = new Set(pages.map((p) => p.path.toLowerCase()));
      const targets = [
        ...new Set(
          pages
            .flatMap((p) => p.internalLinks)
            .map((l) => (l.endsWith("/") ? l : `${l}/`))
            .filter((l) => !known.has(l.toLowerCase())),
        ),
      ];
      const links: LinkStatus[] = [];
      setProgress({ done: 0, total: targets.length, step: "Checking links" });
      for (let i = 0; i < targets.length; i += BATCH) {
        const slice = targets.slice(i, i + BATCH);
        const j = await api<{ links: LinkStatus[] }>("/api/admin/seo/audit", {
          method: "POST",
          body: JSON.stringify({ mode: "links", paths: slice }),
        });
        links.push(...j.links);
        setProgress({ done: Math.min(i + BATCH, targets.length), total: targets.length, step: "Checking links" });
      }

      setProgress({ done: 1, total: 1, step: "Writing the report" });
      await api("/api/admin/seo/audit", {
        method: "POST",
        body: JSON.stringify({ mode: "finish", pages, links }),
      });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setRunning(false);
      setProgress({ done: 0, total: 0, step: "" });
    }
  }

  const findings = latest?.findings ?? [];
  const shown = filter === "all" ? findings : findings.filter((f) => f.severity === filter);
  const counts = {
    error: findings.filter((f) => f.severity === "error").length,
    warn: findings.filter((f) => f.severity === "warn").length,
    info: findings.filter((f) => f.severity === "info").length,
  };
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          {latest ? (
            <p className="text-body text-muted">
              Last checked {when(latest.started_at)} across {latest.pages_checked} pages.
            </p>
          ) : (
            <p className="text-body text-muted">
              {loaded ? "The site has not been checked yet." : "Loading..."}
            </p>
          )}
        </div>
        <button type="button" onClick={run} disabled={running} className={btnGold}>
          {running ? "Checking..." : latest ? "Check again" : "Run the check"}
        </button>
      </div>

      {running ? (
        <div className="mt-5 rounded-[12px] border border-hair bg-surface p-5">
          <p className="font-mono text-label uppercase text-muted">
            {progress.step} {progress.total ? `${progress.done} of ${progress.total}` : ""}
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-hair">
            <div className="h-full rounded-full bg-brand-gradient transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}

      {err ? <p className="mt-4 text-body-sm text-error">{err}</p> : null}

      {latest ? (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {(
              [
                ["error", counts.error, "Costing you traffic"],
                ["warn", counts.warn, "Leaving results on the table"],
                ["info", counts.info, "Worth knowing"],
              ] as const
            ).map(([sev, n, line]) => (
              <button
                key={sev}
                type="button"
                onClick={() => setFilter(filter === sev ? "all" : sev)}
                className={`tap rounded-[12px] border p-5 text-left transition-colors ${
                  filter === sev ? "border-gold/60 bg-gold/[0.06]" : "border-hair bg-surface hover:border-gold/40"
                }`}
              >
                <p className="font-display text-h2 text-ink">{n}</p>
                <p className="mt-1 font-mono text-label uppercase text-muted">{SEV_LABEL[sev]}</p>
                <p className="mt-1 text-body-sm text-dim">{line}</p>
              </button>
            ))}
          </div>

          {findings.length === 0 ? (
            <p className="mt-8 rounded-[12px] border border-green/30 bg-green/[0.06] p-6 text-body text-ink">
              Nothing to fix. Every page has its own title and description, the
              links all work, and the sitemap matches the site.
            </p>
          ) : (
            <ul className="mt-6 grid gap-3">
              {shown.map((f) => (
                <li key={f.id} className="rounded-[12px] border border-hair bg-surface p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${SEV_STYLE[f.severity]}`}
                    >
                      {SEV_LABEL[f.severity]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-body font-semibold text-ink">{f.message}</p>
                      <p className="mt-0.5 font-mono text-label uppercase text-gold/80">{f.path}</p>
                      {f.detail ? (
                        <p className="mt-1.5 break-words text-body-sm text-muted">{f.detail}</p>
                      ) : null}
                      {f.fix ? <p className="mt-1.5 text-body-sm text-dim">{f.fix}</p> : null}
                    </div>
                    <a
                      href={f.path}
                      target="_blank"
                      rel="noreferrer"
                      className={`${btnGhost} shrink-0`}
                    >
                      Open
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Pages                                                             */
/* ---------------------------------------------------------------- */

function counterClass(len: number, min: number, max: number): string {
  if (len === 0) return "text-dim";
  if (len > max) return "text-error";
  if (len < min) return "text-gold";
  return "text-green";
}

function PagesTab() {
  const [rows, setRows] = useState<Record<string, SeoPageRow>>({});
  const [live, setLive] = useState<Record<string, PageFacts>>({});
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const [p, a] = await Promise.all([
        api<{ pages: SeoPageRow[] }>("/api/admin/seo/pages"),
        api<{ latest: AuditRow | null }>("/api/admin/seo/audit"),
      ]);
      const map: Record<string, SeoPageRow> = {};
      for (const r of p.pages) map[r.path] = r;
      setRows(map);
      // the last health check measured what each page ACTUALLY renders, which
      // is the honest "current value" to show next to an override field
      const facts: Record<string, PageFacts> = {};
      for (const f of a.latest?.pages ?? []) facts[f.path] = f;
      setLive(facts);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <p className="max-w-[var(--measure-body)] text-body text-muted">
        The blue headline and grey summary Google shows for each page. Leave a
        field empty to keep what the page ships with. Blog posts have their own
        SEO fields inside the post editor.
      </p>
      {err ? <p className="mt-4 text-body-sm text-error">{err}</p> : null}

      <ul className="mt-6 overflow-hidden rounded-[12px] border border-hair">
        {!loaded ? (
          <li className="p-6 text-body-sm text-muted">Loading pages...</li>
        ) : (
          sitePages.map((p) => {
            const row = rows[p.path];
            const custom = Boolean(row?.title || row?.description || row?.og_image);
            const hidden = p.noindex || row?.noindex;
            return (
              <li key={p.path} className="border-t border-hair bg-surface/40 first:border-t-0">
                <button
                  type="button"
                  onClick={() => setOpen(open === p.path ? null : p.path)}
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 p-4 text-left"
                >
                  <div className="min-w-[12rem] flex-1">
                    <p className="font-semibold text-ink">{p.name}</p>
                    <p className="font-mono text-label uppercase text-dim">{p.path}</p>
                  </div>
                  {hidden ? (
                    <span className="rounded-full border border-hair px-2.5 py-0.5 font-mono text-label uppercase text-dim">
                      Hidden from Google
                    </span>
                  ) : null}
                  <span
                    className={`rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${
                      custom ? "border-gold/40 bg-gold/10 text-gold" : "border-hair text-muted"
                    }`}
                  >
                    {custom ? "Custom" : "Default"}
                  </span>
                </button>
                {open === p.path ? (
                  <PageEditor
                    path={p.path}
                    name={p.name}
                    row={row ?? null}
                    facts={live[p.path] ?? null}
                    codeNoindex={p.noindex === true}
                    onSaved={() => {
                      setOpen(null);
                      load();
                    }}
                  />
                ) : null}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function PageEditor({
  path,
  name,
  row,
  facts,
  codeNoindex,
  onSaved,
}: {
  path: string;
  name: string;
  row: SeoPageRow | null;
  facts: PageFacts | null;
  codeNoindex: boolean;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(row?.title ?? "");
  const [description, setDescription] = useState(row?.description ?? "");
  const [ogImage, setOgImage] = useState(row?.og_image ?? "");
  const [noindex, setNoindex] = useState(row?.noindex ?? false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const previewTitle = title || facts?.title || `${name} | GHL Video`;
  const previewDesc =
    description || facts?.description || "Google will write this line itself until you set one.";

  async function save() {
    setBusy(true);
    setErr("");
    try {
      await api("/api/admin/seo/pages", {
        method: "PUT",
        body: JSON.stringify({ path, title, description, og_image: ogImage, noindex }),
      });
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  async function reset() {
    if (!window.confirm(`Clear the custom SEO for ${path} and use the page's built-in wording?`)) return;
    setBusy(true);
    setErr("");
    try {
      await api("/api/admin/seo/pages", { method: "DELETE", body: JSON.stringify({ path }) });
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 border-t border-hair bg-canvas/40 p-5 lg:grid-cols-2">
      <div className="grid content-start gap-4">
        <label className="block">
          <span className={lab}>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} placeholder="Leave empty to keep the built-in title" />
          <span className={`mt-1 block font-mono text-label uppercase ${counterClass(title.length, TITLE_MIN, TITLE_MAX)}`}>
            {title.length} characters {title.length ? `/ aim for ${TITLE_MIN} to ${TITLE_MAX}` : ""}
          </span>
        </label>
        <label className="block">
          <span className={lab}>Description</span>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${field} resize-y`}
            placeholder="Leave empty to keep the built-in description"
          />
          <span className={`mt-1 block font-mono text-label uppercase ${counterClass(description.length, DESC_MIN, DESC_MAX)}`}>
            {description.length} characters {description.length ? `/ aim for ${DESC_MIN} to ${DESC_MAX}` : ""}
          </span>
        </label>
        <label className="block">
          <span className={lab}>Share image (optional)</span>
          <input value={ogImage} onChange={(e) => setOgImage(e.target.value)} className={field} placeholder="https://... or /og.png" />
        </label>
        <label className="flex items-center gap-2.5 text-body-sm text-ink">
          <input
            type="checkbox"
            checked={noindex || codeNoindex}
            disabled={codeNoindex}
            onChange={(e) => setNoindex(e.target.checked)}
            className="h-4 w-4 accent-[#FCC000]"
          />
          Hide this page from Google
          {codeNoindex ? (
            <span className="font-mono text-label uppercase text-dim">already hidden in the page itself</span>
          ) : null}
        </label>
        {err ? <p className="text-body-sm text-error">{err}</p> : null}
        <div className="flex items-center gap-3">
          <button type="button" onClick={save} disabled={busy} className={btnGold}>
            {busy ? "Saving..." : "Save"}
          </button>
          {row ? (
            <button type="button" onClick={reset} disabled={busy} className={btnGhost}>
              Reset to default
            </button>
          ) : null}
          <a href={path} target="_blank" rel="noreferrer" className={btnGhost}>
            View page
          </a>
        </div>
      </div>

      {/* what the search result will look like */}
      <div>
        <p className={lab}>Google preview</p>
        <div className="mt-2 rounded-[12px] border border-hair bg-surface p-5">
          <p className="truncate font-mono text-label text-muted">
            {site.url.replace(/^https?:\/\//, "")}
            {path}
          </p>
          <p className="mt-1.5 line-clamp-2 text-[18px] leading-snug text-blue">{previewTitle}</p>
          <p className="mt-1.5 line-clamp-2 text-body-sm text-muted">{previewDesc}</p>
        </div>
        <p className="mt-3 text-body-sm text-dim">
          Google decides the final wording, but this is what it has to work
          with. A saved change is live on the page within a minute.
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Redirects                                                         */
/* ---------------------------------------------------------------- */

function RedirectsTab() {
  const [rows, setRows] = useState<RedirectRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [note, setNote] = useState("");
  const [permanent, setPermanent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [warning, setWarning] = useState("");

  const load = useCallback(async () => {
    try {
      const j = await api<{ redirects: RedirectRow[] }>("/api/admin/seo/redirects");
      setRows(j.redirects);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add(confirm = false) {
    setBusy(true);
    setErr("");
    if (!confirm) setWarning("");
    try {
      const r = await fetch("/api/admin/seo/redirects", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ source, destination, permanent, note, confirm }),
      });
      const j = (await r.json()) as { error?: string; warning?: string; needsConfirm?: boolean };
      if (r.status === 409 && j.needsConfirm) {
        setWarning(j.warning ?? "That path is a live page.");
        setBusy(false);
        return;
      }
      if (!r.ok) throw new Error(j.error ?? "Could not save the rule.");
      setSource("");
      setDestination("");
      setNote("");
      setWarning("");
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(row: RedirectRow) {
    try {
      await api("/api/admin/seo/redirects", {
        method: "PATCH",
        body: JSON.stringify({ id: row.id, active: !row.active }),
      });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function remove(row: RedirectRow) {
    if (!window.confirm(`Delete the rule for ${row.source}? That URL will start returning "not found" again.`)) return;
    try {
      await api("/api/admin/seo/redirects", {
        method: "DELETE",
        body: JSON.stringify({ id: row.id }),
      });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const used = useMemo(() => rows.reduce((n, r) => n + r.hits, 0), [rows]);

  return (
    <div>
      <p className="max-w-[var(--measure-body)] text-body text-muted">
        Send an old URL to its replacement so the ranking and any links pointing
        at it carry over instead of hitting a dead page. No deploy needed: a new
        rule is working within a minute. Use Test to check it.
      </p>

      <div className="mt-6 rounded-[12px] border border-hair bg-surface p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className={lab}>Old URL on this site</span>
            <input value={source} onChange={(e) => setSource(e.target.value)} className={field} placeholder="/old-page" />
          </label>
          <label className="block">
            <span className={lab}>Send visitors to</span>
            <input value={destination} onChange={(e) => setDestination(e.target.value)} className={field} placeholder="/new-page/ or https://..." />
          </label>
          <label className="block md:col-span-2">
            <span className={lab}>Note (optional)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} className={field} placeholder="Why this exists, for whoever reads it later" />
          </label>
        </div>
        <label className="mt-4 flex items-center gap-2.5 text-body-sm text-ink">
          <input type="checkbox" checked={permanent} onChange={(e) => setPermanent(e.target.checked)} className="h-4 w-4 accent-[#FCC000]" />
          Permanent (301). Uncheck only if the old URL is coming back.
        </label>

        {warning ? (
          <div className="mt-4 rounded-[8px] border border-error/40 bg-error/[0.07] p-4">
            <p className="text-body-sm text-ink">{warning}</p>
            <button type="button" onClick={() => add(true)} disabled={busy} className={`${btnGhost} mt-3`}>
              I understand, add it anyway
            </button>
          </div>
        ) : null}
        {err ? <p className="mt-3 text-body-sm text-error">{err}</p> : null}

        <button
          type="button"
          onClick={() => add(false)}
          disabled={busy || !source.trim() || !destination.trim()}
          className={`${btnGold} mt-4`}
        >
          {busy ? "Saving..." : "Add redirect"}
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-[12px] border border-hair">
        {!loaded ? (
          <p className="p-6 text-body-sm text-muted">Loading rules...</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-body-sm text-muted">
            No rules yet. The redirects from the old WordPress site live in the
            code and keep working on their own.
          </p>
        ) : (
          <ul className="divide-y divide-hair">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-surface/40 p-4">
                <div className="min-w-[14rem] flex-1">
                  <p className="break-all text-body text-ink">
                    <span className="font-mono text-body-sm text-gold">{r.source}</span>
                    <span className="mx-2 text-dim">to</span>
                    <span className="font-mono text-body-sm">{r.destination}</span>
                  </p>
                  <p className="mt-0.5 font-mono text-label uppercase text-dim">
                    {r.permanent ? "301 permanent" : "302 temporary"} / used {r.hits}{" "}
                    {r.hits === 1 ? "time" : "times"}
                    {r.last_hit_at ? ` / last ${when(r.last_hit_at)}` : ""}
                    {r.note ? ` / ${r.note}` : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${
                    r.active ? "border-green/40 bg-green/10 text-green" : "border-hair text-dim"
                  }`}
                >
                  {r.active ? "On" : "Off"}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <a href={r.source} target="_blank" rel="noreferrer" className={btnGhost}>
                    Test
                  </a>
                  <button type="button" onClick={() => toggle(r)} className={btnGhost}>
                    {r.active ? "Turn off" : "Turn on"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(r)}
                    className="tap rounded-[8px] border border-hair px-4 py-2 font-mono text-label uppercase text-dim transition-colors hover:border-error/60 hover:text-error"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {rows.length > 0 ? (
        <p className="mt-3 text-body-sm text-dim">
          {used} visit{used === 1 ? "" : "s"} rescued by these rules so far.
        </p>
      ) : null}
    </div>
  );
}
