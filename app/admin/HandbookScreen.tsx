"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { authHeader, when } from "./client";
import type { HandbookPage } from "@/lib/handbook";

/*
 * The team handbook.
 *
 * Written guidance plus facts read live from the systems that own them, so
 * the half that can go stale is the half a person has to think about anyway.
 * Search covers everything, because somebody with a question types the word
 * they have in their head, not the page they think it lives on.
 */

type Facts = { columns: string[]; rows: string[][] };
type Payload = {
  pages: HandbookPage[];
  facts: Record<string, Facts>;
  recent: { title: string; body: string; at: string }[];
};

const WHO_TONE: Record<string, string> = {
  Everyone: "border-hair text-muted",
  Studio: "border-gold/50 text-gold",
  Sales: "border-blue/50 text-blue",
  Owner: "border-green/50 text-green",
};

export function HandbookScreen() {
  const [data, setData] = useState<Payload | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/handbook", { headers: await authHeader() });
      const j = await r.json();
      if (!r.ok) return setErr(j.error ?? "Could not load the handbook.");
      setData(j as Payload);
    } catch {
      setErr("Could not load the handbook.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* Search the written words AND the live facts, so "how many revisions" finds
     the policy table even though that sentence is nowhere in the prose. */
  const hits = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    if (!term) return data.pages;
    return data.pages.filter((p) => {
      const text = [
        p.title,
        p.summary,
        ...p.blocks.flatMap((b) =>
          b.kind === "text"
            ? [b.body]
            : b.kind === "steps"
              ? b.steps.flatMap((s) => [s.title, s.body])
              : [
                  b.intro ?? "",
                  ...(data.facts[b.id]?.columns ?? []),
                  ...(data.facts[b.id]?.rows ?? []).flat(),
                ],
        ),
      ].join(" ");
      return text.toLowerCase().includes(term);
    });
  }, [data, q]);

  if (err) return <p className="text-body text-error">{err}</p>;
  if (!data) return <p className="text-body text-muted">Loading the handbook...</p>;

  const page = open ? data.pages.find((p) => p.slug === open) : null;

  if (page) {
    return (
      <div className="w-full">
        <button
          type="button"
          onClick={() => setOpen(null)}
          className="tap font-mono text-label uppercase text-muted transition-colors hover:text-gold"
        >
          &larr; All topics
        </button>
        <h1 className="mt-4 font-display text-h2 text-ink">{page.title}</h1>
        <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">{page.summary}</p>

        <div className="mt-8 grid max-w-[var(--measure-lede)] gap-6">
          {page.blocks.map((b, i) => {
            if (b.kind === "text")
              return (
                <p key={i} className="text-body leading-relaxed text-muted">
                  {b.body}
                </p>
              );

            if (b.kind === "steps")
              return (
                <ol key={i} className="grid gap-3">
                  {b.steps.map((s, j) => (
                    <li key={j} className="rounded-[12px] border border-hair bg-surface p-4">
                      <div className="flex items-baseline gap-3">
                        <span className="font-mono text-label font-bold text-gold/70">
                          {String(j + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <p className="text-body font-semibold text-ink">{s.title}</p>
                          <p className="mt-1 text-body-sm leading-relaxed text-muted">{s.body}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              );

            const f = data.facts[b.id];
            if (!f?.rows?.length) return null;
            return (
              <div key={i}>
                {b.intro && <p className="mb-3 text-body text-muted">{b.intro}</p>}
                <div className="overflow-x-auto rounded-[12px] border border-hair">
                  <table className="w-full min-w-[36rem] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-hair bg-surface">
                        {f.columns.map((c) => (
                          <th
                            key={c}
                            className="px-4 py-2.5 font-mono text-label uppercase tracking-[0.1em] text-dim"
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {f.rows.map((row, ri) => (
                        <tr key={ri} className="border-b border-hair last:border-0">
                          {row.map((cell, ci) => (
                            <td
                              key={ci}
                              className={`px-4 py-3 align-top text-body-sm ${ci === 0 ? "font-semibold text-ink" : "text-muted"}`}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 font-mono text-label uppercase tracking-[0.1em] text-dim">
                  Read from the system just now, not written down here
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h1 className="font-display text-h2 text-ink">Handbook</h1>
      <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
        How the platform works and what to do at each stage. Anything the system
        already knows, like statuses and policies, is read from it live, so those
        parts cannot fall out of date.
      </p>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search everything: a status, a policy, an email"
        className="tap mt-6 w-full max-w-[28rem] rounded-[8px] border border-hair bg-canvas px-3 py-2 text-body-sm text-ink placeholder:text-dim"
      />

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {hits.map((p) => (
          <button
            key={p.slug}
            type="button"
            onClick={() => setOpen(p.slug)}
            className="tap rounded-[12px] border border-hair bg-surface p-5 text-left transition-colors hover:border-gold/50"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-body font-semibold text-ink">{p.title}</span>
              <span
                className={`rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${WHO_TONE[p.who] ?? WHO_TONE.Everyone}`}
              >
                {p.who}
              </span>
            </div>
            <p className="mt-1.5 text-body-sm text-muted">{p.summary}</p>
          </button>
        ))}
        {hits.length === 0 && (
          <p className="text-body text-muted">Nothing matches that. Try a shorter word.</p>
        )}
      </div>

      {data.recent.length > 0 && !q && (
        <div className="mt-10">
          <h2 className="font-display text-h4 text-ink">What changed recently</h2>
          <p className="mt-1 text-body-sm text-dim">
            Straight from the journal, so there is no second list to keep up.
          </p>
          <ul className="mt-4 grid gap-3">
            {data.recent.map((r, i) => (
              <li key={i} className="border-l-2 border-gold/40 pl-4">
                <p className="text-body-sm font-semibold text-ink">{r.title}</p>
                <p className="mt-0.5 text-body-sm leading-relaxed text-muted">{r.body}</p>
                <p className="mt-1 font-mono text-label uppercase tracking-[0.1em] text-dim">
                  {when(r.at)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
