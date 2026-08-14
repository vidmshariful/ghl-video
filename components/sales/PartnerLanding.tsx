import { existsSync } from "node:fs";
import { join } from "node:path";
import { SpVideo } from "@/components/sales/SpVideo";
import type { PartnerSalesPage } from "@/lib/sales/pages";
import { affiliateByRef } from "@/lib/affiliates";
import {
  clients,
  cta,
  disclaimer,
  editingPlans,
  entityLine,
  featuredTestimonial,
  home,
  rating,
  studioSince,
  trustLogos,
} from "@/lib/site";

/*
 * Affiliate-partner landing page: a partner-branded pitch for the editing
 * service. One component renders any partner from a PartnerSalesPage; the
 * discount terms are pulled from lib/affiliates.ts by the page's affiliateRef,
 * so the number the buyer sees here matches the Stripe coupon checkout applies.
 * Every buy button carries ?ref=<partner> so the sale is credited and the
 * discount auto-applies. Rendered inside the (sales) layout, so .sp is in scope.
 */
const dollars = (n: number) => `$${n.toLocaleString("en-US")}`;

const GUARANTEES = [
  { title: "Unlimited revisions", line: "We refine every edit until it is right. No revision caps, no per-change fees." },
  { title: "No contract", line: "Month to month. Pause or cancel anytime from your portal." },
  { title: "A HighLevel-fluent team", line: `You never explain the platform. We have made HighLevel videos since ${studioSince}.` },
  { title: "Full ownership", line: "Every edit is yours to run anywhere, across your whole funnel." },
];

const WHO_ITS_FOR = [
  {
    title: "You publish on a schedule",
    line: "YouTube, ads, and socials every week, and editing is the bottleneck between recording and posting.",
  },
  {
    title: "You are sitting on footage",
    line: "Webinars, demos, talking-head clips, podcasts. You have the raw material and need it cut, captioned, and ready.",
  },
  {
    title: "You want an editor, not a hire",
    line: "All the output of an in-house editor, without the payroll, the hiring, or the managing.",
  },
  {
    title: "You never want to explain HighLevel",
    line: `You brief us once. We have made HighLevel videos since ${studioSince}, so we already know the platform.`,
  },
];

/* How we work. The two pillars are what keep quality high and nothing slipping:
 * the style guide comes first, and all communication runs through a dedicated
 * Slack channel with an assigned PM + the head of editor. The routine after
 * that is a short loop, shown compactly so the pillars carry the weight. */
const WORK_PILLARS = [
  {
    n: "01",
    title: "Your style guide comes first",
    line: "Before we touch an edit, we build your video style guide: fonts, colors, captions, lower-thirds, pacing, intro and outro. Every video after is consistent and unmistakably yours.",
  },
  {
    n: "02",
    title: "One Slack channel, the right people in it",
    line: "All communication runs through a dedicated Slack channel with your assigned project manager and our head of editor inside. Feedback is instant, context is never lost, and nothing slips.",
  },
];

const WORK_LOOP = ["Send footage", "We edit to your guide", "Unlimited revisions"];

