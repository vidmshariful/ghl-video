"use client";

import { useEffect, useState } from "react";
import type { SiteNotice } from "@/lib/site";

/*
 * The soft-launch notice strip above the header. DISMISSIBLE: closing it sets a
 * localStorage flag (and the `data-notice="off"` attribute the site layout's
 * pre-paint script also reads), so the bar stays gone across pages and the
 * header + page offset it reserved collapse with it (see globals.css). Copy
 * lives in lib/content/core.ts. Bump NOTICE_KEY's version when the copy changes
 * so past dismissers see the new notice again.
 */
const NOTICE_KEY = "ghlv_notice_off_v1";

export function NoticeBar({ notice }: { notice: SiteNotice }) {
  const [hidden, setHidden] = useState(false);

  // Sync React with a prior dismissal (the inline script + CSS already hid it
  // before paint; this unmounts it so it is not in the tab order).
  useEffect(() => {
    try {
      if (localStorage.getItem(NOTICE_KEY)) setHidden(true);
    } catch {}
  }, []);

  if (hidden) return null;

  function dismiss() {
    try {
      localStorage.setItem(NOTICE_KEY, "1");
    } catch {}
    document.documentElement.setAttribute("data-notice", "off");
    window.dispatchEvent(new Event("ghlv:notice-dismissed"));
    setHidden(true);
  }

  return (
    <div
      role="status"
      data-notice-bar
      className="fixed inset-x-0 top-0 z-[60] flex h-9 items-center justify-center gap-2 border-b border-gold/25 bg-surface px-10"
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold motion-safe:animate-pulse"
      />
      <p className="truncate font-mono text-[11px] uppercase tracking-[0.05em] text-muted sm:text-label">
        <span className="sm:hidden">{notice.short} </span>
        <span className="hidden sm:inline">{notice.long} </span>
        <a
          href={`mailto:${notice.email}`}
          className="font-semibold text-gold underline decoration-gold/40 underline-offset-2 transition-colors hover:decoration-gold"
        >
          {notice.email}
        </a>
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss notice"
        className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-[3px] text-dim transition-colors hover:bg-hair/40 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
