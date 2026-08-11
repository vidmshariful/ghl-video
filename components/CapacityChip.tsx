"use client";

import { useEffect, useState } from "react";
import { SB_ANON, SB_URL } from "@/lib/supabase-config";

/*
 * The live capacity chip: "N slots left this week" beside a page's
 * primary CTA, fed by the same studio_slots row the Studio Insights
 * page shows (public RLS read, anon key). Renders nothing until the
 * team has set a capacity (total 0) and nothing on any fetch problem,
 * so the page never waits on it or breaks because of it.
 */
type Row = { period_label: string; total: number; remaining: number };

export function CapacityChip({
  service,
}: {
  service: "premade" | "custom" | "editing";
}) {
  const [row, setRow] = useState<Row | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(
      `${SB_URL}/rest/v1/studio_slots?service=eq.${service}&total=gt.0&select=period_label,total,remaining`,
      {
        headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` },
        signal: ctrl.signal,
      },
    )
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Row[]) => rows[0] && setRow(rows[0]))
      .catch(() => {});
    return () => ctrl.abort();
  }, [service]);

  if (!row) return null;
  const period = row.period_label.toLowerCase();
  if (row.remaining === 0) {
    return (
      <span className="inline-flex items-center gap-2 font-mono text-label uppercase tracking-[0.1em] text-muted">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-dim" />
        Full for {period}, next window open
      </span>
    );
  }
  /* editing capacity is client intake, not production slots */
  const line =
    service === "editing"
      ? `Accepting ${row.remaining} new ${row.remaining === 1 ? "client" : "clients"} ${period}`
      : `${row.remaining} ${row.remaining === 1 ? "slot" : "slots"} left ${period}`;
  return (
    <span className="inline-flex items-center gap-2 font-mono text-label uppercase tracking-[0.1em] text-gold">
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full bg-gold motion-safe:animate-pulse"
      />
      {line}
    </span>
  );
}
