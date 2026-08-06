"use client";

import { useState } from "react";
import { featureAnimations, premadePacks, videoStack } from "@/lib/site";
import type { BrowseVideo, FilterDef } from "./premade/catalog";
import { VideoBrowser } from "./premade/browser";
import { PackBundleView, VideoStackView } from "./premade/bundle-views";
import { FeatureAnimationView } from "./premade/feature-view";

/* ---------------------------------------------------------------- */
/* The library shell                                                  */
/* ---------------------------------------------------------------- */

/*
 * Five views over the admin-managed catalog: two curated grids
 * (Featured, Recent Launch), the two packs (AI First SaaS Pack, Complete
 * Video Stack), and the Full Library, a filterable browser over every
 * video new and classic. The grids read from the DB catalog (passed in
 * from the server page); the packs stay composed in code.
 */
export function PremadeLibrary({
  featured,
  recent,
  full,
  fullGroups,
}: {
  featured: BrowseVideo[];
  recent: BrowseVideo[];
  full: BrowseVideo[];
  fullGroups: FilterDef[];
}) {
  const [view, setView] = useState<string>("featured");

  const tabs = [
    { slug: "featured", label: "Featured Videos", count: featured.length as number | null },
    { slug: "recent", label: "Recent Launch", count: recent.length as number | null },
    ...premadePacks.map((p) => ({ slug: p.slug, label: p.name, count: p.count })),
    { slug: videoStack.slug, label: videoStack.name, count: videoStack.totalCount as number | null },
    { slug: "features", label: "Feature Animations", count: featureAnimations.length as number | null },
    { slug: "full", label: "Full Library", count: full.length as number | null },
  ];

  return (
    <div>
      {/* view rail: curated grids, packs, then the full library */}
      <div
        role="tablist"
        aria-label="Catalog view"
        className="flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-hair pb-4"
      >
        {tabs.map((tab) => {
          const isActive = view === tab.slug;
          return (
            <button
              key={tab.slug}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setView(tab.slug)}
              className="group/tab flex min-h-11 items-center gap-1.5 px-3 font-mono text-body-sm transition-colors"
            >
              <span
                aria-hidden="true"
                className={`transition-opacity ${
                  isActive
                    ? "text-gold opacity-100"
                    : "text-dim opacity-0 group-hover/tab:opacity-100"
                }`}
              >
                [
              </span>
              <span
                className={
                  isActive
                    ? "font-semibold text-gold"
                    : "text-muted group-hover/tab:text-ink"
                }
              >
                {tab.label}
              </span>
              {tab.count !== null && (
                <span
                  className={`text-label ${isActive ? "text-gold/70" : "text-dim"}`}
                >
                  {tab.count}
                </span>
              )}
              <span
                aria-hidden="true"
                className={`transition-opacity ${
                  isActive
                    ? "text-gold opacity-100"
                    : "text-dim opacity-0 group-hover/tab:opacity-100"
                }`}
              >
                ]
              </span>
            </button>
          );
        })}
      </div>

      {/* the instrument panel: square, hairline-framed */}
      <div className="mt-8 border border-hair bg-canvas">
        {/* EVERY view renders into the static HTML so the whole catalog,
            every SKU, and every price is crawlable: AI crawlers do not
            execute JavaScript, and content that appears only after a
            click does not exist to them. Only the active view displays;
            hidden views cost nothing (display:none never intersects, so
            no media loads or plays). */}
        <div hidden={view !== "featured"}>
          <VideoBrowser videos={featured} groups={[]} />
        </div>
        <div hidden={view !== "recent"}>
          <VideoBrowser
            videos={recent}
            groups={[]}
            note="Our newest white-label releases, freshest first. Every one brands to your SaaS."
          />
        </div>
        {premadePacks.map((pk) => (
          <div key={pk.slug} hidden={view !== pk.slug}>
            <PackBundleView pack={pk} />
          </div>
        ))}
        <div hidden={view !== videoStack.slug}>
          <VideoStackView />
        </div>
        <div hidden={view !== "features"}>
          <FeatureAnimationView />
        </div>
        <div hidden={view !== "full"}>
          <VideoBrowser
            videos={full}
            groups={fullGroups}
            note="Every video we make, new and classic. Filter by type or era; each one white-labeled to your platform."
          />
        </div>
      </div>
    </div>
  );
}
