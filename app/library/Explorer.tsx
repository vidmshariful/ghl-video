"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LibraryCard, PreviewLightbox } from "@/components/library/cards";
import { PickTray } from "@/components/library/tray";
import type { BrowseVideo, Version } from "@/components/library/catalog";
import { featureCounts, matchFeature, type LibraryFeature } from "@/lib/library-features";

/*
 * The public library's filters, as one rule: a SCOPE and a SELECTION.
 *
 * The scope is which library you are in, All, New or Classic, and it
 * persists while everything else changes. The selection is exactly one of
 * everything else: a video type, a collection, one of the ranked shelves
 * (Featured, Most popular, Most loved), or one HighLevel feature. Picking
 * any selection replaces the previous one, whatever group it came from.
 *
 * That rule exists because the composed version shipped first and read as
 * broken: Featured plus Feature Explainer quietly showed featured feature
 * explainers, and the owner's honest reading was "where did my featured
 * videos go". One selection at a time is what the page's own controls
 * suggest, so it is what they do.
 *
 * The search box is gone by the same reasoning: it did not earn its row
 * against filters that already cover how people actually look.
 */

type Stats = Record<string, { loves: number; plays: number }>;

type Scope = "all" | "new" | "classic";

type Selection =
  | { kind: "type"; value: string }
  | { kind: "collection"; value: "pack" | "bundle" }
  | { kind: "ranked"; value: "featured" | "popular" | "loved" }
  | { kind: "hl"; value: string }
  | null;

const RANKED: { key: "featured" | "popular" | "loved"; label: string; blurb: string }[] = [
  { key: "featured", label: "Featured videos", blurb: "what the studio puts forward" },
  { key: "popular", label: "Most popular", blurb: "watched the most, right here" },
  { key: "loved", label: "Most loved", blurb: "ranked by the hearts" },
];

/* the types row keeps the shop's own order, then anything new the catalogue
 * grows gets appended rather than lost */
const VIDEO_TYPE_ORDER = ["Full Explainer", "Demo", "Feature Explainer", "Marketing", "Feature Animation"];

const SCOPES: { key: Scope; label: string; tip: string | null }[] = [
  { key: "all", label: "All", tip: null },
  { key: "new", label: "New Videos", tip: "The current library, made for today's HighLevel." },
  { key: "classic", label: "Classic Videos", tip: "The earlier library, proven and still brandable." },
];

const LOVED_KEY = "ghlv-loved";

const kindOf = (v: BrowseVideo) => (v.kind ?? "video") as "video" | "pack" | "bundle";
const featureText = (v: BrowseVideo) => `${v.title} ${v.subtitle ?? ""} ${v.typeTag ?? ""}`;

/* one filter chip. Selected is flat gold, deliberately: on a dark canvas the
 * old dark-on-dark active state was the thing nobody could find. */
function Pill({
  active,
  onClick,
  children,
  tip,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tip?: string | null;
}) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={`tap whitespace-nowrap rounded-[8px] border px-3 py-1.5 text-body-sm transition-colors ${
          active
            ? "border-gold bg-gold font-semibold text-canvas"
            : "border-hair bg-surface text-muted hover:border-gold/50 hover:text-ink"
        }`}
      >
        {children}
      </button>
      {tip && (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-[6px] border border-chrome-line bg-chrome px-2.5 py-1.5 font-mono text-label text-chrome-text shadow-lg group-focus-within:block group-hover:block"
        >
          {tip}
        </span>
      )}
    </span>
  );
}

