"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { type BrowseVideo, type FilterDef, type Version } from "./catalog";
import { LibraryCard, PreviewLightbox } from "./cards";

/* ---------------------------------------------------------------- */
/* All view: sidebar browser                                          */
/* ---------------------------------------------------------------- */

export function FilterGroup({
  label,
  options,
  active,
  onPick,
  countOf,
}: {
  label: string;
  options: readonly string[];
  active: string | null;
  onPick: (v: string | null) => void;
  countOf?: (opt: string | null) => number;
}) {
  return (
    <div className="border-t border-hair px-5 py-5 first:border-t-0">
      <p className="font-mono text-label uppercase text-dim">[ {label} ]</p>
      <ul className="mt-3 grid gap-0.5">
        {[null, ...options].map((opt) => {
          const isActive = active === opt;
          const count = countOf?.(opt);
          return (
            <li key={opt ?? "any"}>
              <button
                type="button"
                onClick={() => onPick(opt)}
                aria-pressed={isActive}
                className={`tap flex w-full items-center gap-2.5 px-2 py-1.5 text-left text-body-sm transition-colors ${
                  isActive ? "text-gold" : "text-muted hover:text-ink"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 shrink-0 rounded-full border ${
                    isActive ? "border-gold bg-gold" : "border-dim"
                  }`}
                />
                <span className="flex-1">{opt ?? "Any"}</span>
                {count !== undefined && (
                  <span
                    className={`font-mono text-label [font-variant-numeric:tabular-nums] ${
                      isActive ? "text-gold/70" : "text-dim"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function VideoBrowser({
  videos,
  groups,
  note,
}: {
  videos: BrowseVideo[];
  groups: FilterDef[];
  note?: string;
}) {
  const reduced = useReducedMotion();
  const [sel, setSel] = useState<Record<string, string | null>>({});
  const [preview, setPreview] = useState<{
    video: BrowseVideo;
    version: Version;
  } | null>(null);

  const shown = videos.filter((v) =>
    groups.every((g) => !sel[g.label] || v[g.on] === sel[g.label]),
  );
  const filtered = groups.some((g) => sel[g.label]);

  return (
    <div>
      {note && (
        <p className="border-b border-hair px-5 py-3.5 text-body text-muted md:px-7">
          {note}
        </p>
      )}
      <div className="grid lg:grid-cols-[15.5rem_1fr]">
        {/* sidebar */}
        <aside className="border-b border-hair lg:border-b-0 lg:border-r">
          {groups.map((g) => (
            <FilterGroup
              key={g.label}
              label={g.label}
              options={g.options}
              active={sel[g.label] ?? null}
              onPick={(val) => setSel((s) => ({ ...s, [g.label]: val }))}
              countOf={(opt) =>
                opt === null
                  ? videos.length
                  : videos.filter((v) => v[g.on] === opt).length
              }
            />
          ))}
        </aside>

        {/* results */}
        <div className="flex min-w-0 flex-col">
          <div className="flex min-h-[3rem] items-center justify-between gap-4 border-b border-hair bg-surface px-5 py-2">
            <p className="font-mono text-label uppercase text-muted">
              {shown.length} {shown.length === 1 ? "video" : "videos"}
            </p>
            {filtered && (
              <button
                type="button"
                onClick={() => setSel({})}
                className="font-mono text-label uppercase text-dim transition-colors hover:text-gold"
              >
                [ Clear filters ]
              </button>
            )}
          </div>
          <div className="max-h-[44rem] overflow-y-auto p-5">
            {shown.length === 0 ? (
              <div className="flex h-64 items-center justify-center">
                <p className="font-mono text-label uppercase text-dim">
                  [ No videos match. Clear a filter. ]
                </p>
              </div>
            ) : (
              <motion.div
                layout={!reduced}
                className="grid gap-x-5 gap-y-8 md:grid-cols-2"
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  {shown.map((video) => (
                    <motion.div
                      key={video.slug}
                      layout={!reduced}
                      initial={reduced ? false : { opacity: 0, scale: 0.985 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={reduced ? undefined : { opacity: 0, scale: 0.985 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full"
                    >
                      <LibraryCard
                        video={video}
                        onPreview={(v, version) =>
                          setPreview({ video: v, version })
                        }
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
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
