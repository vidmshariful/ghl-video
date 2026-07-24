"use client";

import { useState } from "react";
import { collab, featureAnimations, premadePacks, videoStack } from "@/lib/site";
import { newGroups, newReady, oldBrowse, oldGroups } from "./premade/catalog";
import { VideoBrowser } from "./premade/browser";
import { FeatureAnimationView } from "./premade/feature-view";
import { PackBundleView, VideoStackView } from "./premade/bundle-views";
import { CollabView } from "./premade/collab-view";

/* ---------------------------------------------------------------- */
/* The library shell                                                  */
/* ---------------------------------------------------------------- */

export function PremadeLibrary() {
  const [view, setView] = useState<string>("new");

  const tabs = [
    { slug: "new", label: "All New Videos", count: newReady.length as number | null },
    ...premadePacks.map((p) => ({ slug: p.slug, label: p.name, count: p.count })),
    { slug: videoStack.slug, label: videoStack.name, count: videoStack.totalCount as number | null },
    { slug: collab.slug, label: collab.tabLabel, count: null },
    { slug: "features", label: "Feature Animations", count: featureAnimations.length as number | null },
    { slug: "old", label: "Classic Library", count: oldBrowse.length as number | null },
  ];

  return (
    <div>
      {/* view rail: All videos first, then each pack */}
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
        <div hidden={view !== "new"}>
          <VideoBrowser videos={newReady} groups={newGroups} />
        </div>
        {premadePacks.map((pk) => (
          <div key={pk.slug} hidden={view !== pk.slug}>
            <PackBundleView pack={pk} />
          </div>
        ))}
        <div hidden={view !== videoStack.slug}>
          <VideoStackView />
        </div>
        <div hidden={view !== collab.slug}>
          <CollabView />
        </div>
        <div hidden={view !== "features"}>
          <FeatureAnimationView />
        </div>
        <div hidden={view !== "old"}>
          <VideoBrowser
            videos={oldBrowse}
            groups={oldGroups}
            note="Produced before HighLevel's current platform refresh. Most still brand cleanly, at the original prices and checkout links."
          />
        </div>
      </div>
    </div>
  );
}
