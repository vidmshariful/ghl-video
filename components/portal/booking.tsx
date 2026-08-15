"use client";

import { useEffect, useState } from "react";

/*
 * Booking and growth views for the customer and partner portals: calls are
 * booked INSIDE the portal (no bounce to the website), the affiliate
 * program has an in-portal application, and the white-label pitch books
 * straight onto its call.
 *
 * Calendars are LeadConnector embeds, the same widget the contact page
 * runs: the iframe mounts once and the resize script is re-appended after
 * it exists so every widget step (date grid, details form) stays fully
 * visible.
 */

/* PLACEHOLDER until the dedicated calendar exists: swap this slug for
 * Tanvir's own calendar id and nothing else has to change. */
const PRODUCER_CALENDAR_SLUG = "quick-questions";
const PRODUCER_NAME = "Tanvir Prince";
/* the real Custom Video Strategy Call and White-Label calendars */
const CUSTOM_VIDEO_CALENDAR_SLUG = "quick-questionsm04owt";
const WHITE_LABEL_CALENDAR_SLUG = "quick-questionsrhuy1u844j7q";

const LC_EMBED_SRC = "https://link.msgsndr.com/js/form_embed.js";

function CalendarEmbed({ slug, title }: { slug: string; title: string }) {
  // re-append the resize script after the iframe exists so LeadConnector
  // re-scans and sizes the frame to each widget step
  useEffect(() => {
    document.querySelector(`script[src="${LC_EMBED_SRC}"]`)?.remove();
    const s = document.createElement("script");
    s.src = LC_EMBED_SRC;
    s.async = true;
    document.body.appendChild(s);
  }, [slug]);

  return (
    <div className="overflow-hidden rounded-[12px] border border-hair bg-black">
      <iframe
        key={slug}
        src={`https://api.leadconnectorhq.com/widget/bookings/${slug}`}
        title={title}
        id={`lc-booking-${slug}`}
        scrolling="no"
        className="-mt-6 block w-full max-w-full border-0 lg:-mt-[60px]"
        style={{ minHeight: "46rem", overflow: "hidden" }}
      />
    </div>
  );
}

