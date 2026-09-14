"use client";

import { useState } from "react";
import { Button, Card, Chip, Progress } from "@/components/portal/ui";
import { chatPostJson } from "@/components/chat/api";

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
  /* the agreement (phase 5): accepted with a typed name, or waiting for the owner's */
  monthlyCents?: number;
  startedOn?: string;
  note?: string | null;
  agreedOn?: string | null;
  agreedBy?: string | null;
  canAccept?: boolean;
};

const money = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/*
 * The agreement, inside the card: the terms in writing and one typed name
 * to accept them (owner decision, 14 September 2026: our page, not a
 * document built elsewhere). A teammate reads; the owner signs.
 */
function Agreement({ p, onAccepted }: { p: Partnership; onAccepted: (agreedOn: string, agreedBy: string) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (p.agreedOn) {
    return (
      <p className="mt-4 border-t border-white/10 pt-3 font-mono text-label uppercase tracking-[0.08em] text-chrome-muted">
        Agreement accepted {day(p.agreedOn)}{p.agreedBy ? ` by ${p.agreedBy}` : ""}
      </p>
    );
  }
  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      <p className="text-body-sm font-semibold text-chrome-text">The agreement</p>
      <p className="mt-1 text-body-sm text-chrome-muted">
        {p.monthlyCents ? `${money(p.monthlyCents)} a month, paid upfront on the first, ` : ""}
        for {p.videosMin} to {p.videosMax} videos a month, {p.activeMax} in production at a time, {p.turnaroundDays} business days each
        {p.whiteLabel ? ", every one with a white-label version" : ""}
        {p.startedOn ? `, from ${day(p.startedOn)}` : ""}. Small social animations are included and do not count.
        {p.note ? ` ${p.note}` : ""}
      </p>
      {p.canAccept ? (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setErr("");
            try {
              const j = await chatPostJson<{ error?: string; agreedOn?: string; agreedBy?: string }>("/api/portal/agreement/", { name });
              if (j.error) setErr(String(j.error));
              else onAccepted(String(j.agreedOn), String(j.agreedBy));
            } finally {
              setBusy(false);
            }
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Type your name to accept"
            aria-label="Type your name to accept the agreement"
            className="min-w-[14rem] rounded-[8px] border border-white/15 bg-transparent px-3 py-2 text-body-sm text-chrome-text outline-none focus:border-gold"
          />
          <Button variant="brand" size="sm" type="submit" disabled={busy || name.trim().length < 2}>
            Accept the agreement
          </Button>
          {err && <span className="text-body-sm text-error">{err}</span>}
        </form>
      ) : (
        <p className="mt-2 font-mono text-label uppercase text-chrome-muted">Waiting for the account owner to accept</p>
      )}
    </div>
  );
}

export function PartnershipCard({ p: initial }: { p: Partnership }) {
  const [p, setP] = useState(initial);
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
      {p.monthlyCents !== undefined && (
        <Agreement p={p} onAccepted={(agreedOn, agreedBy) => setP({ ...p, agreedOn, agreedBy })} />
      )}
    </Card>
  );
}
