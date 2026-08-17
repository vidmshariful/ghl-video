"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/portal/ui";
import { authHeader } from "./client";

/*
 * Health: what is broken, in the owner's words.
 *
 * Two things shape this screen. The first is that a quiet day should look
 * unmistakably quiet, so nothing here competes for attention when there is
 * nothing to attend to. The second is that a person arriving because their
 * phone buzzed needs the answer in one line, not a stack trace: what broke,
 * how many times, and what to do about it. The technical detail is present
 * but folded away underneath.
 */

type Alarm = {
  id: string;
  kind: string;
  title: string;
  severity: string;
  message: string;
  context: Record<string, unknown>;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
};


const when = (iso: string) => {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

export function HealthScreen() {
  const [open, setOpen] = useState<Alarm[] | null>(null);
  const [resolved, setResolved] = useState<Alarm[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    setErr("");
    try {
      const r = await fetch("/api/admin/alarms", { headers: await authHeader() });
      const j = await r.json();
      if (!r.ok) return setErr(j.error ?? "Could not load this.");
      setOpen(j.open as Alarm[]);
      setResolved(j.resolved as Alarm[]);
    } catch {
      setErr("Could not load this.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function sendTest() {
    setBusy("test");
    await fetch("/api/admin/alarms", {
      method: "POST",
      headers: await authHeader(),
    }).catch(() => null);
    setBusy(null);
    await load();
  }

  async function setResolvedState(a: Alarm, reopen: boolean) {
    setBusy(a.id);
    await fetch("/api/admin/alarms", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ id: a.id, reopen }),
    }).catch(() => null);
    setBusy(null);
    await load();
  }

  if (err && !open) return <p className="text-body text-error">{err}</p>;
  if (!open) return <p className="text-body text-muted">Loading...</p>;

  const critical = open.filter((a) => a.severity === "critical");

  return (
    <div className="w-full">
      <div>
        <h1 className="font-display text-h2 text-ink">Health</h1>
        <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
          Anything that broke and has not been handled. Most faults on the payment
          path fix themselves on a retry, so what lands here is what did not.
        </p>
      </div>

      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}

      {open.length === 0 ? (
        <div className="mt-8 rounded-[12px] border border-green/30 bg-surface p-8 text-center">
          <p className="text-body font-semibold text-ink">Nothing needs you.</p>
          <p className="mt-1 text-body-sm text-muted">
            No open problems. You will get an email and a bell the moment that changes.
          </p>
        </div>
      ) : (
        <>
          {critical.length > 0 && (
            <p className="mt-6 rounded-[8px] border border-error/40 bg-error/5 px-4 py-3 text-body-sm text-ink">
              <strong className="text-error">
                {critical.length} {critical.length === 1 ? "thing needs" : "things need"} you today.
              </strong>{" "}
              These do not fix themselves.
            </p>
          )}

          <ul className="mt-6 grid gap-3">
            {open.map((a) => {
              const isCritical = a.severity === "critical";
              return (
                <li
                  key={a.id}
                  className={`rounded-[12px] border bg-surface p-5 ${
                    isCritical ? "border-error/40" : "border-hair"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                    <div className="min-w-[16rem] flex-1">
                      <p className="text-body font-semibold text-ink">
                        {a.title}
                        {isCritical && (
                          <span className="ml-2 rounded-full border border-error/50 px-2 py-0.5 font-mono text-label uppercase text-error">
                            Needs you
                          </span>
                        )}
                      </p>
                      <p className="mt-1.5 text-body-sm text-muted">{a.message}</p>
                      <p className="mt-2 font-mono text-label uppercase tracking-[0.08em] text-dim">
                        {a.count > 1 ? `${a.count} times, last ` : "First seen "}
                        {when(a.lastSeenAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => setExpanded((e) => ({ ...e, [a.id]: !e[a.id] }))}
                      >
                        {expanded[a.id] ? "Hide detail" : "Detail"}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={busy === a.id}
                        onClick={() => setResolvedState(a, false)} className="hover:border-green/60 hover:text-green"
                      >
                        {busy === a.id ? "Saving..." : "Mark handled"}
                      </Button>
                    </div>
                  </div>

                  {expanded[a.id] && (
                    <div className="mt-4 rounded-[8px] border border-hair bg-canvas p-4">
                      <ul className="grid gap-1.5">
                        {Object.entries(a.context).map(([k, v]) => (
                          <li key={k} className="break-all font-mono text-body-sm text-muted">
                            <span className="text-dim">{k}:</span> {String(v)}
                          </li>
                        ))}
                        <li className="break-all font-mono text-body-sm text-dim">
                          kind: {a.kind}
                        </li>
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {resolved.length > 0 && (
        <div className="mt-10">
          <button
            type="button"
            onClick={() => setShowHistory((s) => !s)}
            className="font-mono text-label uppercase tracking-[0.1em] text-dim transition-colors hover:text-gold"
          >
            {showHistory ? "Hide" : "Show"} what has been handled ({resolved.length})
          </button>
          {showHistory && (
            <ul className="mt-3 grid gap-2">
              {resolved.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-hair bg-surface px-4 py-3"
                >
                  <span className="text-body-sm text-muted">
                    {a.title}
                    {a.count > 1 && <span className="text-dim"> ({a.count} times)</span>}
                    {a.resolvedBy && (
                      <span className="text-dim"> handled by {a.resolvedBy}</span>
                    )}
                  </span>
                  <Button
                    variant="secondary"
                    disabled={busy === a.id}
                    onClick={() => setResolvedState(a, true)}
                  >
                    Reopen
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-10 border-t border-hair pt-6">
        <p className="max-w-[var(--measure-body)] text-body-sm text-dim">
          Marking something handled is a claim that it is fixed, not a way to hide
          it. If the same problem happens again it comes straight back to this list
          and you are told again.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            disabled={busy === "test"}
            onClick={sendTest}
          >
            {busy === "test" ? "Sending..." : "Send me a test alarm"}
          </Button>
          <span className="text-body-sm text-dim">
            Nothing breaks. You get the real bell and the real email, so you know
            what one looks like before it matters.
          </span>
        </div>
      </div>
    </div>
  );
}
