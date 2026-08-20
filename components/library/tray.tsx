"use client";

import { useState } from "react";
import type { BrowseVideo } from "./catalog";

/*
 * The picks tray: the share flow without a mode.
 *
 * The first version put the library behind a "Pick a few to share" toggle
 * that turned every card into a checkbox, which meant browsing stopped while
 * choosing happened. Marketplaces solved this years ago: an add button that
 * is simply always there, and a tray that appears once it holds something.
 * You browse the whole time; the tray keeps the running total; one button
 * turns it into a link.
 *
 * Rendered by both libraries (public and portal), which each bring their own
 * share call, so the person with no account and the client signed into their
 * portal get the identical gesture.
 */

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

export function PickTray({
  items,
  onRemove,
  onClear,
  share,
}: {
  items: BrowseVideo[];
  onRemove: (slug: string) => void;
  onClear: () => void;
  /* creates the list and returns its path, e.g. /list/<token>/ */
  share: (codes: string[]) => Promise<string | null>;
}) {
  const [busy, setBusy] = useState(false);
  const [href, setHref] = useState("");
  const [copied, setCopied] = useState(false);

  if (!items.length) return null;

  const total = items.reduce((s, i) => s + i.price, 0);

  async function makeLink() {
    setBusy(true);
    setCopied(false);
    try {
      const path = await share(items.map((i) => i.code ?? i.slug));
      if (path) setHref(`${window.location.origin}${path}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="portal-sheet pointer-events-auto w-full max-w-3xl rounded-[12px] border border-chrome-line bg-chrome px-4 py-3 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.7)]">
        <div className="flex flex-wrap items-center gap-3">
          {/* the first few posters, so the tray reads as "your picks" and
              not as one more toolbar */}
          <div className="flex items-center">
            {items.slice(0, 5).map((i, n) =>
              i.poster ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={i.slug}
                  src={i.poster}
                  alt=""
                  className={`h-9 w-14 rounded-[6px] border border-chrome-line object-cover ${n > 0 ? "-ml-3" : ""}`}
                />
              ) : (
                <span
                  key={i.slug}
                  className={`grid h-9 w-14 place-items-center rounded-[6px] border border-chrome-line bg-chrome-2 font-mono text-label text-chrome-dim ${n > 0 ? "-ml-3" : ""}`}
                >
                  {i.packCount ?? "+"}
                </span>
              ),
            )}
            {items.length > 5 && (
              <span className="-ml-3 grid h-9 w-9 place-items-center rounded-[6px] border border-chrome-line bg-chrome-2 font-mono text-label text-chrome-text">
                +{items.length - 5}
              </span>
            )}
          </div>

          <p className="min-w-0 flex-1 text-body-sm text-chrome-text">
            {items.length} picked
            <span className="ml-2 font-mono tabular-nums text-gold">{money(total)}</span>
          </p>

          {href ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <code className="max-w-[14rem] truncate rounded-[6px] border border-chrome-line bg-chrome-2 px-2.5 py-1.5 font-mono text-label text-chrome-text">
                {href}
              </code>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(href);
                  setCopied(true);
                }}
                className="tap rounded-[8px] bg-gold px-3.5 py-2 font-mono text-label font-bold uppercase text-canvas transition-opacity hover:opacity-90"
              >
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={makeLink}
              className="tap rounded-[8px] bg-gold px-3.5 py-2 font-mono text-label font-bold uppercase text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "Making the link..." : "Share these"}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onClear();
              setHref("");
              setCopied(false);
            }}
            aria-label="Clear your picks"
            className="tap rounded-[8px] px-2.5 py-2 font-mono text-label uppercase text-chrome-muted transition-colors hover:text-chrome-text"
          >
            Clear
          </button>
        </div>

        {/* the picks themselves, removable one by one */}
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((i) => (
            <button
              key={i.slug}
              type="button"
              onClick={() => onRemove(i.slug)}
              aria-label={`Remove ${i.title}`}
              className="tap group/pick flex shrink-0 items-center gap-1.5 rounded-full border border-chrome-line bg-chrome-2 py-1 pl-3 pr-2 font-mono text-label text-chrome-muted transition-colors hover:border-error/50 hover:text-error"
            >
              <span className="max-w-[11rem] truncate">{i.title}</span>
              <span aria-hidden="true" className="text-chrome-dim group-hover/pick:text-error">
                &times;
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
