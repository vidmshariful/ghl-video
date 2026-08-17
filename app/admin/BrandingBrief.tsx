"use client";

import { useEffect, useMemo, useState } from "react";
import { bundlePickTitles } from "@/lib/bundles";

/*
 * The client's branding brief, read only.
 *
 * Lives in its own file because two screens need it and neither owns it: the
 * Orders record shows it as part of the order, and the production job page
 * shows it as the instructions for the work. One copy, so they can never fall
 * out of step.
 */
export type Brief = {
  brandName: string;
  primaryColor: string;
  accentColor: string;
  brandPronunciation: string;
  notes: string;
  logoUrl: string | null;
  screenshotUrls: string[];
  videoSelections?: {
    master?: string[];
    demo?: string[];
    feature?: string[];
  } | null;
};

/* The client's submitted branding brief, read from the intake route (which
 * returns the files as short-lived signed URLs). */
export function BrandingBrief({ orderId }: { orderId: string }) {
  const [brief, setBrief] = useState<Brief | null | "loading">("loading");
  useEffect(() => {
    fetch(`/api/intake/${orderId}/`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setBrief((j?.intake as Brief) ?? null))
      .catch(() => setBrief(null));
  }, [orderId]);
  const chip =
    "rounded-[8px] border border-hair px-3 py-1 font-mono text-label uppercase text-ink hover:border-gold/60";
  // map a picked video slug to its title, for the fulfillment team
  const slugTitle = useMemo(() => bundlePickTitles(), []);
  const pickCats: { key: "master" | "demo" | "feature"; label: string }[] = [
    { key: "master", label: "Master" },
    { key: "demo", label: "Demo" },
    { key: "feature", label: "Feature" },
  ];

  return (
    <div className="mt-6">
      <p className="font-mono text-label uppercase text-gold">Branding brief</p>
      {brief === "loading" ? (
        <p className="mt-2 text-body-sm text-muted">Loading...</p>
      ) : !brief ? (
        <p className="mt-2 text-body-sm text-dim">
          Not submitted yet. Client link:{" "}
          <span className="break-all font-mono text-muted">/checkout/intake/{orderId}</span>
        </p>
      ) : (
        <div className="mt-2 grid gap-2 text-body-sm">
          <div className="flex gap-2">
            <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Brand:</span>
            <span className="text-muted">{brief.brandName}</span>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <span className="inline-flex items-center gap-2">
              <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Primary</span>
              <span className="h-4 w-4 rounded border border-hair" style={{ background: brief.primaryColor }} />
              <span className="font-mono text-muted">{brief.primaryColor}</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Accent</span>
              <span className="h-4 w-4 rounded border border-hair" style={{ background: brief.accentColor }} />
              <span className="font-mono text-muted">{brief.accentColor}</span>
            </span>
          </div>
          {brief.videoSelections &&
          pickCats.some((c) => (brief.videoSelections?.[c.key] ?? []).length) ? (
            <div className="grid gap-1 rounded-[8px] border border-hair/60 bg-canvas/40 p-3">
              <span className="font-mono text-label uppercase text-gold/80">Chosen videos</span>
              {pickCats.map((c) => {
                const slugs = brief.videoSelections?.[c.key] ?? [];
                if (!slugs.length) return null;
                return (
                  <div key={c.key} className="flex gap-2">
                    <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">{c.label}:</span>
                    <span className="text-muted">
                      {slugs.map((slug) => slugTitle[slug] ?? slug).join(", ")}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
          {brief.brandPronunciation ? (
            <div className="flex gap-2">
              <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Say it:</span>
              <span className="text-muted">{brief.brandPronunciation}</span>
            </div>
          ) : null}
          {brief.notes ? (
            <div className="flex gap-2">
              <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">Notes:</span>
              <span className="whitespace-pre-wrap text-muted">{brief.notes}</span>
            </div>
          ) : null}
          {brief.logoUrl || brief.screenshotUrls.length ? (
            <div className="mt-1 flex flex-wrap gap-2">
              {brief.logoUrl ? (
                <a href={brief.logoUrl} target="_blank" rel="noopener" className={chip}>
                  Logo
                </a>
              ) : null}
              {brief.screenshotUrls.map((u, i) => (
                <a key={i} href={u} target="_blank" rel="noopener" className={chip}>
                  Shot {i + 1}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
