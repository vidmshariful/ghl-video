import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  bundleCategories,
  cta,
  disclaimer,
  entityLine,
  featuredTestimonial,
  home,
  premadeVideos,
  skuFor,
  trustLogos,
} from "@/lib/site";
import { salesPageBySlug, salesPages, salesShared } from "@/lib/sales/pages";
import { SpVideo } from "@/components/sales/SpVideo";

export const dynamicParams = false;

export function generateStaticParams() {
  return salesPages.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = salesPageBySlug(slug);
  return {
    title: page ? `${page.hero.headline} ${page.hero.accent} | GHL Video` : "GHL Video",
  };
}

const dollars = (n: number) => `$${n.toLocaleString("en-US")}`;

type LibVideo = (typeof premadeVideos)[number];
type Tier = (typeof bundleCategories)[number]["tiers"][number];

/* The library, in the three formats a reseller actually deploys. */
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

export default async function SalesLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = salesPageBySlug(slug);
  if (!page) notFound();

  const ft = featuredTestimonial; // Chase Buckner
  const newBundle = bundleCategories.find((c) => c.slug === "new");

  return (
    <>
      {/* HERO */}
      <header
        className="sp-section"
        style={{ position: "relative", overflow: "hidden", paddingBlockStart: "clamp(2.5rem, 6vw, 4.5rem)" }}
      >
        <div className="sp-glow" />
        <div className="sp-wrap sp-narrow" style={{ position: "relative", textAlign: "center" }}>
          <span className="sp-eyebrow">{page.hero.eyebrow}</span>
          <h1 className="sp-display sp-h1" style={{ marginTop: "1rem" }}>
            {page.hero.headline} <span className="sp-grad-text">{page.hero.accent}</span>
          </h1>
          <p className="sp-lede" style={{ margin: "1.25rem auto 0", maxWidth: "44rem" }}>
            {page.hero.sub}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.9rem", justifyContent: "center", marginTop: "2rem" }}>
            <a href="#videos" className="sp-btn sp-btn--primary">
              See the videos and pricing
            </a>
            <a href={cta.bookACall.href} className="sp-btn sp-btn--ghost">
              {cta.bookACall.label}
            </a>
          </div>
        </div>
        <div className="sp-wrap" style={{ position: "relative", marginTop: "clamp(2.5rem, 5vw, 3.5rem)", maxWidth: "980px" }}>
          <SpVideo src={page.hero.vslSrc} poster={page.hero.vslPoster} label="watch the overview" placeholder="Your VSL goes here" />
        </div>
      </header>

      {/* TRUST */}
      <section className="sp-section--tight">
        <div className="sp-wrap sp-trust">
          <span className="sp-trust-item">
            <span className="sp-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span> 5.0 on Google
          </span>
          <span className="sp-trust-item">
            <span className="sp-trust-num">1000+</span> HighLevel clients
          </span>
          <span className="sp-trust-item">
            <span className="sp-trust-num">Since 2020</span> HighLevel-only studio
          </span>
          <span className="sp-trust-item">
            <span className="sp-trust-num">Full</span> commercial rights
          </span>
        </div>
      </section>

      {/* LIBRARY, three formats */}
      <section id="videos" className="sp-section" style={{ scrollMarginTop: "4rem" }}>
        <div className="sp-wrap">
          <SectionHead
            eyebrow="The library"
            title="Watch the work,"
            accent="order what you need."
            sub="Our newest HighLevel videos, in the three formats a reseller actually deploys. Preview any of them, then order the ones that fit."
            center
          />
          {LIBRARY_CATS.map((cat) => {
            const vids = premadeVideos.filter((v) => v.type === cat.type);
            if (vids.length === 0) return null;
            return (
              <div key={cat.type} style={{ marginTop: "3rem" }}>
                <div style={{ maxWidth: "46rem" }}>
                  <h3 className="sp-display sp-h3">{cat.name}</h3>
                  <p className="sp-muted" style={{ marginTop: "0.45rem" }}>
                    {cat.desc}
                  </p>
                </div>
                <div className="sp-grid-cards" style={{ marginTop: "1.5rem" }}>
                  {vids.map((v) => (
                    <LibraryCard key={v.slug} v={v} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* NEW VIDEO BUNDLE */}
      {newBundle ? (
        <section id="bundle" className="sp-section" style={{ scrollMarginTop: "4rem" }}>
          <div className="sp-wrap">
            <SectionHead eyebrow="Bundle and save" title={newBundle.name} sub={newBundle.blurb} center />
            <div className="sp-tiers" style={{ marginTop: "2.5rem", maxWidth: "880px", marginInline: "auto" }}>
              {newBundle.tiers.map((t) => (
                <TierCard key={t.slug} t={t} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* BEFORE / AFTER */}
      <section className="sp-section">
        <div className="sp-wrap">
          <SectionHead
            eyebrow="Before and after"
            title="The same video,"
            accent="branded to you."
            sub="On the left, the original cut. On the right, the same video customized to a SaaS: logo, dashboard, colors, and voiceover."
            center
          />
          <div className="sp-ba" style={{ marginTop: "2.5rem" }}>
            <div>
              <div className="sp-ba-label sp-muted">
                <span className="sp-ba-dot" /> Original
              </div>
              <SpVideo src={page.whiteLabel.defaultSrc} poster={page.whiteLabel.poster} label="original cut" placeholder="Original coming" />
            </div>
            <div>
              <div className="sp-ba-label" style={{ color: "var(--sp-gold)" }}>
                <span className="sp-ba-dot sp-ba-dot--on" /> Customized to your SaaS
              </div>
              <SpVideo src={page.whiteLabel.brandedSrc} poster={page.whiteLabel.poster} label="branded cut" placeholder="Branded coming" />
            </div>
          </div>
        </div>
      </section>

      {/* RECENT DELIVERIES */}
      <section className="sp-section">
        <div className="sp-wrap">
          <SectionHead
            eyebrow="Recent work"
            title="Recently delivered,"
            accent="branded to real SaaS."
            sub="A slice of recent deliveries. Every frame is white-labeled: their logo, their dashboard, their voiceover."
          />
          <div className="sp-grid-cards" style={{ marginTop: "2.5rem" }}>
            {page.clientWork.map((c, i) => (
              <figure key={i} className="sp-card sp-card--hover" style={{ margin: 0 }}>
                <SpVideo src={c.src} poster={c.poster} label={c.label} />
                <figcaption style={{ padding: "1rem 1.15rem" }}>
                  <p style={{ fontWeight: 600 }}>{c.label}</p>
                  <p className="sp-muted" style={{ fontSize: "0.9rem", marginTop: "0.2rem" }}>
                    {c.sub}
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* CHASE TESTIMONIAL */}
      <section className="sp-section">
        <div className="sp-wrap sp-featured">
          <SpVideo src={ft.src} poster={ft.poster} label={`Testimonial from ${ft.name}`} />
          <div>
            <span className="sp-pill" style={{ color: "var(--sp-gold)", borderColor: "rgba(252,192,0,0.3)" }}>
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
      </section>

      {/* HOW IT WORKS */}
      <section className="sp-section">
        <div className="sp-wrap">
          <SectionHead eyebrow="How it works" title={salesShared.howItWorks.heading} accent={salesShared.howItWorks.accent} center />
          <div className="sp-steps" style={{ marginTop: "2.5rem" }}>
            {salesShared.howItWorks.steps.map((s) => (
              <div key={s.n} className="sp-step">
                <span className="sp-step-n">{s.n}</span>
                <p className="sp-display" style={{ marginTop: "0.5rem", fontSize: "1.3rem", fontWeight: 600 }}>
                  {s.title}
                </p>
                <p className="sp-muted" style={{ marginTop: "0.4rem" }}>
                  {s.line}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CUSTOM VIDEO CTA */}
      <section className="sp-section--tight">
        <div className="sp-wrap">
          <div className="sp-panel-cta sp-featured">
            <div>
              <span className="sp-eyebrow">Premade does not fit?</span>
              <h2 className="sp-display sp-h3" style={{ marginTop: "0.6rem" }}>
                We will build it custom for your SaaS.
              </h2>
              <p className="sp-muted" style={{ marginTop: "0.6rem" }}>
                If none of these match your positioning, we script and produce a video from scratch for your exact
                offer and ICP. Book a quick call and we will scope it with you.
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", alignItems: "center" }}>
              <a href={cta.bookACall.href} className="sp-btn sp-btn--primary">
                Book a custom video call
              </a>
              <a href="/quote/" className="sp-btn sp-btn--ghost">
                Request a quote
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="sp-section">
        <div className="sp-wrap sp-narrow">
          <SectionHead eyebrow="FAQ" title="Asked before" accent="every order." center />
          <div className="sp-faq" style={{ marginTop: "2rem" }}>
            {salesShared.faq.map((f) => (
              <div key={f.q} className="sp-faq-item">
                <p className="sp-faq-q">{f.q}</p>
                <p className="sp-muted" style={{ marginTop: "0.5rem" }}>
                  {f.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS: video + logos + reviews */}
      <section className="sp-section">
        <div className="sp-wrap">
          <SectionHead eyebrow="Proof" title="Founders and platforms," accent="on the record." center />

          {/* client video testimonials */}
          <div className="sp-grid-cards" style={{ marginTop: "2.5rem" }}>
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

          {/* logo marquee */}
          <div style={{ marginTop: "3.5rem" }}>
            <p className="sp-eyebrow" style={{ display: "block", textAlign: "center", marginBottom: "1.5rem" }}>
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

          {/* google reviews */}
          <div className="sp-grid-cards" style={{ marginTop: "3.5rem" }}>
            {home.reviews.items.slice(0, 6).map((r) => (
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

      {/* FINAL CTA, bundle focused */}
      <section className="sp-section" style={{ position: "relative", overflow: "hidden", textAlign: "center" }}>
        <div className="sp-glow" />
        <div className="sp-wrap sp-narrow" style={{ position: "relative" }}>
          <span className="sp-eyebrow">Best value</span>
          <h2 className="sp-display sp-h2" style={{ marginTop: "0.8rem" }}>
            Take the bundle, <span className="sp-grad-text">publish this week.</span>
          </h2>
          <p className="sp-lede" style={{ margin: "1rem auto 0", maxWidth: "42rem" }}>
            The Growth bundle gets you an explainer, four short explainers, a demo, and the full platform pitch, all
            branded to your SaaS, and it saves you a third off single pricing. Or start with a single above.
          </p>
          <div style={{ display: "flex", gap: "0.9rem", justifyContent: "center", marginTop: "1.8rem", flexWrap: "wrap" }}>
            <a href="#bundle" className="sp-btn sp-btn--primary">
              See the bundles
            </a>
            <a href={cta.bookACall.href} className="sp-btn sp-btn--ghost">
              {cta.bookACall.label}
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="sp-footer">
        <div className="sp-wrap" style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem", alignItems: "center", justifyContent: "space-between" }}>
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

/* ---- local building blocks ---- */

function SectionHead({
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

function LibraryCard({ v }: { v: LibVideo }) {
  const ready = !v.comingSoon && Boolean(v.preview);
  return (
    <div className="sp-card sp-card--hover" style={{ display: "flex", flexDirection: "column" }}>
      <SpVideo src={v.preview} poster={v.poster} label={v.title} placeholder="Coming soon" />
      <div style={{ padding: "1rem 1.15rem", display: "flex", flexDirection: "column", flex: 1 }}>
        <p style={{ fontWeight: 600 }}>{v.title}</p>
        <p className="sp-muted" style={{ fontSize: "0.85rem", marginTop: "0.2rem" }}>
          {v.format}
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            marginTop: "auto",
            paddingTop: "1rem",
          }}
        >
          {ready ? (
            <>
              <span className="sp-price" style={{ fontSize: "1.35rem" }}>
                {dollars(v.price)}
              </span>
              <a href={`/checkout/${skuFor(v.slug)}`} className="sp-btn sp-btn--primary sp-btn--sm">
                Order
              </a>
            </>
          ) : (
            <span className="sp-badge">Coming soon</span>
          )}
        </div>
      </div>
    </div>
  );
}

function TierCard({ t }: { t: Tier }) {
  const save = t.anchorPrice ? Math.round((1 - t.price / t.anchorPrice) * 100) : 0;
  const href = `/checkout/${skuFor(t.slug)}`;
  return (
    <div className={`sp-tier${t.featured ? " sp-tier--featured" : ""}`}>
      {t.featured ? <span className="sp-tier-badge">Most popular</span> : null}
      <h3 className="sp-display sp-h3">{t.name}</h3>
      <div style={{ marginTop: "0.8rem" }}>
        <span className="sp-price" style={{ fontSize: "2.6rem" }}>
          {dollars(t.price)}
        </span>
      </div>
      {t.anchorPrice ? (
        <p style={{ marginTop: "0.35rem" }}>
          <span className="sp-strike">{dollars(t.anchorPrice)}</span>
          <span
            className="sp-muted"
            style={{ marginLeft: "0.6rem", fontWeight: 600, fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.08em" }}
          >
            Save {save}%
          </span>
        </p>
      ) : null}
      <ul className="sp-tier-list">
        {t.items.map((it) => (
          <li key={it.label}>{it.label}</li>
        ))}
      </ul>
      <p className="sp-tier-delivery">Delivery in {t.deliveryDays} days</p>
      <a href={href} className="sp-btn sp-btn--primary sp-btn--wide">
        Order Now
      </a>
    </div>
  );
}
