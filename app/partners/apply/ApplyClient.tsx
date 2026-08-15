"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";

/*
 * Public application for the affiliate partner program. Submits to
 * /api/partners/apply, which files it as a partners row with status
 * 'applied'; the team reviews in admin -> Partners -> Applications.
 * The hidden `website` field is the bot honeypot.
 */
const fieldCls =
  "w-full rounded-[3px] border border-hair bg-surface px-4 py-3 text-body text-ink placeholder:text-dim focus:border-gold focus:outline-none";
const labelCls = "font-mono text-label uppercase text-muted";

const CHANNELS = [
  "YouTube channel",
  "Community or group",
  "Agency clients",
  "Newsletter or blog",
  "Social audience",
  "Other",
];

export function ApplyClient() {
  const [f, setF] = useState({
    name: "",
    email: "",
    company: "",
    channel: CHANNELS[0],
    audience: "",
    links: "",
    message: "",
    website: "", // honeypot
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/partners/apply/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const j = await r.json();
      if (r.ok && j.ok) setDone(true);
      else setErr(j.error ?? "Something went wrong. Please try again.");
    } catch {
      setErr("Something went wrong. Please try again.");
    }
    setBusy(false);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-hair bg-surface px-6 py-4">
        <div className="flex items-center gap-3">
          <Logo className="h-6" />
          <span className="font-mono text-label uppercase text-muted">/ Partners</span>
        </div>
        <Link
          href="/partners"
          className="tap rounded-[3px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
        >
          Partner sign in
        </Link>
      </header>

      <section className="relative flex-1 py-12 md:py-16">
        <div className="shell">
          <div className="mx-auto max-w-xl">
            {done ? (
              <div className="rounded-card border border-gold/40 bg-gold/[0.06] px-6 py-10 text-center">
                <p className="font-mono text-label uppercase text-gold">[ Application sent ]</p>
                <h1 className="mt-4 font-display text-h2 text-ink">Thank you.</h1>
                <p className="mx-auto mt-3 max-w-md text-body text-muted">
                  We review every application by hand and reply by email, usually within a
                  couple of days. If it is a fit, you get your own partner page, tracked
                  links, and a standing discount for your audience.
                </p>
              </div>
            ) : (
              <>
                <p className="font-mono text-label uppercase text-gold">[ Partner program ]</p>
                <h1 className="mt-4 font-display text-h2 text-ink">
                  Send people to GHL Video. <span className="text-gradient">Earn on every referral.</span>
                </h1>
                <p className="mt-3 text-body text-muted">
                  Partners get a dedicated page built around them, tracked links, promo
                  assets, and a standing discount for their audience on every service:
                  premade videos, editing, and custom production.
                </p>

                <form onSubmit={submit} className="mt-10 grid gap-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className={labelCls}>Your name</span>
                      <input
                        required
                        value={f.name}
                        onChange={(e) => set("name", e.target.value)}
                        className={fieldCls}
                        autoComplete="name"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className={labelCls}>Email</span>
                      <input
                        type="email"
                        required
                        value={f.email}
                        onChange={(e) => set("email", e.target.value)}
                        className={fieldCls}
                        autoComplete="email"
                      />
                    </label>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className={labelCls}>Company or brand (optional)</span>
                      <input
                        value={f.company}
                        onChange={(e) => set("company", e.target.value)}
                        className={fieldCls}
                        autoComplete="organization"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className={labelCls}>Where is your audience?</span>
                      <select
                        value={f.channel}
                        onChange={(e) => set("channel", e.target.value)}
                        className={fieldCls}
                      >
                        {CHANNELS.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="grid gap-2">
                    <span className={labelCls}>Audience size (rough is fine)</span>
                    <input
                      value={f.audience}
                      onChange={(e) => set("audience", e.target.value)}
                      className={fieldCls}
                      placeholder="e.g. 12k YouTube subs, 3k newsletter"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className={labelCls}>Links (channel, site, community)</span>
                    <input
                      value={f.links}
                      onChange={(e) => set("links", e.target.value)}
                      className={fieldCls}
                      placeholder="https://..."
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className={labelCls}>How would you promote GHL Video?</span>
                    <textarea
                      required
                      rows={4}
                      value={f.message}
                      onChange={(e) => set("message", e.target.value)}
                      className={fieldCls}
                      placeholder="Who your audience is and where you would put your link."
                    />
                  </label>
                  {/* honeypot: hidden from people, tempting to bots */}
                  <label className="hidden" aria-hidden="true">
                    Website
                    <input
                      tabIndex={-1}
                      autoComplete="off"
                      value={f.website}
                      onChange={(e) => set("website", e.target.value)}
                    />
                  </label>
                  {err && <p className="text-body-sm text-error">{err}</p>}
                  <div>
                    <button
                      type="submit"
                      disabled={busy}
                      className="tap rounded-[3px] bg-brand-gradient px-8 py-3.5 text-body font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60"
                    >
                      {busy ? "Sending..." : "Send application"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
