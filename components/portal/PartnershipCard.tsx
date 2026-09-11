"use client";

import { Card, Chip, Progress } from "@/components/portal/ui";

/*
 * The partnership, as the partner reads it.
 *
 * HighLevel pays a flat monthly fee for a number of videos a month, and
 * until this existed their portal said "Not set" against every job, which
 * is the opposite of the message a partner should get. One card, on the
 * dashboard and on the Custom screen: what the month covers, what they
 * have briefed against it, what is in production right now, and the two
 * promises (turnaround, white label) said plainly.
 *
 * Shared by the customer portal and admin's "view as client", so it lives
 * in the portal part rather than under either screen.
 */
export type Partnership = {
  name: string;
  videosMin: number;
  videosMax: number;
  activeMax: number;
  turnaroundDays: number;
  whiteLabel: boolean;
  month: string;
  monthLabel: string;
  summary: {
    counted: number;
    delivered: number;
    inProduction: number;
    queued: number;
    animations: number;
    activeNow: number;
  };
  line: string;
};

export function PartnershipCard({ p }: { p: Partnership }) {
  const s = p.summary;
  const percent = Math.min(100, Math.round((s.counted / p.videosMax) * 100));
  return (
    <Card
      tone="dark"
      title={p.name}
      description={`${p.monthLabel}. ${p.line}`}
      actions={<Chip tone="good">Partner</Chip>}
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <Progress
            percent={percent}
            label={`${s.counted} of ${p.videosMax} this month, ${s.delivered} delivered, ${s.inProduction} in production, ${s.queued} waiting to start`}
          />
        </div>
        <div className="font-mono text-label uppercase tracking-[0.08em] text-chrome-muted">
          {s.activeNow} of {p.activeMax} in production now
        </div>
      </div>
      <ul className="mt-4 grid gap-1.5 text-body-sm text-chrome-muted sm:grid-cols-2">
        <li>
          Turnaround: {p.turnaroundDays} business {p.turnaroundDays === 1 ? "day" : "days"} from the
          brief, {p.activeMax} in production at a time.
        </li>
        {p.whiteLabel && <li>Every video comes with a white-label version.</li>}
        <li>
          {p.videosMin} to {p.videosMax} videos a month, covered by the partnership. Small social
          animations are included and do not count.
        </li>
        <li>Nothing here is priced per video: every job reads &quot;Included in your partnership&quot;.</li>
      </ul>
    </Card>
  );
}
