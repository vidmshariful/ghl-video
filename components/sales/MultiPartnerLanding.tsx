import { existsSync } from "node:fs";
import { join } from "node:path";
import { SpVideo } from "@/components/sales/SpVideo";
import { GhlMark } from "@/components/GhlMark";
import { Logo } from "@/components/Logo";
import type { PartnerSalesPage } from "@/lib/sales/pages";
import { partnerOffer } from "@/lib/partners";
import { salesBundles, type SalesBundle } from "@/lib/bundles";
import {
  clients,
  codeFor,
  cta,
  disclaimer,
  editingPlans,
  entityLine,
  featuredTestimonial,
  home,
  nicheAddon,
  nicheAddonPrice,
  nicheIntro,
  premadeVideos,
  rating,
  skuFor,
  studioSince,
  trustLogos,
} from "@/lib/site";

/*
 * Multi-service affiliate-partner landing page: one branded page covering all
 * three services (premade white-label videos, editing plans, custom production)
 * with the partner's discount applied across everything via their ref.
 *
 * Rendered for partner pages flagged `full` (Jonah's original editing-only page
 * uses the simpler PartnerLanding). Under the (sales) layout, so .sp is in scope.
 *
 * NOTE (tech debt): the premade library/bundle cards below are duplicated from
 * app/(sales)/lp/[slug]/page.tsx to keep this a zero-risk, standalone template
 * while it is reviewed. Once the template is finalized and partners are moved
 * onto it, extract the shared premade block so the two never drift.
 */
const dollars = (n: number) => `$${n.toLocaleString("en-US")}`;

type SalesLibVideo = {
  slug: string;
  title: string;
  type: string;
  format: string;
  price: number;
  preview: string | null;
  wistiaId: string | null;
  poster: string | null;
  comingSoon?: boolean;
};

const LIBRARY_CATS = [
  {
    type: "Explainer",
    name: "Full Explainer",
    desc: "Perfect for a homepage hero. It works like a salesperson, delivering the core message of your full platform.",
  },
  {
    type: "Demo",
    name: "Demo Videos",
    desc: "Show your audience the platform overview before the live demo call. Fewer repeat demos, and hours saved every week.",
  },
  {
    type: "Feature Explainer",
    name: "Feature Explainer",
    desc: "Best for ad campaigns, social media, and the feature sections of your website.",
  },
];

const EXTRA_VIDEOS: SalesLibVideo[] = [
  {
    slug: "complete-platform-tour-explainer",
    title: "Complete Platform Tour Explainer",
    type: "Explainer",
    format: "Full platform tour",
    price: 395,
    preview: null,
    wistiaId: "nyv9u91be2",
    poster:
      "https://embed-ssl.wistia.com/deliveries/63b213ac1651cc07ce3b26cc0b8fc17e.jpg?image_crop_resized=960x540",
  },
  {
    slug: "ai-platform-demo",
    title: "Overall Platform Walkthrough",
    type: "Demo",
    format: "Platform demo",
    price: 995,
    preview: null,
    wistiaId: "kvxz5zjd6j",
    poster:
      "https://embed-ssl.wistia.com/deliveries/2ef47e87e0771057f43fcccc95946f07.jpg?image_crop_resized=960x540",
  },
];

const ALL_LIB: SalesLibVideo[] = [
  ...premadeVideos.map((v) => ({
    slug: v.slug,
    title: v.title,
    type: v.type as string,
    format: v.format,
    price: v.price,
    preview: v.preview,
    wistiaId: null,
    poster: v.poster,
    comingSoon: v.comingSoon,
  })),
  ...EXTRA_VIDEOS,
];

const GUARANTEES = [
  { title: "Full commercial rights", line: "Every video is yours to run across your whole funnel, forever." },
  { title: "White-label from frame one", line: "Your logo, dashboard, colors, and voiceover. Nothing points back to us." },
  { title: "A HighLevel-fluent team", line: `You never explain the platform. We only make HighLevel videos, since ${studioSince}.` },
  { title: "Clear refund policy", line: "Not the right fit? Our refund policy is published and plain." },
];

/* the three services, shown as slim cards in the "what we make" section; each
   CTA scrolls to that service's full section below. */