export function PartnerLanding({ page }: { page: PartnerSalesPage }) {
  const p = page.partner;
  const aff = affiliateByRef(page.affiliateRef);
  const pct = aff?.discountPercent ?? 0;
  const months = aff?.discountMonths ?? 0;
  const ft = featuredTestimonial; // Chase Buckner, HighLevel
  const initials = p.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  // Only render the <img> when the file is actually on disk, so a not-yet-added
  // headshot degrades to the branded placeholder instead of a broken image.
  const photoReady = p.photo ? existsSync(join(process.cwd(), "public", p.photo)) : false;

  const faq = [
    {
      q: `Is the ${pct}% really automatic?`,
      a: `Yes. Because you came from ${p.name.split(" ")[0]}, the discount is applied to your total at checkout for your first ${months} months. There is no code to enter.`,
    },
    {
      q: `What happens after ${months} months?`,
      a: "You continue on the same plan at the standard monthly price. Nothing about the service changes, and you can cancel anytime.",
    },
    {
      q: "What do I send you?",
      a: "Your raw footage plus any brand assets and references, through a short intake after you start. The more context, the better the first cut.",
    },
    {
      q: "What is the turnaround?",
      a: "Most edits come back within a few business days, depending on length and volume. Growth and Scale move fastest.",
    },
    {
      q: "Can I cancel anytime?",
      a: "Yes. Plans are month to month with no contract. Manage or cancel yours from the customer portal.",
    },
    {
      q: `How is ${p.name.split(" ")[0]} connected to GHL Video?`,
      a: `${p.name.split(" ")[0]} is an affiliate partner. He recommends our editing service to his audience and earns a commission on referrals, at no extra cost to you. You simply get ${pct}% off.`,
    },
  ];

  return (
    <>
      {/* HERO: portrait + pitch */}
      <header className="sp-section" style={{ position: "relative", overflow: "hidden" }}>
        <div className="sp-glow" />
        <div className="sp-wrap" style={{ position: "relative" }}>
          <div className="sp-partner">
            <div className="sp-partner-photo">
              {photoReady ? (
                // eslint-disable-next-line @next/next/no-img-element -- partner headshot, static asset
                <img src={p.photo!} alt={p.name} />
              ) : (
                <span className="sp-partner-initials" aria-hidden="true">
                  {initials}
                </span>
              )}
            </div>
            <div>
              <span className="sp-eyebrow">In partnership with {p.name}</span>
              <h1
                className="sp-display sp-h1"
                style={{ marginTop: "1rem", fontSize: "clamp(2.05rem, 4.8vw, 3.3rem)" }}
              >
                {p.tagline}
              </h1>
              {pct ? (
                <div className="sp-offer" style={{ marginTop: "1.4rem" }}>
                  <span className="sp-offer-tag">{pct}% OFF</span>
                  <span>on video editing, first {months} months</span>
                </div>
              ) : null}
              <p className="sp-lede" style={{ marginTop: "1.3rem", maxWidth: "36rem" }}>
                {p.offer}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.9rem", marginTop: "1.9rem" }}>
                <a href="#plans" className="sp-btn sp-btn--primary">
                  See the plans
                </a>
                <a href={cta.bookACall.href} className="sp-btn sp-btn--ghost">
                  {cta.bookACall.label}
                </a>
              </div>
              <div className="sp-trust" style={{ justifyContent: "flex-start", marginTop: "1.9rem" }}>
                <span className="sp-trust-item">
                  <span className="sp-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span> {rating} on Google
                </span>
                <span className="sp-trust-item">
                  <span className="sp-trust-num">{clients}+</span> HighLevel clients
                </span>
                <span className="sp-trust-item">
                  <span className="sp-trust-num">Since {studioSince}</span> HighLevel-only
                </span>
              </div>
            </div>
          </div>
        </div>
        {p.heroVideoSrc ? (
          <div
            className="sp-wrap"
            style={{ position: "relative", marginTop: "clamp(2rem, 4vw, 3rem)", maxWidth: "900px" }}
          >
            <SpVideo src={p.heroVideoSrc} poster={p.heroVideoPoster ?? null} label="watch" placeholder="Showreel" />
          </div>
        ) : null}
      </header>

      {/* ENDORSEMENT, when the partner has provided one */}
      {p.endorsement ? (
        <section className="sp-section--tight">
          <div className="sp-wrap sp-narrow" style={{ textAlign: "center" }}>
            <blockquote style={{ margin: 0 }}>
              <p className="sp-display sp-h3" style={{ lineHeight: 1.3 }}>
                &ldquo;{p.endorsement}&rdquo;
              </p>
              <p className="sp-muted" style={{ marginTop: "1rem", fontWeight: 600 }}>
                {p.name}, {p.role}
              </p>
            </blockquote>
          </div>
        </section>
      ) : null}

      {/* OFFER BAND: how the discount works */}
      {pct ? (
        <section className="sp-section--tight sp-section--offer">
          <div className="sp-wrap sp-narrow" style={{ textAlign: "center" }}>
            <span className="sp-eyebrow">Your discount</span>
            <h2 className="sp-display sp-h3" style={{ marginTop: "0.6rem" }}>
              {pct}% off your first {months} months,{" "}
              <span className="sp-grad-text">applied automatically.</span>
            </h2>
            <p className="sp-muted" style={{ marginTop: "0.7rem" }}>
              There is no code to enter. Start any editing plan from this page and the discount is
              already in your total. From month {months + 1} you continue at the standard price, and
              you can cancel anytime.
            </p>
          </div>
        </section>
      ) : null}

      {/* WHO IT'S FOR: editorial split, statement + divided checklist */}
      <section className="sp-section">
        <div className="sp-wrap">
          <div className="sp-who">
            <div>
              <span className="sp-eyebrow">{"Who it's for"}</span>
              <h2 className="sp-display sp-h2" style={{ marginTop: "0.7rem" }}>
                Built for HighLevel teams <span className="sp-grad-text">that publish.</span>
              </h2>
              <p className="sp-lede" style={{ marginTop: "1rem", maxWidth: "26rem" }}>
                If you are shipping video on a schedule and the editing is the bottleneck between
                recording and posting, this is the plan that clears it.
              </p>
            </div>
            <ul className="sp-who-list">
              {WHO_ITS_FOR.map((w) => (
                <li key={w.title} className="sp-who-item">
                  <span className="sp-who-check" aria-hidden="true">
                    <svg viewBox="0 0 16 16" width="13" height="13" fill="none">
                      <path
                        d="M3 8.5l3 3 7-8"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <div>
                    <p className="sp-who-title">{w.title}</p>
                    <p className="sp-muted sp-who-line">{w.line}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* HOW WE WORK: two weighted pillars (the differentiators) + a slim loop */}
      <section className="sp-section sp-section--band">
        <div className="sp-wrap">
          <Head
            eyebrow="How we work"
            title="A system built so"
            accent="nothing slips."
            sub="A clear process, and the right people in one place, so every edit lands on-brand and on time."
            center
          />
          <div className="sp-pillars" style={{ marginTop: "2.75rem" }}>
            {WORK_PILLARS.map((pillar) => (
              <div key={pillar.n} className="sp-pillar">
                <span className="sp-pillar-n">{pillar.n}</span>
                <h3 className="sp-display sp-h3" style={{ marginTop: "0.7rem" }}>
                  {pillar.title}
                </h3>
                <p className="sp-muted" style={{ marginTop: "0.7rem" }}>
                  {pillar.line}
                </p>
              </div>
            ))}
          </div>
          <div className="sp-loop">
            <span className="sp-loop-label">From there, a simple loop</span>
            <span className="sp-loop-steps">
              {WORK_LOOP.map((step, i) => (
                <span
                  key={step}
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.85rem" }}
                >
                  {i > 0 ? (
                    <span className="sp-loop-arrow" aria-hidden="true">
                      &rarr;
                    </span>
                  ) : null}
                  <span className="sp-loop-step">{step}</span>
                </span>
              ))}
            </span>
          </div>
        </div>
      </section>

      {/* THE PLANS */}
      <section id="plans" className="sp-section" style={{ scrollMarginTop: "4rem" }}>
        <div className="sp-wrap">
          <Head
            eyebrow="The editing service"
            title="Pick your plan,"
            accent="publish all month."
            sub="Long-form and short-form edits every month from a HighLevel-fluent team, with unlimited revisions. Your discount is applied at checkout."
            center
          />
          <div className="sp-plans" style={{ marginTop: "2.75rem" }}>
            {editingPlans.map((plan) => {
              const discounted = pct ? Math.round(plan.price * (1 - pct / 100)) : plan.price;
              const save = plan.anchorPrice ? Math.round((1 - plan.price / plan.anchorPrice) * 100) : 0;
              return (
                <div key={plan.sku} className={`sp-tier${plan.featured ? " sp-tier--featured" : ""}`}>
                  {plan.featured ? <span className="sp-tier-badge">Most popular</span> : null}
                  <h3 className="sp-display sp-h3">{plan.name}</h3>
                  <p className="sp-tier-blurb">{plan.blurb}</p>
                  <div className="sp-tier-price">
                    <span className="sp-price" style={{ fontSize: "2.3rem" }}>
                      {dollars(plan.price)}
                    </span>
                    <span className="sp-muted">/mo</span>
                    {save > 0 ? (
                      <span className="sp-strike" style={{ fontSize: "0.95rem" }}>
                        {dollars(plan.anchorPrice)}
                      </span>
                    ) : null}
                  </div>
                  {pct ? (
                    <p className="sp-tier-intro">
                      {dollars(discounted)}/mo for your first {months} months
                    </p>
                  ) : null}
                  <ul className="sp-tier-list">
                    {plan.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <p className="sp-tier-delivery">No contract, cancel anytime</p>
                  <a
                    href={`/checkout/${plan.sku}?ref=${page.affiliateRef}`}
                    className="sp-btn sp-btn--primary sp-btn--wide"
                  >
                    {cta.startEditing}
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* PROOF: authority testimonial + logos + reviews */}
      <section className="sp-section sp-section--band">
        <div className="sp-wrap">
          <Head eyebrow="Proof" title="Trusted by HighLevel" accent="founders and platforms." center />
          <div className="sp-featured" style={{ marginTop: "2.75rem" }}>
            <SpVideo src={ft.src} poster={ft.poster} label={`Testimonial from ${ft.name}`} />
            <div>
              <span
                className="sp-pill"
                style={{ color: "var(--sp-gold)", borderColor: "rgba(252,192,0,0.3)" }}
              >
                {ft.marker}
              </span>
              <blockquote style={{ margin: "1.2rem 0 0" }}>
                <p className="sp-display sp-h3" style={{ lineHeight: 1.25 }}>
                  &ldquo;{ft.pull}&rdquo;
                </p>
                <p className="sp-lede" style={{ marginTop: "0.9rem" }}>
                  {ft.quote}
                </p>
              </blockquote>
              <p style={{ marginTop: "1.2rem", borderLeft: "2px solid var(--sp-gold)", paddingLeft: "0.9rem" }}>
                <span style={{ fontWeight: 600, display: "block" }}>{ft.name}</span>
                <span className="sp-muted">{ft.role}</span>
              </p>
            </div>
          </div>

          <div style={{ marginTop: "3.5rem" }}>
            <p
              className="sp-eyebrow"
              style={{ display: "block", textAlign: "center", marginBottom: "1.5rem" }}
            >
              Trusted by HighLevel SaaS
            </p>
            <div className="sp-marquee">
              <div className="sp-marquee-track">
                {[...trustLogos.slice(0, 22), ...trustLogos.slice(0, 22)].map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element -- local logo silhouette
                  <img key={i} src={src} alt="" className="sp-logo" loading="lazy" />
                ))}
              </div>
            </div>
          </div>

          <div className="sp-grid-cards" style={{ marginTop: "3.5rem" }}>
            {home.reviews.items.slice(0, 3).map((r) => (
              <div key={r.name} className="sp-review">
                <span className="sp-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
                <p style={{ marginTop: "0.6rem" }}>&ldquo;{r.quote}&rdquo;</p>
                <p className="sp-muted" style={{ marginTop: "0.8rem", fontWeight: 600 }}>
                  {r.name}
                </p>
              </div>
            ))}
          </div>
          <p className="sp-muted" style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.9rem" }}>
            Every review on Google, five stars.
          </p>
        </div>
      </section>

      {/* WHAT EVERY PLAN INCLUDES */}
      <section className="sp-section--tight">
        <div className="sp-wrap">
          <div className="sp-includes">
            <span className="sp-eyebrow" style={{ display: "block", textAlign: "center" }}>
              Every plan includes
            </span>
            <div
              className="sp-guarantees"
              style={{ marginTop: "1.9rem", paddingTop: 0, borderTop: "none" }}
            >
              {GUARANTEES.map((g) => (
                <div key={g.title} className="sp-guarantee">
                  <span className="sp-guarantee-check" aria-hidden="true">
                    &#10003;
                  </span>
                  <div>
                    <p className="sp-guarantee-title">{g.title}</p>
                    <p className="sp-muted sp-guarantee-line">{g.line}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="sp-section">
        <div className="sp-wrap sp-narrow">
          <Head eyebrow="FAQ" title="Good questions," accent="honest answers." center />
          <div className="sp-faq" style={{ marginTop: "2rem" }}>
            {faq.map((f) => (
              <details key={f.q} className="sp-faq-item">
                <summary className="sp-faq-q">
                  <span>{f.q}</span>
                  <span className="sp-faq-chevron" aria-hidden="true" />
                </summary>
                <p className="sp-muted sp-faq-a">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="sp-section" style={{ position: "relative", overflow: "hidden", textAlign: "center" }}>
        <div className="sp-glow" />
        <div className="sp-wrap sp-narrow" style={{ position: "relative" }}>
          <span className="sp-eyebrow">Ready when you are</span>
          <h2 className="sp-display sp-h2" style={{ marginTop: "0.8rem" }}>
            {page.closing.headline} <span className="sp-grad-text">{page.closing.accent}</span>
          </h2>
          <p className="sp-lede" style={{ margin: "1rem auto 0", maxWidth: "40rem" }}>
            {page.closing.sub}
          </p>
          <div
            style={{ display: "flex", gap: "0.9rem", justifyContent: "center", marginTop: "1.8rem", flexWrap: "wrap" }}
          >
            <a href="#plans" className="sp-btn sp-btn--primary">
              See the plans
            </a>
            <a href={cta.bookACall.href} className="sp-btn sp-btn--ghost">
              {cta.bookACall.label}
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="sp-footer">
        <div
          className="sp-wrap"
          style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem", alignItems: "center", justifyContent: "space-between" }}
        >
          <div>
            <p style={{ color: "var(--sp-text)", fontWeight: 600 }}>GHL Video</p>
            <p style={{ marginTop: "0.2rem" }}>{entityLine}</p>
          </div>
          <p style={{ maxWidth: "34rem" }}>{disclaimer}</p>
          <a href="mailto:hi@ghlvideo.com">hi@ghlvideo.com</a>
        </div>
      </footer>
    </>
  );
}

function Head({
  eyebrow,
  title,
  accent,
  sub,
  center,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  sub?: string;
  center?: boolean;
}) {
  return (
    <div
      style={{
        maxWidth: center ? "46rem" : "42rem",
        marginInline: center ? "auto" : undefined,
        textAlign: center ? "center" : "left",
      }}
    >
      <span className="sp-eyebrow">{eyebrow}</span>
      <h2 className="sp-display sp-h2" style={{ marginTop: "0.7rem" }}>
        {title}
        {accent ? (
          <>
            {" "}
            <span className="sp-grad-text">{accent}</span>
          </>
        ) : null}
      </h2>
      {sub ? (
        <p className="sp-lede" style={{ marginTop: "0.9rem" }}>
          {sub}
        </p>
      ) : null}
    </div>
  );
}
