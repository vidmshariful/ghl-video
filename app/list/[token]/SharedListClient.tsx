"use client";

import { useState } from "react";
import Link from "next/link";
import type { ResolvedList } from "@/lib/shared-lists";
import { Reveal } from "@/components/Reveal";

/*
 * What the second person sees.
 *
 * One job: let somebody who has never been here understand what was picked,
 * what it comes to, and say yes. So there is no nav to wander into, no
 * upsell, and no account. Two ways out, both real: buy one on its own, or
 * ask us to invoice the set, which is how buying at these prices actually
 * happens.
 */

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  });

export function SharedListClient({ list }: { list: ResolvedList }) {
  const [asking, setAsking] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });

  async function submit() {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`/api/lists/${list.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!r.ok) return setErr(j.error ?? "Could not send that.");
      setSent(true);
    } catch {
      setErr("Could not send that.");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-[3px] border border-hair bg-canvas px-3.5 py-2.5 text-body text-text placeholder:text-dim focus:border-gold focus:outline-none";

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-16 md:py-24">
      <Reveal>
        <p className="font-mono text-label uppercase tracking-[0.14em] text-dim">
          {list.ownerName ? `${list.ownerName} shared this with you` : "Shared with you"}
        </p>
        <h1 className="mt-3 font-display text-h2 tracking-tight text-text">{list.title}</h1>
        {list.note && (
          <p className="mt-4 max-w-[var(--measure-body)] whitespace-pre-wrap text-lede text-muted">
            {list.note}
          </p>
        )}
      </Reveal>

      {list.items.length === 0 ? (
        <p className="mt-10 text-body text-muted">
          There is nothing on this list yet.
        </p>
      ) : (
        <>
          <Reveal>
            <ul className="mt-10 grid gap-3">
              {list.items.map((i) => (
                <li
                  key={i.code}
                  className="flex flex-wrap items-center gap-4 rounded-card border border-hair bg-surface p-4"
                >
                  {i.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={i.posterUrl}
                      alt=""
                      className="h-16 w-28 shrink-0 rounded-media object-cover"
                    />
                  ) : (
                    <div className="h-16 w-28 shrink-0 rounded-media border border-hair bg-card" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-semibold text-text">{i.title}</p>
                    <p className="mt-0.5 font-mono text-label uppercase text-dim">
                      {i.category ?? i.kind} / {i.code.toUpperCase()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <span className="font-mono text-price font-bold tabular-nums text-text">
                      {money(i.priceCents)}
                    </span>
                    {i.buyHref && (
                      <Link
                        href={i.buyHref}
                        className="tap rounded-[3px] border border-hair px-3.5 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
                      >
                        Order Now
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-hair pt-6">
              <div>
                <p className="font-mono text-label uppercase tracking-[0.12em] text-dim">
                  {list.items.length} {list.items.length === 1 ? "video" : "videos"}
                </p>
                <p className="mt-1 font-display text-h3 tabular-nums text-gold">
                  {money(list.totalCents)}
                </p>
                {list.priceChanged && (
                  <p className="mt-1 text-body-sm text-muted">
                    Prices have moved since this was shared. This is the current
                    total.
                  </p>
                )}
              </div>
              {!sent && (
                <button
                  type="button"
                  onClick={() => setAsking((v) => !v)}
                  className="tap rounded-[3px] bg-[image:var(--brand-gradient)] px-6 py-3 font-display text-body font-semibold text-canvas transition-opacity hover:opacity-90"
                >
                  Ask us to invoice these
                </button>
              )}
            </div>
          </Reveal>

          {sent ? (
            <div className="mt-6 rounded-card border border-green/40 bg-green/[0.05] p-6">
              <p className="text-body font-semibold text-text">Got it.</p>
              <p className="mt-1 max-w-[var(--measure-body)] text-body text-muted">
                We will send the invoice to that address, usually the same day.
                Once it is paid we start, and everything lands in a portal you
                can watch and approve from.
              </p>
            </div>
          ) : asking ? (
            <div className="mt-6 rounded-card border border-hair bg-surface p-6">
              <p className="text-body font-semibold text-text">
                Where should the invoice go?
              </p>
              <p className="mt-1 max-w-[var(--measure-body)] text-body-sm text-muted">
                Most companies at this size would rather pay an invoice than put
                it on somebody&apos;s card. Tell us where to send it.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="font-mono text-label uppercase text-muted">Your name</span>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={field}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="font-mono text-label uppercase text-muted">Email</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={field}
                  />
                </label>
                <label className="grid gap-2 sm:col-span-2">
                  <span className="font-mono text-label uppercase text-muted">Company</span>
                  <input
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    className={field}
                  />
                </label>
                <label className="grid gap-2 sm:col-span-2">
                  <span className="font-mono text-label uppercase text-muted">
                    Anything we should know
                  </span>
                  <textarea
                    rows={3}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className={field}
                    placeholder="A purchase order number, a deadline, a change to the list."
                  />
                </label>
              </div>
              {err && <p className="mt-4 text-body-sm text-error">{err}</p>}
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy || !form.name.trim() || !form.email.trim()}
                  onClick={submit}
                  className="tap rounded-[3px] bg-[image:var(--brand-gradient)] px-6 py-3 font-display text-body font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {busy ? "Sending..." : "Send it"}
                </button>
                <button
                  type="button"
                  onClick={() => setAsking(false)}
                  className="tap rounded-[3px] border border-hair px-5 py-3 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <p className="mt-12 border-t border-hair pt-6 text-body-sm text-dim">
        Videos made for HighLevel SaaS, from a studio creating HighLevel videos
        since 2020.{" "}
        <Link href="/premade/" className="text-muted underline underline-offset-2 hover:text-gold">
          See the whole library
        </Link>
        .
      </p>
    </main>
  );
}