const SERVICES = [
  {
    anchor: "premade",
    accent: "gold" as const,
    icon: "premade" as const,
    title: "Premade white-label videos",
    desc: "Ready-to-use HighLevel explainers, demos, and feature videos, branded to your SaaS. Order and publish this week.",
    forWho: "agencies and SaaS that need videos live this week",
    cta: "See premade videos",
  },
  {
    anchor: "editing",
    accent: "blue" as const,
    icon: "editing" as const,
    title: "YouTube Video Editing",
    desc: "Long-form YouTube edits and short-form social clips every month, on a plan, with unlimited revisions.",
    forWho: "founders and creators publishing on YouTube and social",
    cta: "See editing plans",
  },
  {
    anchor: "custom",
    accent: "green" as const,
    icon: "custom" as const,
    title: "Custom video production",
    desc: "A one-off video scripted and produced for your exact offer and ICP, start to finish.",
    forWho: "anyone who wants a signature, made-from-scratch video",
    cta: "See custom production",
  },
];

/* custom-production formats, shown as substance in the custom section. Pricing
   is scoped on the call (not fixed yet), so these carry no hard price. */
const CUSTOM_FORMATS = [
  { name: "Ads / Promo", blurb: "Scroll-stopping paid social and YouTube ads, built to convert." },
  { name: "Explainer", blurb: "A from-scratch explainer for your exact offer and positioning." },
  { name: "Demo", blurb: "A guided product demo that sells your platform before the call." },
  { name: "Onboarding", blurb: "A short series that gets new users to value, fast." },
];

