"use client";

import { useMemo, useState } from "react";
import { LibraryCard, PreviewLightbox } from "./cards";
import type { BrowseVideo, Version } from "./catalog";

/*
 * The library, laid out like a catalogue instead of hidden inside one.
 *
 * The shape is the one every template marketplace has settled on, because it
 * is the one that works for browsing a few dozen things: filters down the
 * left, the most popular work up top, everything else in a grid that scrolls
 * WITH THE PAGE. That last clause is the whole reason this file exists. The
 * old library lived inside a fixed-height section with its own scrollbar,
 * which made eighty videos feel like a porthole.
 *
 * No account anywhere in it. Somebody deciding whether to buy should never
 * be asked to sign up in order to look.
 */

const KINDS = [
  { key: "all", label: "Everything" },
  { key: "video", label: "Videos" },
  { key: "pack", label: "Packs" },
  { key: "bundle", label: "Bundles" },
] as const;

type Kind = (typeof KINDS)[number]["key"];

function kindOf(v: BrowseVideo): Exclude<Kind, "all"> {
  return (v.kind ?? "video") as Exclude<Kind, "all">;
}

/* one rail entry; the whole row is the control, count on the right */
function RailButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`tap flex w-full items-center justify-between gap-3 rounded-[8px] px-3 py-2 text-left text-body-sm transition-colors ${
        active
          ? "bg-card font-semibold text-gold"
          : "text-muted hover:bg-card/70 hover:text-ink"
      }`}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span className="font-mono text-label tabular-nums text-dim">{count}</span>
    </button>
  );
}

export function LibraryExplorer({
  videos,
  featured,
}: {
  videos: BrowseVideo[];
  featured: BrowseVideo[];
}) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [category, setCategory] = useState<string>("all");
  const [preview, setPreview] = useState<{ video: BrowseVideo; version: Version } | null>(null);

  /* categories with counts, ordered by size so the rail reads like a map */
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of videos) counts.set(v.typeTag, (counts.get(v.typeTag) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [videos]);

  const term = q.trim().toLowerCase();
  const filtering = Boolean(term) || kind !== "all" || category !== "all";

  const shown = useMemo(
    () =>
      videos.filter((v) => {
        if (kind !== "all" && kindOf(v) !== kind) return false;
        if (category !== "all" && v.typeTag !== category) return false;
        if (
          term &&
          ![v.title, v.code, v.subtitle, v.typeTag, v.subTag]
            .filter(Boolean)
            .some((f) => String(f).toLowerCase().includes(term))
        )
          return false;
        return true;
      }),
    [videos, kind, category, term],
  );

  const kindCount = (k: Kind) =>
    k === "all" ? videos.length : videos.filter((v) => kindOf(v) === k).length;

  const openPreview = (video: BrowseVideo, version: Version) => setPreview({ video, version });

  const clear = () => {
    setQ("");
    setKind("all");
    setCategory("all");
  };

  return (
    <div className="mx-auto w-full max-w-[100rem] px-4 pb-20 md:px-8">
      {/* the header: what this is, how much of it there is, and the search */}
      <div className="pb-6 pt-10 md:pt-14">
        <p className="font-mono text-label uppercase tracking-[0.14em] text-dim">
          The library
        </p>
        <h1 className="mt-2 font-display text-h2 tracking-tight text-ink">
          Every video, ready for your brand
        </h1>
        <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
          Watch anything before you buy it. Order a single video or take a
          pack, and it ships white-labeled to your SaaS. No account needed to
          look.
        </p>
        <div className="relative mt-6 max-w-2xl">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-dim"
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
            placeholder={`Search ${videos.length} videos by name, code or type`}
            aria-label="Search the library"
            className="tap w-full rounded-[10px] border border-hair bg-surface py-3 pl-11 pr-4 text-body text-ink placeholder:text-dim focus:border-gold focus:outline-none"
          />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[13.5rem_1fr] lg:items-start">
        {/* the rail. On a phone it becomes two chip rows above the grid,
            because a sidebar on a 375px screen is a third of the screen. */}
        <aside className="lg:sticky lg:top-20">
          <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:block lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
            <p className="hidden px-3 pb-1.5 font-mono text-label font-bold uppercase tracking-[0.12em] text-dim lg:block">
              Type
            </p>
            <div className="flex shrink-0 gap-1.5 lg:block lg:space-y-0.5">
              {KINDS.map((k) => (
                <div key={k.key} className="shrink-0 lg:shrink">
                  <RailButton
                    label={k.label}
                    count={kindCount(k.key)}
                    active={kind === k.key}
                    onClick={() => setKind(k.key)}
                  />
                </div>
              ))}
            </div>

            <p className="hidden px-3 pb-1.5 pt-5 font-mono text-label font-bold uppercase tracking-[0.12em] text-dim lg:block">
              Category
            </p>
            <div className="flex shrink-0 gap-1.5 lg:block lg:space-y-0.5">
              <div className="shrink-0 lg:shrink">
                <RailButton
                  label="All categories"
                  count={videos.length}
                  active={category === "all"}
                  onClick={() => setCategory("all")}
                />
              </div>
              {categories.map(([c, n]) => (
                <div key={c} className="shrink-0 lg:shrink">
                  <RailButton
                    label={c}
                    count={n}
                    active={category === c}
                    onClick={() => setCategory(category === c ? "all" : c)}
                  />
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          {/* Most popular leads while nothing is filtered: the same shelf
              every marketplace opens with, and it is real data, the featured
              flag the admin already curates. */}
          {!filtering && featured.length > 0 && (
            <section aria-label="Most popular" className="mb-10">
              <div className="flex items-baseline justify-between gap-3 border-b border-hair pb-3">
                <h2 className="font-display text-h4 font-semibold text-ink">Most popular</h2>
                <p className="font-mono text-label uppercase text-dim">
                  what HighLevel SaaS order most
                </p>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {featured.map((v) => (
                  <LibraryCard key={`f-${v.slug}`} video={v} onPreview={openPreview} />
                ))}
              </div>
            </section>
          )}

          <section aria-label="All videos">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-hair pb-3">
              <h2 className="font-display text-h4 font-semibold text-ink">
                {filtering ? `${shown.length} ${shown.length === 1 ? "result" : "results"}` : "The whole library"}
              </h2>
              {filtering ? (
                <button
                  type="button"
                  onClick={clear}
                  className="tap font-mono text-label uppercase text-muted transition-colors hover:text-gold"
                >
                  Clear filters
                </button>
              ) : (
                <p className="font-mono text-label uppercase text-dim">
                  newest first, then the classics
                </p>
              )}
            </div>

            {shown.length === 0 ? (
              <p className="py-14 text-center text-body text-muted">
                Nothing matches that. Try another word, or{" "}
                <button
                  type="button"
                  onClick={clear}
                  className="tap text-gold underline underline-offset-2"
                >
                  clear the filters
                </button>
                .
              </p>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {shown.map((v) => (
                  <LibraryCard key={v.slug} video={v} onPreview={openPreview} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

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
