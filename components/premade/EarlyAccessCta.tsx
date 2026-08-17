"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/*
 * The pack's buy button while a client-only launch window runs. Renders
 * fail-closed: the server (and any un-hydrated view) shows the locked
 * state, and the live order link appears only once the browser clock is
 * past the deadline. Flipping back needs no deploy; the page just needs
 * the window to end.
 */
export function EarlyAccessCta({
  href,
  label,
  untilIso,
  note,
}: {
  href: string;
  label: string;
  untilIso: string;
  note: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const open = now != null && now >= Date.parse(untilIso);
  if (open) {
    return (
      <Link
        href={href}
        className="group inline-flex items-center gap-2 whitespace-nowrap rounded-[3px] bg-brand-gradient px-6 py-3 text-body font-semibold text-canvas shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_28px_rgba(var(--green-rgb),0.28)] transition-all duration-200 hover:brightness-[1.07] active:scale-[0.98]"
      >
        {label}
        <span
          aria-hidden="true"
          className="transition-transform duration-200 group-hover:translate-x-0.5"
        >
          &rarr;
        </span>
      </Link>
    );
  }

  return (
    <span className="flex flex-col items-start gap-1.5 sm:items-end">
      <span
        aria-disabled="true"
        className="inline-flex cursor-not-allowed select-none items-center gap-2 whitespace-nowrap rounded-[3px] border border-hair bg-surface px-6 py-3 text-body font-semibold text-dim"
      >
        {label}
      </span>
      <span className="font-mono text-label uppercase tracking-[0.08em] text-gold">
        {note}
      </span>
    </span>
  );
}
