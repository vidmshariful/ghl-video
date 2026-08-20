"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Chip, EmptyState, Input, Table, Td, Th } from "@/components/portal/ui";
import { authHeader, when } from "./client";

/*
 * What actually happened to every email.
 *
 * Sends are fail-soft by design, a broken email must never break the order
 * behind it, and the price of that was silence: a failure went to a server
 * console nobody reads. This screen is where the silence ends. Four numbers
 * up top answer "is email working" in a glance, and the first thing checked
 * is the platform switch itself, because a missing key means every row on
 * the page is a skip and no amount of reading rows will say so as plainly.
 */

type Entry = {
  id: string;
  to: string;
  toName: string | null;
  subject: string;
  templateKey: string | null;
  source: string;
  status: string;
  error: string | null;
  at: string;
};

type Payload = {
  week: Record<string, number>;
  keyConfigured: boolean;
  entries: Entry[];
};

const TONE: Record<string, "good" | "bad" | "warn" | "neutral"> = {
  sent: "good",
  failed: "bad",
  skipped: "warn",
  held: "neutral",
};

const STATUS_WORD: Record<string, string> = {
  sent: "Sent",
  failed: "Failed",
  skipped: "Skipped",
  held: "Held",
};

const FILTERS = ["all", "failed", "skipped", "held", "sent"] as const;

export function EmailLogView() {
  const [data, setData] = useState<Payload | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("status", filter);
      if (q.trim()) params.set("q", q.trim());
      const r = await fetch(`/api/admin/email-log?${params}`, { headers: await authHeader() });
      const j = await r.json();
      if (!r.ok) return setErr(j.error ?? "Could not load the log.");
      setData(j as Payload);
      setErr("");
    } catch {
      setErr("Could not load the log.");
    }
  }, [filter, q]);

  useEffect(() => {
    const t = setTimeout(() => void load(), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  if (err && !data) return <p className="text-body text-error">{err}</p>;
  if (!data) return <p className="text-body text-muted">Loading the log...</p>;

  const w = data.week;

  return (
    <div className="grid gap-3">
      {!data.keyConfigured && (
        <Card tone="dark" title="Email is switched off at the platform level">
          <p className="text-body-sm text-chrome-muted">
            BREVO_API_KEY is not set on the server, so every email the
            platform tries to send is skipped. Nothing below will read as
            sent until the key is added in Vercel and the site redeployed.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            ["Sent", w.sent ?? 0, "text-green"],
            ["Failed", w.failed ?? 0, (w.failed ?? 0) > 0 ? "text-error" : "text-ink"],
            ["Skipped", w.skipped ?? 0, (w.skipped ?? 0) > 0 ? "text-gold" : "text-ink"],
            ["Held by preferences", w.held ?? 0, "text-ink"],
          ] as const
        ).map(([label, n, cls]) => (
          <Card key={label}>
            <p className="font-mono text-label uppercase text-dim">{label}</p>
            <p className={`mt-2 font-display text-h3 tabular-nums ${cls}`}>{n}</p>
            <p className="mt-1 text-body-sm text-dim">last 7 days</p>
          </Card>
        ))}
      </div>

      <Card title="The log" description="Every attempt, newest first. Open a failed row for the reason." padded={false}>
        <div className="px-5 pb-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? "primary" : "secondary"}
                  onClick={() => setFilter(f)}
                >
                  {f === "all" ? "Everything" : STATUS_WORD[f]}
                </Button>
              ))}
            </div>
            <div className="min-w-[14rem] flex-1">
              <Input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Find an address or a subject"
                aria-label="Search the email log"
              />
            </div>
          </div>

          {data.entries.length === 0 ? (
            <EmptyState
              title="Nothing here yet"
              description="Rows appear the moment the platform tries to send anything. If you expected one, the send may predate the log: recording started on 20 August 2026."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>To</Th>
                  <Th>What</Th>
                  <Th>Status</Th>
                  <Th align="right">When</Th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e) => (
                  <tr
                    key={e.id}
                    onClick={() => setOpen(open === e.id ? null : e.id)}
                    className="tap cursor-pointer align-top transition-colors hover:bg-hair/30"
                  >
                    <Td strong>
                      {e.toName ?? e.to}
                      {e.toName && (
                        <span className="block font-mono text-label uppercase text-dim">{e.to}</span>
                      )}
                    </Td>
                    <Td>
                      <span className="block max-w-[26rem] truncate">{e.subject}</span>
                      <span className="mt-0.5 block font-mono text-label uppercase text-dim">
                        {e.templateKey ?? e.source}
                      </span>
                      {open === e.id && e.error && (
                        <span className="mt-1.5 block max-w-[30rem] whitespace-pre-wrap text-body-sm text-error">
                          {e.error}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <Chip tone={TONE[e.status] ?? "neutral"}>{STATUS_WORD[e.status] ?? e.status}</Chip>
                    </Td>
                    <Td align="right">{when(e.at)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
}