export async function MultiPartnerLanding({ page }: { page: PartnerSalesPage }) {
  const p = page.partner;
  const ref = page.affiliateRef;
  /* discount terms + coupon from the partners table (registry fallback) */
  const { percent: pct, months, couponCode } = await partnerOffer(ref);
  const ft = featuredTestimonial;
  const initials = p.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const photoReady = p.photo ? existsSync(join(process.cwd(), "public", p.photo)) : false;
  const withRef = (href: string) => (href.includes("?") ? `${href}&ref=${ref}` : `${href}?ref=${ref}`);
  /* buy buttons carry the coupon too, so checkout applies the discount on
     its own; the ref rides along purely for attribution */
  const buyLink = (href: string) => {
    const base = withRef(href);
    return couponCode ? `${base}&code=${encodeURIComponent(couponCode)}` : base;
  };

  const faq = [
    {
      q: `Is the ${pct}% really automatic?`,
      a: `Yes. Buy anything from this page and the discount applies at checkout on its own. Ordering somewhere else on the site? Enter ${couponCode ?? "the code above"} at checkout. For custom production, our team applies it to your quote.`,
    },
    {
      q: "Is each video really mine to use anywhere?",
      a: "Yes. Every video ships with full commercial rights and your branding. Run it as an ad, embed it on your site, use it in onboarding. No attribution, no license tiers.",
    },
    {
      q: "How fast is delivery?",
      a: "Most premade orders land in a few business days after you send your branding. Editing turns around within days each month, and custom timelines are scoped on your call.",
    },
    {
      q: `How is ${p.name.split(" ")[0]} connected to GHL Video?`,
      a: `${p.name.split(" ")[0]} is an affiliate partner. He recommends us to his audience and earns a commission on referrals, at no extra cost to you. You simply get ${pct}% off.`,
    },
  ];

  return (
    <>
      {/* logo-only top bar (not sticky); the logo links home carrying the ref.
         "sp-mpl" on the hero flags the shared layout to hide its own top bar. */}
      <div className="sp-mpl-topbar">
        <div className="sp-wrap sp-topbar-inner">
          <a href={withRef("/")} className="sp-mpl-logo" aria-label="GHL Video home">
            <Logo className="h-6" />
          </a>
        </div>
      </div>

      {/* 1. PARTNER HERO */}
      <header className="sp-section sp-mpl" style={{ position: "relative", overflow: "hidden" }}>
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
              <Chip label="In partnership with" accent={p.name} />
              <h1
                className="sp-display sp-h1"
                style={{ marginTop: "1.1rem", fontSize: "clamp(2.05rem, 4.8vw, 3.3rem)" }}
              >
                {p.tagline}
              </h1>
              {pct ? (
                <div className="sp-offer" style={{ marginTop: "1.4rem" }}>
                  <span className="sp-offer-tag">{pct}% OFF</span>
                  <span>on everything: premade, editing, and custom</span>
                </div>
              ) : null}
              <p className="sp-lede" style={{ marginTop: "1.3rem", maxWidth: "36rem" }}>
                {p.offer}
              </p>
              {couponCode ? (
                <div className="sp-codebox">
                  <span className="sp-codebox-label">Your code</span>
                  <span className="sp-codebox-code">{couponCode}</span>
                  <span className="sp-codebox-note">
                    Buy from this page and your {pct}% applies at checkout on its own.
                    Anywhere else on the site, enter this code at checkout.
                  </span>
                </div>
              ) : null}
              <div className="sp-trust" style={{ justifyContent: "flex-start", marginTop: "1.9rem" }}>
                <span className="sp-trust-item">
                  <span className="sp-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span> {rating} on Google
                </span>
                <span className="sp-trust-item">
                  Creating HighLevel videos{" "}
                  <strong style={{ fontWeight: 700, color: "var(--sp-text)" }}>
                    since {studioSince}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* STICKY SERVICE NAV: jump links + the ever-present partner offer */}
      <nav className="sp-svcnav" aria-label="Services">
        <div className="sp-wrap">
          <div className="sp-svcnav-inner">
            <div className="sp-svcnav-links">
              <a href="#premade" className="sp-svcnav-link">
                Premade videos
              </a>
              <a href="#editing" className="sp-svcnav-link">
                Editing
              </a>
              <a href="#custom" className="sp-svcnav-link">
                Custom
              </a>
              <a href={withRef(cta.bookACall.href)} className="sp-svcnav-link">
                {cta.bookACall.label}
              </a>
            </div>
            {pct ? (
              <span className="sp-svcnav-offer">{pct}% off everything, applied automatically</span>
            ) : null}
          </div>
        </div>
      </nav>

      {/* EARLY TRUST: the logo wall right under the hero */}
      <section className="sp-section--tight">
        <div className="sp-wrap">
          <p
            className="sp-eyebrow"
            style={{
              display: "block",
              textAlign: "center",
              marginBottom: "1.25rem",
              color: "var(--sp-muted)",
            }}
          >
            Trusted by {clients}+ HighLevel SaaS
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
      </section>

      {/* 2. WHO WE ARE: intro + Chase authority proof (one quote) */}
      <section className="sp-section sp-section--band">
        <div className="sp-wrap">
          <Head
            eyebrow="Who we are"
            title="The HighLevel-only"
            accent="video studio."
            sub={`Since ${studioSince}, GHL Video has made white-label videos for ${clients}+ HighLevel SaaS and agencies. Every frame is branded to your platform: your logo, your dashboard, your voiceover.`}
            center
          />
          <div className="sp-featured" style={{ marginTop: "2.75rem" }}>
            <SpVideo src={ft.src} poster={ft.poster} label={`Testimonial from ${ft.name}`} />
            <div>
              <span className="sp-pill" style={{ color: "var(--sp-gold)", borderColor: "rgba(252,192,0,0.3)" }}>
                {ft.marker}
              </span>
              <blockquote style={{ margin: "1.3rem 0 0" }}>
                <p className="sp-display sp-h3" style={{ lineHeight: 1.25 }}>
                  &ldquo;{ft.pull}&rdquo;
                </p>
              </blockquote>
              <p style={{ marginTop: "1.5rem", borderLeft: "2px solid var(--sp-gold)", paddingLeft: "0.9rem" }}>
                <span style={{ fontWeight: 600, display: "block" }}>{ft.name}</span>
                <span className="sp-muted">{ft.role}</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT WE MAKE: three slim service cards; each CTA scrolls to its full section */}
      <section className="sp-section">
        <div className="sp-wrap">
          <Head
            eyebrow="What we make"
            title="Three services,"
            accent="one studio."
            sub="Premade videos, monthly editing, and custom production, all HighLevel-fluent and all covered by your partner discount."
            center
          />
          <div className="sp-svc-grid" style={{ marginTop: "3rem" }}>
            {SERVICES.map((s) => (
              <div key={s.anchor} className={`sp-card sp-svc-card sp-svc-card--${s.accent}`}>
                <ServiceIcon name={s.icon} />
                <h3 className="sp-display sp-h3" style={{ marginTop: "0.9rem" }}>
                  {s.title}
                </h3>
                <p className="sp-muted" style={{ marginTop: "0.5rem", flex: 1 }}>
                  {s.desc}
                </p>
                <p className="sp-svc-for-line">
                  <span style={{ color: "var(--svc)", fontWeight: 600 }}>Best for</span> {s.forWho}.
                </p>
                <a href={`#${s.anchor}`} className="sp-svc-cta">
                  {s.cta} <span aria-hidden="true">&rarr;</span>
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. PREMADE WHITE-LABEL VIDEOS */}
      <section
        id="premade"
        className="sp-section"
        style={{ scrollMarginTop: "4rem", position: "relative", overflow: "hidden" }}
      >
        <div className="sp-glow" />
        <div className="sp-wrap" style={{ position: "relative" }}>
          <Head
            eyebrow="Service 01, premade videos"
            title="White-label HighLevel videos,"
            accent="ready to publish."
            sub="Preview the work, then order the ones you need. Every video is branded to your SaaS, and your discount is applied at checkout."
            center
          />
          {pct ? (
            <div style={{ textAlign: "center" }}>
              <span className="sp-disc-note">
                Your {pct}% partner discount is applied automatically at checkout.
              </span>
            </div>
          ) : null}
          {/* jump straight to a format */}
          <div className="sp-jumprow" style={{ justifyContent: "center" }}>
            {LIBRARY_CATS.map((cat) => {
              if (!ALL_LIB.some((v) => v.type === cat.type)) return null;
              const fid = cat.type.toLowerCase().replace(/\s+/g, "-");
              return (
                <a key={cat.type} href={`#fmt-${fid}`} className="sp-jumplink">
                  {cat.name}
                </a>
              );
            })}
          </div>
          {LIBRARY_CATS.map((cat, i) => {
            const vids = ALL_LIB.filter((v) => v.type === cat.type);
            if (vids.length === 0) return null;
            const fid = cat.type.toLowerCase().replace(/\s+/g, "-");
            return (
              <div
                key={cat.type}
                id={`fmt-${fid}`}
                style={
                  i > 0
                    ? {
                        marginTop: "3.5rem",
                        paddingTop: "3rem",
                        borderTop: "1px solid var(--sp-line)",
                        scrollMarginTop: "5.5rem",
                      }
                    : { marginTop: "3rem", scrollMarginTop: "5.5rem" }
                }
              >
                <div className="sp-vtype-head">
                  <div style={{ maxWidth: "46rem" }}>
                    <span className="sp-eyebrow">Format {String(i + 1).padStart(2, "0")}</span>
                    <h3 className="sp-display sp-h3" style={{ marginTop: "0.55rem" }}>
                      {cat.name}
                    </h3>
                    <p className="sp-muted" style={{ marginTop: "0.45rem" }}>
                      {cat.desc}
                    </p>
                  </div>
                  <span className="sp-vtype-count">{vids.length} videos</span>
                </div>
                <div className="sp-grid-cards" style={{ marginTop: "1.75rem" }}>
                  {vids.map((v) => (
                    <LibraryCard key={v.slug} v={v} buyLink={buyLink} />
                  ))}
                </div>
              </div>
            );
          })}

          {/* bundles */}
          <div style={{ marginTop: "3.5rem", paddingTop: "3rem", borderTop: "1px solid var(--sp-line)" }}>
            <Head eyebrow="Bundle and save" title="Take a set," accent="save more." center />
            <div className="sp-bundles" style={{ marginTop: "2.5rem" }}>
              {salesBundles.map((b) => (
                <SalesBundleCard key={b.sku} b={b} buyLink={buyLink} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4. VIDEO EDITING */}
      <section id="editing" className="sp-section sp-section--band" style={{ scrollMarginTop: "4rem" }}>
        <div className="sp-wrap">
          <Head
            eyebrow="Service 02, video editing"
            title="YouTube and short-form editing,"
            accent="on a monthly plan."
            sub="Long-form YouTube edits and short-form social clips every month, with unlimited revisions. Your discount is applied at checkout."
            center
          />
          {pct ? (
            <div style={{ textAlign: "center" }}>
              <span className="sp-disc-note">
                Your {pct}% off applies automatically for your first {months} months.
              </span>
            </div>
          ) : null}
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
                  <a href={buyLink(`/checkout/${plan.sku}`)} className="sp-btn sp-btn--primary sp-btn--wide">
                    {cta.startEditing}
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. CUSTOM VIDEO PRODUCTION */}
      <section
        id="custom"
        className="sp-section"
        style={{ scrollMarginTop: "4rem", position: "relative", overflow: "hidden" }}
      >
        <div className="sp-glow" />
        <div className="sp-wrap" style={{ position: "relative" }}>
          <Head
            eyebrow="Service 03, custom production"
            title="Something built"
            accent="from scratch."
            sub="When premade does not fit, we script and produce a video for your exact positioning and ICP, start to finish."
            center
          />
          <div className="sp-cformats" style={{ marginTop: "2.5rem" }}>
            {CUSTOM_FORMATS.map((f) => (
              <div key={f.name} className="sp-cformat">
                <p className="sp-cformat-name">{f.name}</p>
                <p className="sp-muted" style={{ marginTop: "0.5rem", fontSize: "0.92rem" }}>
                  {f.blurb}
                </p>
                <p className="sp-cformat-from">Quoted per project</p>
              </div>
            ))}
          </div>
          <div className="sp-panel-cta sp-featured" style={{ marginTop: "2.5rem" }}>
            <div>
              <h3 className="sp-display sp-h3">Your offer, your script, produced end to end.</h3>
              <p className="sp-muted" style={{ marginTop: "0.6rem" }}>
                Bespoke explainers, ads, demos, and onboarding series, written and produced for your
                platform. Book a quick call and we will scope it with you, and apply your {pct}%
                partner discount to the quote.
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", alignItems: "center" }}>
              <a href={withRef(cta.bookACall.href)} className="sp-btn sp-btn--primary">
                {cta.bookACall.label}
              </a>
              <a href={withRef("/quote/")} className="sp-btn sp-btn--ghost">
                Request a quote
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 6. PROOF */}
      <section className="sp-section sp-section--band">
        <div className="sp-wrap">
          <Head eyebrow="Proof" title="Founders and platforms," accent="on the record." center />
          <div className="sp-grid-cards" style={{ marginTop: "2.75rem" }}>
            {home.videoTestimonials.items.map((t) => (
              <figure key={t.company} className="sp-card" style={{ margin: 0 }}>
                <SpVideo src={t.src} poster={t.poster} label={`${t.name}, ${t.company}`} />
                <figcaption style={{ padding: "1.1rem 1.25rem" }}>
                  <p className="sp-muted" style={{ fontSize: "0.95rem" }}>
                    {t.summary}
                  </p>
                  <p style={{ marginTop: "0.7rem", fontWeight: 600 }}>{t.name}</p>
                  <p className="sp-muted" style={{ fontSize: "0.85rem" }}>
                    CEO of {t.company}
                  </p>
                </figcaption>
              </figure>
            ))}
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

      {/* GUARANTEES */}
      <section className="sp-section--tight">
        <div className="sp-wrap">
          <div className="sp-guarantees" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>
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

      {/* CLOSING */}
      <section className="sp-section" style={{ position: "relative", overflow: "hidden", textAlign: "center" }}>
        <div className="sp-glow" />
        <div className="sp-wrap sp-narrow" style={{ position: "relative" }}>
          <Chip label="Ready when you are" />
          <h2 className="sp-display sp-h2" style={{ marginTop: "1rem" }}>
            {page.closing.headline} <span className="sp-grad-text">{page.closing.accent}</span>
          </h2>
          <p className="sp-lede" style={{ margin: "1rem auto 0", maxWidth: "40rem" }}>
            {page.closing.sub}
          </p>
          <div
            style={{ display: "flex", gap: "0.9rem", justifyContent: "center", marginTop: "1.8rem", flexWrap: "wrap" }}
          >
            <a href="#premade" className="sp-btn sp-btn--primary">
              Browse the videos
            </a>
            <a href={withRef(cta.bookACall.href)} className="sp-btn sp-btn--ghost">
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

/* section eyebrow, echoing the main site: the 3-colour GHL mark, a hairline
   divider, then the mono label. Used for every section head + the cards. */
function Chip({ label, accent }: { label: string; accent?: string }) {
  return (
    <span className="sp-chip">
      <GhlMark className="sp-chip-mark" />
      <span className="sp-chip-div" aria-hidden="true" />
      <span className="sp-chip-label">
        {label}
        {accent ? (
          <>
            {" "}
            <span className="sp-chip-name">{accent}</span>
          </>
        ) : null}
      </span>
    </span>
  );
}

/* per-service motif; inherits the card's accent via `color: var(--svc)`. */
function ServiceIcon({ name }: { name: "premade" | "editing" | "custom" }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <span className="sp-svc-icon" aria-hidden="true">
      {name === "premade" ? (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <path d="M10 8.5l5 3.5-5 3.5z" fill="currentColor" stroke="none" />
        </svg>
      ) : name === "editing" ? (
        <svg {...common}>
          <circle cx="6" cy="6" r="2.6" />
          <circle cx="6" cy="18" r="2.6" />
          <line x1="20" y1="4" x2="8.4" y2="15.6" />
          <line x1="14.5" y1="14.5" x2="20" y2="20" />
          <line x1="8.4" y1="8.4" x2="12" y2="12" />
        </svg>
      ) : (
        <svg {...common}>
          <path d="M12 3l1.9 4.7 4.7 1.8-4.7 1.8L12 16l-1.9-4.7L5.4 9.5l4.7-1.8z" />
          <path d="M18.5 15l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z" />
        </svg>
      )}
    </span>
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
      <Chip label={eyebrow} />
      <h2 className="sp-display sp-h2" style={{ marginTop: "0.9rem" }}>
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

function LibraryCard({ v, buyLink }: { v: SalesLibVideo; buyLink: (href: string) => string }) {
  const ready = !v.comingSoon && Boolean(v.preview || v.wistiaId);
  const code = codeFor(v.slug);
  return (
    <div className="sp-card sp-card--hover sp-vcard">
      <SpVideo src={v.preview} poster={v.poster} wistiaId={v.wistiaId} label={v.title} placeholder="Coming soon" />
      <div className="sp-vcard-body">
        {code ? <p className="sp-vcard-code">{code.toUpperCase()}</p> : null}
        <p className="sp-vcard-title">{v.title}</p>
        <p className="sp-muted sp-vcard-feat">{v.format}</p>
      </div>
      {ready ? (
        <>
          <div className="sp-vcard-buy">
            <span className="sp-price">{dollars(v.price)}</span>
            <a href={buyLink(`/checkout/${skuFor(v.slug)}`)} className="sp-btn sp-btn--primary sp-btn--sm">
              Order Now
            </a>
          </div>
          <NicheNote price={nicheAddonPrice(v.type === "Demo")} />
        </>
      ) : (
        <div className="sp-vcard-buy sp-vcard-buy--soon">
          <span className="sp-badge">Coming soon</span>
        </div>
      )}
    </div>
  );
}

function NicheNote({ price = 50 }: { price?: number }) {
  return (
    <div className="sp-niche">
      <button type="button" className="sp-niche-trigger" aria-label="ICP customization details">
        <span aria-hidden="true" className="sp-niche-i">
          i
        </span>{" "}
        {nicheAddon.trigger}
      </button>
      <div className="sp-niche-tip" role="tooltip">
        <p className="sp-niche-tip-title">{nicheAddon.title}</p>
        <p className="sp-muted" style={{ marginTop: "0.3rem" }}>
          {nicheIntro(price)}
        </p>
        <ul className="sp-niche-list">
          {nicheAddon.bullets.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="sp-niche-cta">{nicheAddon.cta}</p>
      </div>
    </div>
  );
}

function SalesBundleCard({ b, buyLink }: { b: SalesBundle; buyLink: (href: string) => string }) {
  const save = b.anchorPrice ? Math.round((1 - b.price / b.anchorPrice) * 100) : 0;
  return (
    <div className={`sp-bundle${b.featured ? " sp-bundle--featured" : ""}`}>
      {b.featured ? <span className="sp-tier-badge">{b.badge ?? "Most popular"}</span> : null}
      <h3 className="sp-display sp-h3">{b.name}</h3>
      <p className="sp-bundle-count">{b.videoCount} videos, white-labeled</p>
      <div style={{ marginTop: "0.8rem" }}>
        <span className="sp-price" style={{ fontSize: "2.6rem" }}>
          {dollars(b.price)}
        </span>
      </div>
      <p style={{ marginTop: "0.35rem" }}>
        <span className="sp-strike">{dollars(b.anchorPrice)}</span>
        <span
          className="sp-muted"
          style={{ marginLeft: "0.6rem", fontWeight: 600, fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.08em" }}
        >
          Save {save}%
        </span>
      </p>
      <ul className="sp-tier-list">
        {b.items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
      <p className="sp-bundle-pick">
        {b.pickAtIntake ? "Pick your exact videos at intake" : "Every video on this page included"}
      </p>
      <p className="sp-tier-delivery">Delivery in {b.deliveryDays} days</p>
      <a href={buyLink(`/checkout/${b.sku}`)} className="sp-btn sp-btn--primary sp-btn--wide">
        Order Now
      </a>
    </div>
  );
}
