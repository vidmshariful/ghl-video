"use client";

import { useState } from "react";
import { activePromo } from "@/lib/site";

/* The newsletter promo strip at the top of the library. Announces the
 * active coupon and shows the code to copy; the library order links
 * already carry ?code= so it also applies on its own. Renders nothing when
 * the promo is switched off (activePromo.active = false), so closing the
 * window is a one-line flip in lib/content/premade.ts. */
export function LibraryPromoBanner() {
  const [copied, setCopied] = useState(false);
  if (!activePromo.active) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(activePromo.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked; the code is visible to type by hand */
    }
  }

  return (
    <div className="mt-10 flex flex-col gap-5 rounded-[10px] border border-dashed border-gold/55 bg-gold/[0.05] p-5 shadow-[0_0_44px_-14px_rgba(252,192,0,0.4)] sm:flex-row sm:items-center sm:justify-between sm:gap-6 md:p-6">
      <div className="min-w-0">
        <p className="font-mono text-label uppercase tracking-[0.14em] text-gold">
          Newsletter offer, ends {activePromo.deadlineLabel}
        </p>
        <p className="mt-2 font-display text-h4 font-semibold leading-snug text-ink">
          {activePromo.label}.
        </p>
        <p className="mt-1.5 text-body-sm text-muted">
          Applied automatically when you order from the library, or enter the
          code at checkout.
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span className="rounded-[6px] border border-dashed border-gold/60 bg-canvas px-4 py-2.5 font-mono text-lede font-bold uppercase tracking-[0.12em] text-gold">
          {activePromo.code}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy discount code ${activePromo.code}`}
          className="tap rounded-[4px] border border-gold/50 bg-gold/10 px-4 py-2.5 font-mono text-label uppercase tracking-[0.08em] text-gold transition-colors hover:bg-gold/20"
        >
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>
    </div>
  );
}
