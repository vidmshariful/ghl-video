"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Tabs } from "@/components/portal/ui";
import { LibraryCard, PreviewLightbox } from "@/components/library/cards";
import { PickTray } from "@/components/library/tray";
import type { BrowseVideo, Version } from "@/components/library/catalog";
import { featureCounts, matchFeature, type LibraryFeature } from "@/lib/library-features";

/*
 * The public library, laid out like the portal's: kind tabs with counts,
 * search beside the category chips, and down the left the one rail that
 * earns its column, Filter by features. Featured is the flag admin curates;
 * Most popular is preview plays; Most loved is hearts. Both counters start
 * from zero and stay honest, because a catalogue that invents its own
 * popularity teaches people to ignore the shelf.
 *
 * Picking has no mode. Every card carries an add button, the tray appears
 * once it holds something, and browsing never stops.
 */

type Stats = Record<string, { loves: number; plays: number }>;

type Kind = "all" | "video" | "pack" | "bundle";
type Feature = "all" | "featured" | "popular" | "loved";

const FEATURES: { key: Feature; label: string; blurb: string }[] = [
  { key: "all", label: "All videos", blurb: "newest first, then the classics" },
  { key: "featured", label: "Featured videos", blurb: "what the studio puts forward" },
  { key: "popular", label: "Most popular", blurb: "watched the most, right here" },
  { key: "loved", label: "Most loved", blurb: "ranked by the hearts" },
];

const LOVED_KEY = "ghlv-loved";

function kindOf(v: BrowseVideo): Exclude<Kind, "all"> {
  return (v.kind ?? "video") as Exclude<Kind, "all">;
}

