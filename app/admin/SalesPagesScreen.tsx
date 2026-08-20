"use client";

import { useState } from "react";
import { salesPages, salesPageUrl } from "@/lib/sales/pages";

/*
 * The Sales Pages registry: every cold-outreach / campaign landing page,
 * with a copy-link so the team (Sales Reps especially) can grab the URL to
 * send. Pages are code-defined; this screen lists them.
 */
export function SalesPagesScreen({ embedded = false }: { embedded?: boolean }) {
  const [copied, setCopied] = useState<string | null>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://www.ghlvideo.com";

  async function copy(slug: string) {
    try {
      await navigator.clipboard.writeText(`${origin}${salesPageUrl(slug)}`);
      setCopied(slug);
      window.setTimeout(() => setCopied((c) => (c === slug ? null : c)), 1600);
    } catch {
      /* clipboard blocked; the URL is visible to copy by hand */
    }
  }

  return (
    <div>
      {!embedded && <h1 className="font-display text-h3 text-ink">Sales Pages</h1>}
      <p className="mt-1 max-w-xl text-body-sm text-muted">
        Landing pages for cold outreach and campaigns. Copy a link to send it to a prospect.
      </p>

      <div className="mt-6 grid gap-4">
        {salesPages.map((p) => {
          const url = `${origin}${salesPageUrl(p.slug)}`;
          const live = p.status === "live";
          return (
            <div key={p.slug} className="rounded-[12px] border border-hair bg-surface/40 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <p className="font-display text-h4 font-semibold text-ink">{p.title}</p>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${
                        live
                          ? "border-green/40 bg-green/10 text-green"
                          : "border-hair bg-hair/30 text-muted"
                      }`}
                    >
                      {live ? "Live" : "Draft"}
                    </span>
                  </div>
                  <p className="mt-1 text-body-sm text-muted">{p.campaign}</p>
                  <p className="mt-2 break-all font-mono text-body-sm text-gold/80">{url}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copy(p.slug)}
                    className="tap rounded-[8px] bg-brand-gradient px-4 py-2 font-mono text-label uppercase text-canvas transition-all hover:brightness-110"
                  >
                    {copied === p.slug ? "Copied" : "Copy link"}
                  </button>
                  <a
                    href={salesPageUrl(p.slug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tap rounded-[8px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
                  >
                    Open
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