export function LibraryExplorer({
  videos,
  stats: initialStats,
  features,
}: {
  videos: BrowseVideo[];
  stats: Stats;
  /* the Filter by feature vocabulary, from admin's table */
  features: LibraryFeature[];
}) {
  const [scope, setScope] = useState<Scope>("all");
  const [sel, setSel] = useState<Selection>(null);
  const [allFeatures, setAllFeatures] = useState(false);
  const [preview, setPreview] = useState<{ video: BrowseVideo; version: Version } | null>(null);

  /* counters, optimistic on top of what the server rendered */
  const [stats, setStats] = useState<Stats>(initialStats);
  const [loved, setLoved] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    try {
      const kept = JSON.parse(localStorage.getItem(LOVED_KEY) ?? "[]");
      if (Array.isArray(kept)) setLoved(new Set(kept.filter((c) => typeof c === "string")));
    } catch {
      /* fresh start */
    }
  }, []);

  const react = useCallback((code: string, action: "love" | "unlove" | "play") => {
    void fetch("/api/library/react", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, action }),
      keepalive: true,
    })
      .then((r) => r.json())
      .then((j) => {
        if (typeof j.loves === "number") {
          setStats((s) => ({ ...s, [code]: { loves: j.loves, plays: j.plays ?? s[code]?.plays ?? 0 } }));
        }
      })
      .catch(() => null);
  }, []);

  function toggleLove(code: string) {
    const isLoved = loved.has(code);
    const next = new Set(loved);
    if (isLoved) next.delete(code);
    else next.add(code);
    setLoved(next);
    try {
      localStorage.setItem(LOVED_KEY, JSON.stringify([...next]));
    } catch {
      /* private mode: the heart still counts, it just will not be remembered */
    }
    setStats((s) => ({
      ...s,
      [code]: {
        loves: Math.max(0, (s[code]?.loves ?? 0) + (isLoved ? -1 : 1)),
        plays: s[code]?.plays ?? 0,
      },
    }));
    react(code, isLoved ? "unlove" : "love");
  }

  const openPreview = (video: BrowseVideo, version: Version) => {
    setPreview({ video, version });
    react(video.code ?? video.slug, "play");
  };

  /* the scope narrows everything, including which filters offer themselves */
  const inScope = useMemo(
    () =>
      videos.filter((v) =>
        scope === "all" ? true : v.subTag === (scope === "new" ? "New" : "Classic"),
      ),
    [videos, scope],
  );

  const videoTypes = useMemo(() => {
    const present = new Set(inScope.filter((v) => kindOf(v) === "video").map((v) => v.typeTag));
    return [
      ...VIDEO_TYPE_ORDER.filter((t) => present.has(t)),
      ...[...present].filter((t) => !VIDEO_TYPE_ORDER.includes(t)).sort(),
    ];
  }, [inScope]);

  const hlFeatures = useMemo(
    () => featureCounts(inScope, featureText, features),
    [inScope, features],
  );

  const shown = useMemo(() => {
    const base = inScope.filter((v) => {
      if (!sel) return true;
      if (sel.kind === "type") return kindOf(v) === "video" && v.typeTag === sel.value;
      if (sel.kind === "collection") return kindOf(v) === sel.value;
      if (sel.kind === "ranked") return sel.value === "featured" ? Boolean(v.featured) : true;
      const f = features.find((x) => x.key === sel.value);
      return f ? matchFeature(featureText(v), f.aliases) : true;
    });
    const of = (v: BrowseVideo) => stats[v.code ?? v.slug];
    if (sel?.kind === "ranked" && sel.value === "popular")
      return [...base].sort((a, b) => (of(b)?.plays ?? 0) - (of(a)?.plays ?? 0));
    if (sel?.kind === "ranked" && sel.value === "loved")
      return [...base].sort((a, b) => (of(b)?.loves ?? 0) - (of(a)?.loves ?? 0));
    return base;
  }, [inScope, sel, features, stats]);

  const filtering = sel !== null || scope !== "all";

  const scopeCount = (k: Scope) =>
    k === "all"
      ? videos.length
      : videos.filter((v) => v.subTag === (k === "new" ? "New" : "Classic")).length;

  /* one selection at a time: choosing anything replaces whatever was there */
  const choose = (next: Selection) =>
    setSel((cur) => (JSON.stringify(cur) === JSON.stringify(next) ? null : next));

  const pickedItems = picked
    .map((slug) => videos.find((v) => v.slug === slug))
    .filter((v): v is BrowseVideo => Boolean(v));

  const togglePick = (slug: string) =>
    setPicked((p) => (p.includes(slug) ? p.filter((s) => s !== slug) : [...p, slug]));

  const share = async (codes: string[]): Promise<string | null> => {
    try {
      const r = await fetch("/api/library/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes }),
      });
      const j = await r.json();
      return r.ok ? (j.href as string) : null;
    } catch {
      return null;
    }
  };

  const headerBlurb =
    sel?.kind === "ranked"
      ? RANKED.find((r) => r.key === sel.value)?.blurb
      : "newest first, then the classics";

  return (
    <div className="mx-auto w-full max-w-[100rem] px-4 pb-28 md:px-8">
      <div className="pb-6 pt-10 md:pt-14">
        <p className="font-mono text-label uppercase tracking-[0.14em] text-dim">The library</p>
        <h1 className="mt-2 font-display text-h2 tracking-tight text-ink">
          Every video, ready for your brand
        </h1>
        <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
          Watch anything before you buy it. Love the ones you like, pick a few
          to share with your team, and order a single video or a pack. No
          account needed.
        </p>
      </div>

      {/* one line: which library on the left, what kind of thing on the
          right, a separator keeping videos and collections apart. Ruled top
          and bottom so the bar reads as the instrument panel it is. */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-y border-hair py-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {SCOPES.map((s) => (
            <Pill key={s.key} active={scope === s.key} onClick={() => setScope(s.key)} tip={s.tip}>
              {s.label}
              <span
                className={`ml-1.5 font-mono text-label tabular-nums ${scope === s.key ? "text-canvas/70" : "text-dim"}`}
              >
                {scopeCount(s.key)}
              </span>
            </Pill>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Pill active={sel === null} onClick={() => setSel(null)}>
            All types
          </Pill>
          {videoTypes.map((t) => (
            <Pill
              key={t}
              active={sel?.kind === "type" && sel.value === t}
              onClick={() => choose({ kind: "type", value: t })}
            >
              {t}
            </Pill>
          ))}
          <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-hair sm:block" />
          <Pill
            active={sel?.kind === "collection" && sel.value === "pack"}
            onClick={() => choose({ kind: "collection", value: "pack" })}
          >
            Video Pack
          </Pill>
          <Pill
            active={sel?.kind === "collection" && sel.value === "bundle"}
            onClick={() => choose({ kind: "collection", value: "bundle" })}
          >
            Bundle Offer
          </Pill>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[13rem_1fr] lg:items-start">
        {/* the rail wears the portal menu's own chrome, and the column keeps
            a rule running the full height, so the filters read as a panel
            rather than as loose text floating beside the grid */}
        <aside className="lg:self-stretch lg:border-r lg:border-hair lg:pr-6">
          <div className="rounded-[12px] border border-chrome-line bg-chrome p-2.5 lg:sticky lg:top-20">
          <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:block lg:space-y-0.5 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
            {RANKED.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => choose({ kind: "ranked", value: f.key })}
                aria-pressed={sel?.kind === "ranked" && sel.value === f.key}
                className={`tap shrink-0 whitespace-nowrap rounded-[8px] px-3 py-2 text-left text-body-sm transition-colors lg:block lg:w-full ${
                  sel?.kind === "ranked" && sel.value === f.key
                    ? "bg-chrome-2 font-semibold text-gold"
                    : "text-chrome-muted hover:bg-chrome-2/70 hover:text-chrome-text"
                }`}
              >
                {f.label}
              </button>
            ))}

            <p className="hidden px-3 pb-1.5 pt-5 font-mono text-label font-bold uppercase tracking-[0.12em] text-chrome-dim lg:block">
              Filter by feature
            </p>
            {(allFeatures ? hlFeatures : hlFeatures.slice(0, 10)).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => choose({ kind: "hl", value: f.key })}
                aria-pressed={sel?.kind === "hl" && sel.value === f.key}
                className={`tap flex shrink-0 items-center justify-between gap-3 whitespace-nowrap rounded-[8px] px-3 py-2 text-left text-body-sm transition-colors lg:flex lg:w-full ${
                  sel?.kind === "hl" && sel.value === f.key
                    ? "bg-chrome-2 font-semibold text-gold"
                    : "text-chrome-muted hover:bg-chrome-2/70 hover:text-chrome-text"
                }`}
              >
                <span className="min-w-0 truncate">{f.label}</span>
                <span className="font-mono text-label tabular-nums text-chrome-dim">{f.count}</span>
              </button>
            ))}
            {hlFeatures.length > 10 && (
              <button
                type="button"
                onClick={() => setAllFeatures((v) => !v)}
                className="tap shrink-0 whitespace-nowrap rounded-[8px] px-3 py-2 text-left font-mono text-label uppercase text-chrome-dim transition-colors hover:text-gold lg:block lg:w-full"
              >
                {allFeatures ? "Fewer features" : `All ${hlFeatures.length} features`}
              </button>
            )}
          </div>
          </div>
        </aside>

        <section aria-label="The videos" className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-hair pb-3">
            <h2 className="font-display text-h4 font-semibold text-ink">
              {filtering
                ? `${shown.length} ${shown.length === 1 ? "result" : "results"}`
                : "The whole library"}
            </h2>
            {filtering ? (
              <button
                type="button"
                onClick={() => {
                  setScope("all");
                  setSel(null);
                }}
                className="tap font-mono text-label uppercase text-muted transition-colors hover:text-gold"
              >
                Clear filters
              </button>
            ) : (
              <p className="font-mono text-label uppercase text-dim">{headerBlurb}</p>
            )}
          </div>

          {shown.length === 0 ? (
            <p className="py-14 text-center text-body text-muted">
              Nothing here in this library. Try another filter, or clear them.
            </p>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {shown.map((v) => {
                const code = v.code ?? v.slug;
                return (
                  <LibraryCard
                    key={v.slug}
                    video={v}
                    onPreview={openPreview}
                    loves={stats[code]?.loves ?? 0}
                    loved={loved.has(code)}
                    onToggleLove={() => toggleLove(code)}
                    picked={picked.includes(v.slug)}
                    onTogglePick={() => togglePick(v.slug)}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>

      <PickTray
        items={pickedItems}
        onRemove={(slug) => setPicked((p) => p.filter((s) => s !== slug))}
        onClear={() => setPicked([])}
        share={share}
      />

      {preview && (
        <PreviewLightbox
          video={preview.video}
          initialVersion={preview.version}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
