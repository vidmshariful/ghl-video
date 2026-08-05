import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { newReady, type BrowseVideo } from "@/components/premade/catalog";
import {
  cta,
  disclaimer,
  entityLine,
  featuredTestimonial,
  premadePacks,
  skuFor,
} from "@/lib/site";
import { salesPageBySlug, salesPages, salesShared } from "@/lib/sales/pages";
import { SpVideo } from "@/components/sales/SpVideo";
import { SpWhiteLabel } from "@/components/sales/SpWhiteLabel";

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

export default async function SalesLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = salesPageBySlug(slug);
  if (!page) notFound();

  const pack = premadePacks[0]; // AI First SaaS Pack (the bundle)
  const packHref = `/checkout/${skuFor(pack.slug)}`;
  const ft = featuredTestimonial; // Chase Buckner
  const packLines = [
    "Every video branded to your SaaS",
    "Full commercial rights, no attribution",
    "Delivered in 5 to 7 days",
  ];

  return (
    <>
      {/* HERO */}
      <header
        className="sp-section"
        style={{ position: "relative", overflow: "hidden", paddingBlockStart: "clamp(3rem, 7vw, 5.5rem)" }}
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
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.9rem",
              justifyContent: "center",
              marginTop: "2rem",
            }}
          >
            <a href="#order" className="sp-btn sp-btn--primary">
              See the videos and pricing
            </a>
            <a href={cta.bookACall.href} className="sp-btn sp-btn--ghost">
              {cta.bookACall.label}
            </a>
          </div>
        </div>
        <div
          className="sp-wrap"
          style={{ position: "relative", marginTop: "clamp(2.5rem, 5vw, 3.5rem)", maxWidth: "980px" }}
        >
          <SpVideo
            src={page.hero.vslSrc}
            poster={page.hero.vslPoster}
            label="watch the overview"
            placeholder="Your VSL goes here"
          />
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

      {/* CLIENT WORK SHOWCASE */}
      <section className="sp-section">
        <div className="sp-wrap">
          <SectionHead
            eyebrow="Recent work"
            title="See the quality,"
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

      {/* WHITE LABEL */}
      <section className="sp-section">
        <div className="sp-wrap sp-featured">
          <div>
            <span className="sp-eyebrow">Your brand, not ours</span>
            <h2 className="sp-display sp-h2" style={{ marginTop: "0.8rem" }}>
              See it as <span className="sp-grad-text">your video.</span>
            </h2>
            <p className="sp-lede" style={{ marginTop: "1rem" }}>
              Every video is customized to your SaaS: your logo, your dashboard theme, your colors, and a
              voiceover in your choice of accent. Toggle to see the difference.
            </p>
          </div>
          <SpWhiteLabel
            defaultSrc={page.whiteLabel.defaultSrc}
            brandedSrc={page.whiteLabel.brandedSrc}
            poster={page.whiteLabel.poster}
          />
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

      {/* ORDER */}
      <section id="order" className="sp-section" style={{ scrollMarginTop: "1.5rem" }}>
        <div className="sp-wrap">
          <SectionHead
            eyebrow="Order"
            title="Grab a single,"
            accent="or take the pack."
            sub="Order right here. Single videos ship on their own, or take the full pack and save. Every video branded to your SaaS."
            center
          />

          {/* the pack, featured */}
          <div className="sp-card" style={{ marginTop: "2.5rem" }}>
            <div className="sp-featured" style={{ padding: "clamp(1.1rem, 2.5vw, 1.6rem)" }}>
              <SpVideo src={pack.categories[0].videos[0].src} poster="/posters/ai-master.jpg" label={pack.name} />
              <div>
                <span className="sp-eyebrow">The pack, {pack.count} videos</span>
                <h3 className="sp-display sp-h3" style={{ marginTop: "0.6rem" }}>
                  {pack.name}
                </h3>
                <p className="sp-muted" style={{ marginTop: "0.5rem" }}>
                  {pack.tagline}
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: "1.1rem 0 0", display: "grid", gap: "0.5rem" }}>
                  {packLines.map((l) => (
                    <li key={l} className="sp-muted" style={{ display: "flex", gap: "0.6rem", fontSize: "0.95rem" }}>
                      <span style={{ color: "var(--sp-gold)" }} aria-hidden="true">
                        &#10003;
                      </span>
                      {l}
                    </li>
                  ))}
                </ul>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.7rem", marginTop: "1.25rem" }}>
                  {pack.anchorPrice ? <span className="sp-strike">{dollars(pack.anchorPrice)}</span> : null}
                  <span className="sp-price" style={{ fontSize: "2.1rem" }}>
                    {dollars(pack.price ?? 0)}
                  </span>
                </div>
                <a href={packHref} className="sp-btn sp-btn--primary sp-btn--wide" style={{ marginTop: "1.1rem" }}>
                  Order the pack
                </a>
              </div>
            </div>
          </div>

          {/* singles */}
          <h3 className="sp-display sp-h3" style={{ marginTop: "3rem", textAlign: "center" }}>
            Or order any video on its own
          </h3>
          <div className="sp-grid-cards" style={{ marginTop: "1.75rem" }}>
            {newReady.map((v) => (
              <OrderCard key={v.slug} v={v} />
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="sp-section">
        <div className="sp-wrap">
          <SectionHead
            eyebrow="How it works"
            title={salesShared.howItWorks.heading}
            accent={salesShared.howItWorks.accent}
            center
          />
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

      {/* CUSTOM FALLBACK */}
      <section className="sp-section--tight">
        <div className="sp-wrap">
          <div className="sp-panel-cta sp-featured">
            <div>
              <span className="sp-eyebrow">Premade does not fit?</span>
              <h2 className="sp-display sp-h3" style={{ marginTop: "0.6rem" }}>
                We will build it custom for your SaaS.
              </h2>
              <p className="sp-muted" style={{ marginTop: "0.6rem" }}>
                If none of these match your positioning, we script and produce a video from scratch for your
                exact offer and ICP. Book a quick call and we will scope it with you.
              </p>
            </div>
            <div
              style={{
                display: "flex",
                gap: "0.8rem",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "flex-start",
              }}
            >
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

      {/* GUARANTEES */}
      <section className="sp-section--tight">
        <div className="sp-wrap sp-grid-cards">
          {salesShared.guarantees.map((g) => (
            <div key={g.title} className="sp-step">
              <p style={{ fontWeight: 600 }}>{g.title}</p>
              <p className="sp-muted" style={{ marginTop: "0.4rem", fontSize: "0.92rem" }}>
                {g.line}
              </p>
            </div>
          ))}
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

      {/* FINAL CTA */}
      <section className="sp-section" style={{ position: "relative", overflow: "hidden", textAlign: "center" }}>
        <div className="sp-glow" />
        <div className="sp-wrap sp-narrow" style={{ position: "relative" }}>
          <h2 className="sp-display sp-h2">
            {page.closing.headline} <span className="sp-grad-text">{page.closing.accent}</span>
          </h2>
          <p className="sp-lede" style={{ margin: "1rem auto 0", maxWidth: "40rem" }}>
            {page.closing.sub}
          </p>
          <div
            style={{ display: "flex", gap: "0.9rem", justifyContent: "center", marginTop: "1.8rem", flexWrap: "wrap" }}
          >
            <a href="#order" className="sp-btn sp-btn--primary">
              See the videos
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
  accent: string;
  sub?: string;
  center?: boolean;
}) {
  return (
    <div
      style={{
        maxWidth: center ? "44rem" : "40rem",
        marginInline: center ? "auto" : undefined,
        textAlign: center ? "center" : "left",
      }}
    >
      <span className="sp-eyebrow">{eyebrow}</span>
      <h2 className="sp-display sp-h2" style={{ marginTop: "0.7rem" }}>
        {title} <span className="sp-grad-text">{accent}</span>
      </h2>
      {sub ? (
        <p className="sp-lede" style={{ marginTop: "0.9rem" }}>
          {sub}
        </p>
      ) : null}
    </div>
  );
}

function OrderCard({ v }: { v: BrowseVideo }) {
  const href = `/checkout/${skuFor(v.slug)}`;
  return (
    <div className="sp-card sp-card--hover" style={{ display: "flex", flexDirection: "column" }}>
      <SpVideo src={v.preview} poster={v.poster} label={v.title} />
      <div style={{ padding: "1rem 1.15rem", display: "flex", flexDirection: "column", flex: 1 }}>
        <p style={{ fontWeight: 600 }}>{v.title}</p>
        <p className="sp-muted" style={{ fontSize: "0.85rem", marginTop: "0.2rem" }}>
          {v.typeTag}
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
          <span className="sp-price" style={{ fontSize: "1.35rem" }}>
            {dollars(v.price)}
          </span>
          <a href={href} className="sp-btn sp-btn--primary sp-btn--sm">
            Order
          </a>
        </div>
      </div>
    </div>
  );
}
