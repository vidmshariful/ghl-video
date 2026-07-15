"use client";

import { useState } from "react";
import { pages, site } from "@/lib/site";

/*
 * The five-field quote form. INTERIM TRANSPORT: submitting opens a
 * prefilled email to hi@ghlvideo.com so the page works today; the
 * LeadConnector form replaces this at launch (PLACEHOLDER, flagged).
 * Field set is locked by the plan: name, email, company, type, details.
 */
const inputCls =
  "w-full rounded-[3px] border border-hair bg-surface px-4 py-3.5 text-body text-ink placeholder:text-dim focus:border-gold focus:outline-none";

export function QuoteForm() {
  const q = pages.quote;
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="rounded-[3px] border border-gold/40 bg-gold/5 px-6 py-8 text-center">
        <p className="font-display text-h3 text-ink">{q.confirmation}</p>
        <p className="mt-2 text-body text-muted">
          Your email app has the request; hit send and it is with us.
        </p>
      </div>
    );
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const body = [
          `Name: ${data.get("name")}`,
          `Email: ${data.get("email")}`,
          `Company / SaaS: ${data.get("company")}`,
          `Video type: ${data.get("type")}`,
          "",
          `${data.get("details")}`,
        ].join("\n");
        window.location.href = `mailto:${site.email}?subject=${encodeURIComponent(
          `Quote request: ${data.get("company")}`,
        )}&body=${encodeURIComponent(body)}`;
        setSent(true);
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="font-mono text-label uppercase text-muted">
            {q.fields.name}
          </span>
          <input name="name" required autoComplete="name" className={inputCls} />
        </label>
        <label className="grid gap-2">
          <span className="font-mono text-label uppercase text-muted">
            {q.fields.email}
          </span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className={inputCls}
          />
        </label>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="font-mono text-label uppercase text-muted">
            {q.fields.company}
          </span>
          <input name="company" required className={inputCls} />
        </label>
        <label className="grid gap-2">
          <span className="font-mono text-label uppercase text-muted">
            {q.fields.type}
          </span>
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
        <span className="font-mono text-label uppercase text-muted">
          {q.fields.details}
        </span>
        <textarea
          name="details"
          required
          rows={5}
          placeholder="The goal, the audience, anything you already know you want."
          className={`${inputCls} resize-y`}
        />
      </label>
      <div>
        <button
          type="submit"
          className="group inline-flex items-center gap-2.5 rounded-[3px] bg-brand-gradient px-10 py-[18px] text-body font-semibold text-canvas shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_28px_rgba(0,204,0,0.28)] transition-all duration-200 hover:brightness-[1.07] active:scale-[0.98] max-sm:w-full"
        >
          Send request
          <span
            aria-hidden="true"
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          >
            &rarr;
          </span>
        </button>
      </div>
    </form>
  );
}