const featureText = (v: BrowseVideo) => `${v.title} ${v.subtitle ?? ""} ${v.typeTag ?? ""}`;

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
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [category, setCategory] = useState<string>("all");
  const [feature, setFeature] = useState<Feature>("all");
  /* one HighLevel feature, e.g. "reputation". Empty = not filtering by one */
  const [hlFeature, setHlFeature] = useState("");
  const [allFeatures, setAllFeatures] = useState(false);
  const [preview, setPreview] = useState<{ video: BrowseVideo; version: Version } | null>(null);

  /* counters, optimistic on top of what the server rendered */
  const [stats, setStats] = useState<Stats>(initialStats);
  const [loved, setLoved] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<string[]>([]);

  /* this browser's own hearts, so the button toggles honestly on a return
     visit without any account existing */
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
    /* optimistic, corrected by the response */
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
    /* a preview open is the popularity signal */
    react(video.code ?? video.slug, "play");
  };

  /* the platform features that actually have videos, biggest first */
  const hlFeatures = useMemo(() => featureCounts(videos, featureText, features), [videos, features]);

  const categories = useMemo(() => {
    const set = new Map<string, number>();
    for (const v of videos) set.set(v.typeTag, (set.get(v.typeTag) ?? 0) + 1);
    return [...set.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [videos]);

  const term = q.trim().toLowerCase();
  const filtering =
    Boolean(term) || kind !== "all" || category !== "all" || feature !== "all" || Boolean(hlFeature);

  const shown = useMemo(() => {
    const base = videos.filter((v) => {
      if (kind !== "all" && kindOf(v) !== kind) return false;
      if (category !== "all" && v.typeTag !== category) return false;
      if (feature === "featured" && !v.featured) return false;
      if (hlFeature) {
        const f = features.find((x) => x.key === hlFeature);
        if (f && !matchFeature(featureText(v), f.aliases)) return false;
      }
      if (
        term &&
        ![v.title, v.code, v.subtitle, v.typeTag, v.subTag]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(term))
      )
        return false;
      return true;
    });
    const of = (v: BrowseVideo) => stats[v.code ?? v.slug];
    if (feature === "popular")
      return [...base].sort((a, b) => (of(b)?.plays ?? 0) - (of(a)?.plays ?? 0));
    if (feature === "loved")
      return [...base].sort((a, b) => (of(b)?.loves ?? 0) - (of(a)?.loves ?? 0));
    return base;
  }, [videos, kind, category, feature, hlFeature, term, stats, features]);

  const kindCount = (k: Kind) =>
    k === "all" ? videos.length : videos.filter((v) => kindOf(v) === k).length;

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

  const active = FEATURES.find((f) => f.key === feature)!;

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

      {/* the portal library's own header, deliberately: kind tabs with
          counts, then search beside the category chips */}
      <div className="grid gap-4">
        <Tabs
          tabs={[
            { key: "all" as Kind, label: "Everything", count: kindCount("all") },
            { key: "video" as Kind, label: "Videos", count: kindCount("video") },
            { key: "pack" as Kind, label: "Packs", count: kindCount("pack") },
            { key: "bundle" as Kind, label: "Bundles", count: kindCount("bundle") },
          ]}
          active={kind}
          onChange={(k) => {
            setKind(k);
            setCategory("all");
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[16rem] max-w-md flex-1">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dim"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, code or type"
              aria-label="Search the library"
              className="tap w-full rounded-[8px] border border-hair bg-surface py-2.5 pl-10 pr-3 text-body-sm text-ink placeholder:text-dim focus:border-gold focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 sm:ml-auto sm:justify-end">
            <Button
              size="sm"
              variant={category === "all" ? "primary" : "secondary"}
              onClick={() => setCategory("all")}
            >
              All types
            </Button>
            {categories.map((c) => (
              <Button
                key={c}
                size="sm"
                variant={category === c ? "primary" : "secondary"}
                onClick={() => setCategory(category === c ? "all" : c)}
              >
                {c}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[13rem_1fr] lg:items-start">
        {/* the one rail: how the shelf is ranked */}
        <aside className="lg:sticky lg:top-20">
          <p className="hidden px-3 pb-1.5 font-mono text-label font-bold uppercase tracking-[0.12em] text-dim lg:block">
            Filter by features
          </p>
          <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:block lg:space-y-0.5 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
            {FEATURES.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFeature(f.key)}
                aria-pressed={feature === f.key}
                className={`tap shrink-0 whitespace-nowrap rounded-[8px] px-3 py-2 text-left text-body-sm transition-colors lg:block lg:w-full ${
                  feature === f.key
                    ? "bg-card font-semibold text-gold"
                    : "text-muted hover:bg-card/70 hover:text-ink"
                }`}
              >
                {f.label}
              </button>
            ))}

            {/* the platform's own features, from the titles, so somebody who
                came for "reputation" finds every video that covers it. Only
                features with videos behind them ever appear. */}
            <p className="hidden px-3 pb-1.5 pt-5 font-mono text-label font-bold uppercase tracking-[0.12em] text-dim lg:block">
              Filter by feature
            </p>
            {(allFeatures ? hlFeatures : hlFeatures.slice(0, 10)).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setHlFeature(hlFeature === f.key ? "" : f.key)}
                aria-pressed={hlFeature === f.key}
                className={`tap flex shrink-0 items-center justify-between gap-3 whitespace-nowrap rounded-[8px] px-3 py-2 text-left text-body-sm transition-colors lg:flex lg:w-full ${
                  hlFeature === f.key
                    ? "bg-card font-semibold text-gold"
                    : "text-muted hover:bg-card/70 hover:text-ink"
                }`}
              >
                <span className="min-w-0 truncate">{f.label}</span>
                <span className="font-mono text-label tabular-nums text-dim">{f.count}</span>
              </button>
            ))}
            {hlFeatures.length > 10 && (
              <button
                type="button"
                onClick={() => setAllFeatures((v) => !v)}
                className="tap shrink-0 whitespace-nowrap rounded-[8px] px-3 py-2 text-left font-mono text-label uppercase text-dim transition-colors hover:text-gold lg:block lg:w-full"
              >
                {allFeatures ? "Fewer features" : `All ${hlFeatures.length} features`}
              </button>
            )}
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
                  setQ("");
                  setKind("all");
                  setCategory("all");
                  setFeature("all");
                  setHlFeature("");
                }}
                className="tap font-mono text-label uppercase text-muted transition-colors hover:text-gold"
              >
                Clear filters
              </button>
            ) : (
              <p className="font-mono text-label uppercase text-dim">{active.blurb}</p>
            )}
          </div>

          {shown.length === 0 ? (
            <p className="py-14 text-center text-body text-muted">
              Nothing matches that. Try another word, or clear the filters.
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
