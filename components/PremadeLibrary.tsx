"use client";

import { useEffect, useState } from "react";
import { featureAnimations, premadePacks, videoStack } from "@/lib/site";
import type { BrowseVideo, FilterDef } from "./premade/catalog";
import { VideoBrowser } from "./premade/browser";
import { PackBundleView, VideoStackView } from "./premade/bundle-views";
import { FeatureAnimationView } from "./premade/feature-view";

/* ---------------------------------------------------------------- */
/* The library shell                                                  */
/* ---------------------------------------------------------------- */

/*
 * Five views over the admin-managed catalog plus the two packs and the
 * feature animations. The tab bar is a grid-lined cell row (edge-to-edge, one
 * surface-filled box per tab; the active box lifts to card with gold text and a
 * thin gradient top bar) that sticks to the top on
 * scroll. To give the library room, scrolling down hides the site chrome
 * (via data-nav-hidden, see globals.css) and the tab bar rises to top:0;
 * scrolling up brings the chrome back and drops the tab bar below it.
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
  const [navHidden, setNavHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const apply = () => {
      const y = window.scrollY;
      // hide chrome only while scrolling DOWN and past the hero; any upward
      // scroll (or near the top) brings it back
      if (y > lastY && y > 480) {
        setNavHidden(true);
        document.documentElement.dataset.navHidden = "1";
      } else if (y < lastY || y < 240) {
        setNavHidden(false);
        document.documentElement.dataset.navHidden = "";
      }
      lastY = y;
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(apply);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      delete document.documentElement.dataset.navHidden;
    };
  }, []);

  const tabs = [
    { slug: "featured", label: "Featured Videos", count: featured.length as number | null },
    { slug: "recent", label: "Recent Launch", count: recent.length as number | null },
    ...premadePacks.map((p) => ({ slug: p.slug, label: p.name, count: p.count })),
    { slug: videoStack.slug, label: videoStack.name, count: videoStack.totalCount as number | null },
    { slug: "features", label: "Feature Animations", count: featureAnimations.length as number | null },
    { slug: "full", label: "Full Library", count: full.length as number | null },
  ];

  return (
    <div className="border border-hair bg-canvas">
      {/* grid-lined tab bar: one box per tab, active on the brand gradient,
          sticky to the top on scroll (chrome hides to make room) */}
      <div
        role="tablist"
        aria-label="Catalog view"
        className="sticky z-30 flex overflow-x-auto border-b border-hair bg-canvas/95 backdrop-blur-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ top: navHidden ? 0 : "var(--chrome-h, 5rem)", transition: "top 0.25s ease" }}
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
              className={`relative flex min-h-[3.25rem] min-w-[8.5rem] flex-1 items-center justify-center gap-2 whitespace-nowrap border-l border-hair px-3 font-mono text-body-sm transition-colors first:border-l-0 ${
                isActive
                  ? "bg-card font-semibold text-gold"
                  : "bg-surface text-muted hover:bg-card hover:text-ink"
              }`}
            >
              {/* selected: a thin gradient bar instead of a loud full fill */}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-[2px] bg-brand-gradient"
                />
              )}
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span
                  className={`text-label [font-variant-numeric:tabular-nums] ${
                    isActive ? "text-gold/60" : "text-dim"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* the instrument panel: EVERY view renders into the static HTML so the
          whole catalog, every SKU, and every price is crawlable (AI crawlers do
          not execute JS). Only the active view displays; hidden views cost
          nothing (display:none never intersects, so no media loads or plays). */}
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
  );
}
