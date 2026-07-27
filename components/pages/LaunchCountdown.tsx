"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/Button";

/*
 * The launch page's clock, its code ticket, and its buy moment, one
 * component so they can never disagree: while the window is open it
 * renders the live countdown, the code, and the Order button; past the
 * deadline it swaps to the closed state and points at the public page.
 * The server renders dashes (no clock on the server), so hydration
 * never mismatches; /finalize is the real gate either way, an expired
 * code cannot be charged.
 */
export function LaunchCountdown({
  deadlineIso,
  deadlineLabel,
  endsPrefix,
  orderHref,
  orderLabel,
  videosLabel,
  closedLine,
  closedCtaLabel,
  closedHref,
}: {
  deadlineIso: string;
  deadlineLabel: string;
  endsPrefix: string;
  orderHref: string;
  orderLabel: string;
  videosLabel: string;
  closedLine: string;
  closedCtaLabel: string;
  closedHref: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const left = now == null ? null : Date.parse(deadlineIso) - now;
  if (left != null && left <= 0) {
    return (
      <div className="flex w-full flex-col items-center gap-5">
        <p className="max-w-[var(--measure-body)] text-center text-body text-muted">
          {closedLine}
        </p>
        <Button href={closedHref} variant="ghost">
          {closedCtaLabel}
        </Button>
      </div>
    );
  }

  const s = left == null ? null : Math.max(0, Math.floor(left / 1000));
  const parts =
    s == null
      ? ["--", "--", "--", "--"]
      : [
          Math.floor(s / 86400),
          Math.floor((s % 86400) / 3600),
          Math.floor((s % 3600) / 60),
          s % 60,
        ].map((n) => String(n).padStart(2, "0"));
  const units = ["Days", "Hours", "Minutes", "Seconds"];

  return (
    <div className="flex w-full flex-col items-center gap-7">
      {/* the clock: the page's loudest number after the price */}
      <div className="flex flex-col items-center gap-3.5">
        <div className="flex items-stretch">
          {units.map((u, i) => (
            <div
              key={u}
              className="min-w-[4.6rem] border border-hair bg-surface/60 px-3 py-4 text-center [&:not(:first-child)]:border-l-0 md:min-w-[6rem] md:px-4 md:py-5"
            >
              <p className="font-mono text-[2.1rem] font-bold leading-none text-gold [font-variant-numeric:tabular-nums] md:text-[3rem]">
                {parts[i]}
              </p>
              <p className="mt-2 font-mono text-label uppercase tracking-[0.12em] text-dim">
                {u}
              </p>
            </div>
          ))}
        </div>
        <p className="font-mono text-label uppercase tracking-[0.1em] text-muted">
          {endsPrefix} {deadlineLabel}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3.5">
        <Button href={orderHref} variant="gradient" size="lg">
          {orderLabel}
        </Button>
        <Button href="#videos" variant="ghost">
          {videosLabel}
        </Button>
      </div>
    </div>
  );
}
