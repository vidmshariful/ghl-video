"use client";

import { useEffect, useState } from "react";
import { Input, Textarea } from "@/components/portal/ui";

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
const WL_SERVICES = [
  {
    title: "Custom video production",
    line: "Explainers, demos, and feature videos, scripted and produced for your clients' brands. You brief us, we build it, you deliver it as yours.",
  },
  {
    title: "Video editing",
    line: "Ongoing editing for your clients' content: shorts, ads, podcasts, repurposing. Your editors, as far as anyone knows.",
  },
];

const WL_STEPS = [
  {
    title: "Book the partnership call",
    line: "We map the services you want to resell and the volume you expect.",
  },
  {
    title: "Get your flat pricing",
    line: "One wholesale rate per service, the same every time. No quotes, no surprises, easy to build an offer on.",
  },
  {
    title: "Sell at your price",
    line: "Your brand, your invoice, your margin. We deliver clean, unbranded files, and your clients never hear from us.",
  },
];

export function WhiteLabelView() {
  return (
    <div className="w-full max-w-5xl">
      <h1 className="font-display text-h2 text-ink">White-label our studio</h1>
      <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
        You run an agency. Your clients keep asking for video production and
        editing. Instead of hiring a team, resell ours under your own brand:
        flat pricing to you, your price to them.
      </p>

      <h2 className="mt-8 font-display text-h4 text-ink">What you can white-label</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {WL_SERVICES.map((c) => (
          <div key={c.title} className="rounded-[12px] border border-hair bg-surface p-5">
            <p className="text-body font-semibold text-ink">{c.title}</p>
            <p className="mt-1 text-body-sm text-muted">{c.line}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-body-sm text-dim">
        White-label covers our custom production and editing services. The
        premade library stays GHL Video branded.
      </p>

      <h2 className="mt-10 font-display text-h4 text-ink">How it works</h2>
      <ol className="mt-4 grid gap-3">
        {WL_STEPS.map((st, i) => (
          <li key={st.title} className="flex gap-4 rounded-[12px] border border-hair bg-surface p-5">
            <span className="font-mono text-h4 font-semibold text-gold">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <p className="text-body font-semibold text-ink">{st.title}</p>
              <p className="mt-0.5 text-body-sm text-muted">{st.line}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-8 rounded-[12px] border border-gold/30 bg-gold/[0.04] p-6">
        <p className="font-mono text-label uppercase text-gold">Why agencies do this</p>
        <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
          Video is the service your clients ask for and the hardest one to
          staff. A HighLevel-only studio behind your brand means you say yes
          to every request, keep the margin, and never manage an editor.
        </p>
      </div>

      <h2 className="mt-10 font-display text-h4 text-ink">Book the partnership call</h2>
      <p className="mt-2 max-w-[var(--measure-body)] text-body-sm text-muted">
        Thirty minutes. You leave with your flat rates and a clear way to
        package them.
      </p>
      <div className="mt-5">
        <CalendarEmbed slug={WHITE_LABEL_CALENDAR_SLUG} title="Book: Agency Partnership / White-Label Call" />
      </div>
    </div>
  );
}

/* ---------------- Affiliate application (customer portal) ---------------- */

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
          "Welcome to the program. You earn 10% on every referred client's first order and 5% on everything they order after, for as long as they stay a client.",
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
          <p className="font-display text-h4 text-ink">You are in.</p>
          <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">{done}</p>
          <p className="mt-2 max-w-[var(--measure-body)] text-body-sm text-dim">
            Your partner portal is live: your tracked link, live stats, and
            payouts. Check your email for the way in, then sign in with this
            same email.
          </p>
          <a
            href="/partners/"
            target="_blank"
            rel="noopener"
            className="tap mt-5 inline-flex rounded-[8px] bg-brand-gradient px-6 py-2.5 text-body font-semibold text-canvas transition-all hover:brightness-110"
          >
            Open your partner portal
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-h2 text-ink">Recommend us. Get paid.</h1>
      <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
        You already know what our work does for your SaaS. Other founders in
        your network are still explaining HighLevel with screen recordings.
        Send them our way and earn a commission on every sale they make.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "You earn on every sale",
            line: "Every order and plan that comes through your link credits you. Payouts run on the program schedule.",
          },
          {
            title: "We do the selling",
            line: "Your link lands them on the studio. Our work, our reviews, and our team close them. One intro is your whole job.",
          },
          {
            title: "Track it live",
            line: "Your own partner portal shows clicks, referrals, earnings, and payout history in real time.",
          },
        ].map((c) => (
          <div key={c.title} className="rounded-[12px] border border-hair bg-surface p-5">
            <p className="text-body font-semibold text-ink">{c.title}</p>
            <p className="mt-1 text-body-sm text-muted">{c.line}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 font-display text-h4 text-ink">How it works</h2>
      <ol className="mt-4 grid gap-3">
        {[
          {
            title: "Sign up below",
            line: "Two minutes. Tell us who you would send our way.",
          },
          {
            title: "You are in instantly",
            line: "No waiting. Your partner portal and tracked link go live the moment you sign up.",
          },
          {
            title: "Share your link",
            line: "A founder friend needs a video, you send one link, and the sale credits you automatically.",
          },
        ].map((st, i) => (
          <li key={st.title} className="flex gap-4 rounded-[12px] border border-hair bg-surface p-5">
            <span className="font-mono text-h4 font-semibold text-gold">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <p className="text-body font-semibold text-ink">{st.title}</p>
              <p className="mt-0.5 text-body-sm text-muted">{st.line}</p>
            </div>
          </li>
        ))}
      </ol>

      <h2 className="mt-10 font-display text-h4 text-ink">Apply now</h2>
      <form onSubmit={submit} className="mt-4 grid gap-5 rounded-[12px] border border-hair bg-surface p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className="font-mono text-label uppercase text-muted">Your name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
          </label>
          <div className="grid gap-2">
            <span className="font-mono text-label uppercase text-muted">Email</span>
            <p className="rounded-[8px] border border-hair bg-canvas/60 px-4 py-3 text-body text-muted">{email}</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className="font-mono text-label uppercase text-muted">Main channel</span>
            <Input
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder="Your network, community, YouTube, clients"
              maxLength={120}
            />
          </label>
          <label className="grid gap-2">
            <span className="font-mono text-label uppercase text-muted">Audience</span>
            <Input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="Who follows you, roughly how many"
              maxLength={200}
            />
          </label>
        </div>
        <label className="grid gap-2">
          <span className="font-mono text-label uppercase text-muted">Links</span>
          <Input
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            placeholder="Your site, channel, or socials"
            maxLength={600}
          />
        </label>
        <label className="grid gap-2">
          <span className="font-mono text-label uppercase text-muted">Who would you send our way</span>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            rows={4}
            placeholder="Fellow SaaS founders, an agency circle, a community. A few lines is plenty."
            maxLength={2000}
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

/* ---------------- SocialX (customer portal) ---------------- */
/* Set when SocialX's site URL should be linked from the portal; empty
 * hides the button. */
const SOCIALX_URL = "";

export function SocialXView({ authedFetch }: {
  authedFetch: (path: string, init?: RequestInit) => Promise<unknown>;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const j = (await authedFetch("/api/portal/socialx/", {
        method: "POST",
        body: JSON.stringify({ message }),
      })) as { ok?: boolean; error?: string };
      setBusy(false);
      if (j.ok) setDone(true);
      else setErr(j.error ?? "Something went wrong. Try again.");
    } catch {
      setBusy(false);
      setErr("Something went wrong. Try again.");
    }
  }

  return (
    <div className="w-full max-w-4xl">
      <h1 className="font-display text-h2 text-ink">SocialX: your social media, managed</h1>
      <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
        The same studio behind your videos also runs social media for SaaS
        brands: content, design, and posting handled end to end, so your
        channels stay alive while you build.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "Made for SaaS",
            line: "Content that explains a product, not generic motivation posts. We already know your world.",
          },
          {
            title: "Videos included in the loop",
            line: "Your GHL Video work gets cut into posts, so both services feed each other.",
          },
          {
            title: "One team, no handoffs",
            line: "The people who know your brand from your videos run your feed too.",
          },
        ].map((c) => (
          <div key={c.title} className="rounded-[12px] border border-hair bg-surface p-5">
            <p className="text-body font-semibold text-ink">{c.title}</p>
            <p className="mt-1 text-body-sm text-muted">{c.line}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-[12px] border border-gold/30 bg-gold/[0.04] p-6">
        <p className="font-mono text-label uppercase text-gold">Your client deal</p>
        <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
          As a GHL Video client you get an extra <span className="font-semibold text-ink">10% off</span>,
          on top of the pricing already shown on the SocialX site. Request your
          personal code below and it lands in your inbox within a day.
        </p>
        {SOCIALX_URL ? (
          <a
            href={SOCIALX_URL}
            target="_blank"
            rel="noopener"
            className="tap mt-4 inline-flex rounded-[8px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
          >
            See the plans
          </a>
        ) : null}
      </div>

      {done ? (
        <div className="mt-6 rounded-[12px] border border-gold/40 bg-gold/[0.06] px-6 py-8">
          <p className="font-display text-h4 text-ink">Done. Your code is on the way.</p>
          <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
            We send it to your account email personally, usually within a day.
            It stacks with the pricing shown on the SocialX site.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 grid gap-4 rounded-[12px] border border-hair bg-surface p-6">
          <div>
            <p className="font-mono text-label uppercase text-muted">Get your 10% code</p>
            <p className="mt-1 text-body-sm text-dim">
              We know your account already; nothing else to fill in.
            </p>
          </div>
          <label className="grid gap-2">
            <span className="font-mono text-label uppercase text-muted">
              Anything we should know (optional)
            </span>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Which channels you care about, posting volume, timing."
              maxLength={1000}
            />
          </label>
          {err && <p className="text-body-sm text-error">{err}</p>}
          <div>
            <button
              type="submit"
              disabled={busy}
              className="tap rounded-[8px] bg-brand-gradient px-6 py-2.5 text-body font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60"
            >
              {busy ? "Sending" : "Request my code"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