/* ---------------- Book a Call ---------------- */
export function BookACallView() {
  const [tab, setTab] = useState<"producer" | "custom">("producer");
  const [visited, setVisited] = useState<("producer" | "custom")[]>(["producer"]);

  const open = (t: "producer" | "custom") => {
    setTab(t);
    setVisited((v) => (v.includes(t) ? v : [...v, t]));
  };

  const tabs = [
    { key: "producer" as const, label: "Talk to your producer" },
    { key: "custom" as const, label: "Start a custom video" },
  ];

  return (
    <div className="w-full max-w-5xl">
      <h1 className="font-display text-h2 text-ink">Book a Call</h1>
      <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
        Pick a time right here, no forms, no email chains.
      </p>

      <div className="mt-6 inline-flex rounded-[8px] border border-hair bg-surface p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => open(t.key)}
            className={`tap rounded-[6px] px-4 py-2 font-mono text-label uppercase transition-colors ${
              tab === t.key ? "bg-gold/15 font-bold text-gold" : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* both panels stay mounted once opened; only the active one shows */}
      <div hidden={tab !== "producer"} className="mt-6">
        <p className="max-w-[var(--measure-body)] text-body text-muted">
          {PRODUCER_NAME} is the executive producer who runs your projects and
          communication. Questions on a project, a revision, timelines, or
          anything mid-production: grab a slot.
        </p>
        <div className="mt-5">
          {visited.includes("producer") && (
            <CalendarEmbed slug={PRODUCER_CALENDAR_SLUG} title={`Book: ${PRODUCER_NAME}`} />
          )}
        </div>
      </div>
      <div hidden={tab !== "custom"} className="mt-6">
        <p className="max-w-[var(--measure-body)] text-body text-muted">
          Need a new video? A fully custom explainer, demo, or feature video,
          scripted and produced around your brand and offer. This call scopes
          it: what you need, what it costs, and when it lands.
        </p>
        <div className="mt-5">
          {visited.includes("custom") && (
            <CalendarEmbed slug={CUSTOM_VIDEO_CALENDAR_SLUG} title="Book: Custom Video Strategy Call" />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- White-label ---------------- */
export function WhiteLabelView() {
  return (
    <div className="w-full max-w-5xl">
      <h1 className="font-display text-h2 text-ink">White-label our studio</h1>
      <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
        Run an agency or serve HighLevel clients? Offer our videos under your
        own brand: your name on the work, our team behind it.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "Your brand on everything",
            line: "Explainers, demos, and editing delivered clean, ready to hand to your clients as yours.",
          },
          {
            title: "Agency pricing",
            line: "Wholesale rates that leave room for your margin on every project.",
          },
          {
            title: "We stay invisible",
            line: "Your clients never hear from us. You own the relationship end to end.",
          },
        ].map((c) => (
          <div key={c.title} className="rounded-[12px] border border-hair bg-surface p-5">
            <p className="text-body font-semibold text-ink">{c.title}</p>
            <p className="mt-1 text-body-sm text-muted">{c.line}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 font-display text-h4 text-ink">Talk it through</h2>
      <p className="mt-2 max-w-[var(--measure-body)] text-body-sm text-muted">
        Grab a slot on the partnership call and we will map your offer,
        volume, and pricing together.
      </p>
      <div className="mt-5">
        <CalendarEmbed slug={WHITE_LABEL_CALENDAR_SLUG} title="Book: Agency Partnership / White-Label Call" />
      </div>
    </div>
  );
}

/* ---------------- Affiliate application (customer portal) ---------------- */
const fieldCls =
  "w-full rounded-[8px] border border-hair bg-canvas px-4 py-3 text-body text-ink placeholder:text-dim focus:border-gold focus:outline-none";

export function AffiliateApplyView({
  prefillName,
  prefillEmail,
}: {
  prefillName: string;
  prefillEmail: string;
}) {
  const [name, setName] = useState(prefillName);
  const [email] = useState(prefillEmail);
  const [channel, setChannel] = useState("");
  const [audience, setAudience] = useState("");
  const [links, setLinks] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/partners/apply/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, channel, audience, links, message }),
      });
      const j = await r.json();
      setBusy(false);
      if (!r.ok) return setErr(j.error ?? "Something went wrong. Try again.");
      setDone(
        j.note ??
          "Application received. We review every one by hand and reply by email, usually within a couple of days.",
      );
    } catch {
      setBusy(false);
      setErr("Something went wrong. Try again.");
    }
  }

  if (done) {
    return (
      <div className="max-w-3xl">
        <h1 className="font-display text-h2 text-ink">Affiliate program</h1>
        <div className="mt-8 rounded-[12px] border border-gold/40 bg-gold/[0.06] px-6 py-8">
          <p className="font-display text-h4 text-ink">Application received.</p>
          <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">{done}</p>
          <p className="mt-2 max-w-[var(--measure-body)] text-body-sm text-dim">
            Once approved you get your own partner portal: tracked links, promo
            assets, live stats, and a standing discount for your audience.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-h2 text-ink">Affiliate program</h1>
      <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
        Recommend GHL Video to your audience and earn on every sale. Your
        people get a standing discount, you get tracked links, promo assets,
        and recurring commissions.
      </p>

      <form onSubmit={submit} className="mt-8 grid gap-5 rounded-[12px] border border-hair bg-surface p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className="font-mono text-label uppercase text-muted">Your name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} className={fieldCls} />
          </label>
          <div className="grid gap-2">
            <span className="font-mono text-label uppercase text-muted">Email</span>
            <p className="rounded-[8px] border border-hair bg-canvas/60 px-4 py-3 text-body text-muted">{email}</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className="font-mono text-label uppercase text-muted">Main channel</span>
            <input
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder="YouTube, newsletter, community, clients"
              maxLength={120}
              className={fieldCls}
            />
          </label>
          <label className="grid gap-2">
            <span className="font-mono text-label uppercase text-muted">Audience</span>
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="Who follows you, roughly how many"
              maxLength={200}
              className={fieldCls}
            />
          </label>
        </div>
        <label className="grid gap-2">
          <span className="font-mono text-label uppercase text-muted">Links</span>
          <input
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            placeholder="Your site, channel, or socials"
            maxLength={600}
            className={fieldCls}
          />
        </label>
        <label className="grid gap-2">
          <span className="font-mono text-label uppercase text-muted">How would you promote us</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            rows={4}
            placeholder="A few lines is plenty."
            maxLength={2000}
            className={fieldCls}
          />
        </label>
        {err && <p className="text-body-sm text-error">{err}</p>}
        <div>
          <button
            type="submit"
            disabled={busy}
            className="tap rounded-[8px] bg-brand-gradient px-6 py-2.5 text-body font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60"
          >
            {busy ? "Sending" : "Apply to the program"}
          </button>
        </div>
      </form>
    </div>
  );
}
