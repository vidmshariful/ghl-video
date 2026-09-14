"use client";

import { useState } from "react";

/*
 * Accept or decline, on the public quote page. The typed name is the
 * signature; the server keeps it with the time and the address. No login:
 * a lead has none yet, and the link itself is the key, the same rule as the
 * invoice page.
 */
export function QuoteActions({ token, totalLabel }: { token: string; totalLabel: string }) {
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"idle" | "declining">("idle");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);
  const [err, setErr] = useState("");

  async function send(action: "accept" | "decline") {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`/api/quotes/${token}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "accept" ? { action, name } : { action, reason }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setErr(j.error ?? "Something went wrong. Reply to the email and we will sort it.");
        return;
      }
      setDone(action === "accept" ? "accepted" : "declined");
    } finally {
      setBusy(false);
    }
  }

  if (done === "accepted") {
    return (
      <div className="rounded-[8px] border border-green/30 bg-green/[0.06] px-5 py-4">
        <p className="font-display text-h4 text-ink">Accepted. Thank you.</p>
        <p className="mt-1 text-body-sm text-muted">
          The work is booked in. Your portal login and the invoice follow by email; reply to either if anything is unclear.
        </p>
      </div>
    );
  }
  if (done === "declined") {
    return (
      <p className="text-body text-muted">Noted. Thanks for telling us. If a different scope would work, reply to the email.</p>
    );
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void send(mode === "declining" ? "decline" : "accept");
      }}
    >
      {mode === "idle" ? (
        <>
          <label className="grid gap-1.5">
            <span className="font-mono text-label uppercase text-dim">Type your name to accept</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              autoComplete="name"
              className="rounded-[3px] border border-hair bg-canvas px-3.5 py-2.5 text-body text-ink outline-none focus:border-gold"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy || name.trim().length < 2}
              className="tap inline-flex items-center gap-2 rounded-[3px] bg-brand-gradient px-8 py-3.5 text-body font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-50"
            >
              Accept {totalLabel}
            </button>
            <button
              type="button"
              onClick={() => setMode("declining")}
              className="tap rounded-[3px] border border-hair px-4 py-3 font-mono text-label uppercase text-muted hover:border-error/60 hover:text-error"
            >
              Decline
            </button>
          </div>
          <p className="font-mono text-label uppercase text-dim">Accepting books the work in. We invoice from there.</p>
        </>
      ) : (
        <>
          <label className="grid gap-1.5">
            <span className="font-mono text-label uppercase text-dim">Anything we should know? Optional</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="rounded-[3px] border border-hair bg-canvas px-3.5 py-2.5 text-body text-ink outline-none focus:border-gold"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="tap rounded-[3px] border border-error/60 px-6 py-3 text-body font-semibold text-error hover:bg-error/10 disabled:opacity-50"
            >
              Decline this quote
            </button>
            <button
              type="button"
              onClick={() => setMode("idle")}
              className="tap rounded-[3px] border border-hair px-4 py-3 font-mono text-label uppercase text-muted hover:text-ink"
            >
              Back
            </button>
          </div>
        </>
      )}
      {err && <p className="text-body-sm text-error">{err}</p>}
    </form>
  );
}
