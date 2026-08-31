"use client";

import { useState } from "react";

/*
 * The quote form, in the sales surface's own skin.
 *
 * Deliberately NOT the marketing site's QuoteForm. That one is importable
 * from here, being a top level component, and reusing it was the first
 * instinct: same five fields, same endpoint, no duplicated logic. But it is
 * styled in the main site's tokens, 3px controls on --surface, and this page
 * is the .sp system, 12px controls on --sp-panel. Dropping it in reads as a
 * form borrowed from another website, which on the one screen where somebody
 * decides to hand over their details is the wrong thing to save time on.
 *
 * What is shared is the part that matters: /api/quote, which creates the
 * contact, tags it, writes the brief as a note and opens the opportunity.
 * The look is per surface, the contract is not.
 */
type Status = "idle" | "sending" | "sent" | "error";

export function QuoteRequest({ formats }: { formats: readonly string[] }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setStatus("sending");
    setError(null);
    try {
      const r = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          company: data.get("company"),
          type: data.get("type"),
          details: data.get("details"),
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setError(j.error ?? "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="sp-quote-done">
        <p className="sp-display sp-h3">Got it.</p>
        <p className="sp-muted" style={{ marginTop: "0.6rem" }}>
          A human reads every brief and comes back with a fixed price and a real
          timeline within 24 hours. Nothing automated, and no discovery call
          before you have a number.
        </p>
      </div>
    );
  }

  const busy = status === "sending";

  return (
    <form className="sp-form" onSubmit={submit} noValidate={false}>
      <div className="sp-form-row">
        <label className="sp-field">
          <span className="sp-field-label">Your name</span>
          <input name="name" required maxLength={120} className="sp-input" autoComplete="name" />
        </label>
        <label className="sp-field">
          <span className="sp-field-label">Work email</span>
          <input
            name="email"
            type="email"
            required
            maxLength={200}
            className="sp-input"
            autoComplete="email"
          />
        </label>
      </div>

      <div className="sp-form-row">
        <label className="sp-field">
          <span className="sp-field-label">Company</span>
          <input
            name="company"
            required
            maxLength={160}
            className="sp-input"
            autoComplete="organization"
          />
        </label>
        <label className="sp-field">
          <span className="sp-field-label">What you need</span>
          <select name="type" required className="sp-input sp-select" defaultValue="">
            <option value="" disabled>
              Pick a format
            </option>
            {formats.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
            <option value="Not sure yet">Not sure yet</option>
          </select>
        </label>
      </div>

      <label className="sp-field">
        <span className="sp-field-label">What are you selling, and to whom?</span>
        <textarea
          name="details"
          required
          rows={5}
          maxLength={4000}
          className="sp-input sp-textarea"
          placeholder="Your platform, your ICP, what the video has to do, and any deadline you are working to."
        />
      </label>

      {error && <p className="sp-form-error">{error}</p>}

      <button type="submit" className="sp-btn sp-btn--primary" disabled={busy}>
        {busy ? "Sending..." : "Request a Quote"}
      </button>
      <p className="sp-muted" style={{ fontSize: "0.86rem" }}>
        A fixed price within 24 hours. No call needed to get a number.
      </p>
    </form>
  );
}
