"use client";

import { useState } from "react";
import { pages } from "@/lib/site";

/*
 * The five-field quote form. Submits to /api/quote, which creates the lead in
 * HighLevel (contact + `website-quote-request` tag + project-brief note +
 * setter-pipeline opportunity). Success only shows after the server confirms;
 * errors surface inline. Field set locked by the plan: name, email, company,
 * type, details.
 */
const inputCls =
  "w-full rounded-[3px] border border-hair bg-surface px-4 py-3.5 text-body text-ink placeholder:text-dim focus:border-gold focus:outline-none";

type Status = "idle" | "sending" | "sent" | "error";

export function QuoteForm() {
  const q = pages.quote;
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  if (status === "sent") {
    return (
      <div className="rounded-[3px] border border-gold/40 bg-gold/5 px-6 py-8 text-center">
        <p className="font-display text-h3 text-ink">{q.confirmation}</p>
        <p className="mt-2 text-body text-muted">
          We have it. A human reads every request and replies with a fixed price
          and a real timeline within 24 hours.
        </p>
      </div>
    );
  }

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
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(j.error ?? "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setError("Network error. Please try again, or email hi@ghlvideo.com.");
      setStatus("error");
    }
  }

  return (
    <form className="grid gap-5" onSubmit={submit}>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="font-mono text-label uppercase text-muted">{q.fields.name}</span>
          <input name="name" required autoComplete="name" className={inputCls} />
        </label>
        <label className="grid gap-2">
          <span className="font-mono text-label uppercase text-muted">{q.fields.email}</span>
          <input name="email" type="email" required autoComplete="email" className={inputCls} />
        </label>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="font-mono text-label uppercase text-muted">{q.fields.company}</span>
          <input name="company" required className={inputCls} />
        </label>
        <label className="grid gap-2">
          <span className="font-mono text-label uppercase text-muted">{q.fields.type}</span>
          <select name="type" required defaultValue="" className={inputCls}>
            <option value="" disabled>
              Pick one
            </option>
            {pages.quote.types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="grid gap-2">
        <span className="font-mono text-label uppercase text-muted">{q.fields.details}</span>
        <textarea
          name="details"
          required
          rows={5}
          placeholder="The goal, the audience, anything you already know you want."
          className={`${inputCls} resize-y`}
        />
      </label>
      {error ? (
        <p role="alert" className="text-body-sm text-error">
          {error}
        </p>
      ) : null}
      <div>
        <button
          type="submit"
          disabled={status === "sending"}
          className="group inline-flex items-center gap-2.5 rounded-[3px] bg-brand-gradient px-10 py-[18px] text-body font-semibold text-canvas shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_28px_rgba(0,204,0,0.28)] transition-all duration-200 hover:brightness-[1.07] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 max-sm:w-full"
        >
          {status === "sending" ? "Sending..." : "Send request"}
          {status !== "sending" ? (
            <span
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            >
              &rarr;
            </span>
          ) : null}
        </button>
      </div>
    </form>
  );
}
