"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { TIERS } from "@/lib/partner-program";

/*
 * The public partnership program page: the Tier 1 pitch with real rates
 * (from lib/partner-program, the program's source of truth), the other two
 * tiers listed as invitation-only and by-agreement, and the instant-approval
 * signup. Submitting creates an ACTIVE affiliate partner on the spot (see
 * /api/partners/apply). The hidden `website` field is the bot honeypot.
 */
const fieldCls =
  "w-full rounded-[8px] border border-hair bg-surface px-4 py-3 text-body text-ink placeholder:text-dim focus:border-gold focus:outline-none";
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
  const [agreed, setAgreed] = useState(false);
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
          className="tap rounded-[8px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
        >
          Partner sign in
        </Link>
      </header>

      <section className="relative flex-1 py-12 md:py-16">
        <div className="shell">
          <div className="mx-auto max-w-2xl">
            {done ? (
              <div className="rounded-[12px] border border-gold/40 bg-gold/[0.06] px-6 py-10 text-center">
                <p className="font-mono text-label uppercase text-gold">[ You are in ]</p>
                <h1 className="mt-4 font-display text-h2 text-ink">Welcome to the program.</h1>
                <p className="mx-auto mt-3 max-w-md text-body text-muted">
                  Your partner portal is live: your tracked link, live stats, and
                  payouts. Check your email for the way in, then sign in with the
                  same email you just used.
                </p>
                <Link
                  href="/partners"
                  className="tap mt-6 inline-flex rounded-[8px] bg-brand-gradient px-8 py-3.5 text-body font-semibold text-canvas transition-all hover:brightness-110"
                >
                  Open your partner portal
                </Link>
              </div>
            ) : (
              <>
                <p className="font-mono text-label uppercase text-gold">[ Partnership program ]</p>
                <h1 className="mt-4 font-display text-h2 text-ink">
                  Send people to GHL Video. <span className="text-gradient">Earn for the life of the client.</span>
                </h1>
                <p className="mt-3 max-w-[var(--measure-body)] text-body text-muted">
                  {TIERS.affiliate.copy}
                </p>

                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[12px] border border-gold/40 bg-gold/[0.06] p-5">
                    <p className="font-mono text-label uppercase text-gold">{TIERS.affiliate.name}</p>
                    <p className="mt-2 font-display text-h3 font-semibold text-ink">
                      {TIERS.affiliate.firstOrderPct}% <span className="text-body text-muted">first order</span>
                    </p>
                    <p className="font-display text-h4 font-semibold text-ink">
                      {TIERS.affiliate.followOnPct}% <span className="text-body-sm text-muted">every order after, for life</span>
                    </p>
                    <p className="mt-2 text-body-sm text-muted">Open signup. You are in instantly, below.</p>
                  </div>
                  <div className="rounded-[12px] border border-hair bg-surface p-5">
                    <p className="font-mono text-label uppercase text-muted">{TIERS.vip.name}</p>
                    <p className="mt-2 font-display text-h4 font-semibold text-ink">
                      {TIERS.vip.firstOrderPct}% / {TIERS.vip.followOnPct}%
                    </p>
                    <p className="mt-2 text-body-sm text-muted">
                      Invitation only: a dedicated page under your name and 10% off for
                      your audience. Earned through sustained referrals.
                    </p>
                  </div>
                  <div className="rounded-[12px] border border-hair bg-surface p-5">
                    <p className="font-mono text-label uppercase text-muted">{TIERS.partnership.name}</p>
                    <p className="mt-2 font-display text-h4 font-semibold text-ink">
                      {TIERS.partnership.firstOrderPct}% / {TIERS.partnership.followOnPct}%
                    </p>
                    <p className="mt-2 text-body-sm text-muted">
                      By signed agreement, limited seats: a co-branded page and dedicated
                      account handling for platforms and studios.
                    </p>
                  </div>
                </div>

                <h2 className="mt-10 font-display text-h4 text-ink">Join as an Affiliate Partner</h2>
                <form onSubmit={submit} className="mt-5 grid gap-5">
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
                  <label className="flex items-start gap-3 text-body-sm text-muted">
                    <input
                      type="checkbox"
                      required
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      className="mt-1 h-4 w-4 accent-[#FCC000]"
                    />
                    <span>
                      I agree to the{" "}
                      <a
                        href="/legal/partner-terms/"
                        target="_blank"
                        rel="noopener"
                        className="text-gold hover:brightness-110"
                      >
                        partner program terms
                      </a>
                      : link-based tracking, commission on net revenue, no
                      self-referral, no brand bidding.
                    </span>
                  </label>
                  {err && <p className="text-body-sm text-error">{err}</p>}
                  <div>
                    <button
                      type="submit"
                      disabled={busy || !agreed}
                      className="tap rounded-[8px] bg-brand-gradient px-8 py-3.5 text-body font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60"
                    >
                      {busy ? "One moment..." : "Join the program"}
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
