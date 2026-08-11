import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  codeFor,
  cta,
  disclaimer,
  entityLine,
  featuredTestimonial,
  home,
  premadeVideos,
  skuFor,
  trustLogos,
} from "@/lib/site";
import {
  salesBundles,
  salesPageBySlug,
  salesPages,
  salesShared,
  type SalesBundle,
} from "@/lib/sales/pages";
import { SpVideo } from "@/components/sales/SpVideo";
import { JsonLd } from "@/components/JsonLd";
import { faqSchema, serviceSchema } from "@/lib/schema";

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
  if (!page) return { title: "GHL Video" };
  const title = page.seo?.title ?? `${page.hero.headline} ${page.hero.accent}`;
  const description = page.seo?.description ?? page.hero.sub;
  return {
    title: `${title} | GHL Video`,
    description,
    alternates: { canonical: `/lp/${slug}/` },
    // most sales LPs are private outreach (noindex from the layout); a page
    // flagged indexable is a real funnel page and overrides that here.
    robots: page.indexable
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      title: `${title} | GHL Video`,
      description,
      type: "website",
      url: `/lp/${slug}/`,
    },
  };
}

const dollars = (n: number) => `$${n.toLocaleString("en-US")}`;

/* the sales-library card shape: the new library normalized, plus a couple of
 * classic (Wistia) videos surfaced on this page. */
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

/* Classic (Wistia) videos to surface on this LP alongside the new library. */
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

/* the new library normalized to the card shape, plus the classics above */
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

export default async function SalesLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = salesPageBySlug(slug);
  if (!page) notFound();

  const ft = featuredTestimonial; // Chase Buckner

  return (
    <>
      {page.indexable ? (
        <JsonLd
          schema={[
            serviceSchema({
              name: "HighLevel White-Label Videos",
              description: page.seo?.description ?? page.hero.sub,
              path: `/lp/${slug}/`,
              offers: { lowPrice: 97, highPrice: 3495, count: premadeVideos.length },
            }),
            faqSchema(salesShared.faq),
          ]}
        />
      ) : null}
      {/* HERO */}
      <header
        className="sp-section"
        style={{ position: "relative", overflow: "hidden", paddingBlockStart: "clamp(2.5rem, 6vw, 4.5rem)" }}
      >
        <div className="sp-glow" />
        <div className="sp-wrap sp-narrow" style={{ position: "relative", textAlign: "center" }}>
          <span className="sp-eyebrow">{page.hero.eyebrow}</span>
          <h1
            className="sp-display sp-h1"
            style={{ marginTop: "1.1rem", fontSize: "clamp(2.2rem, 5.8vw, 3.6rem)" }}
          >
            {page.hero.headline}{" "}
            <span className="sp-grad-text" style={{ display: "block" }}>
              {page.hero.accent}
            </span>
          </h1>
          <p
            className="sp-lede"
            style={{ margin: "1.35rem auto 0", maxWidth: "42rem", textWrap: "normal" }}
          >
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
          {LIBRARY_CATS.map((cat, i) => {
            const vids = ALL_LIB.filter((v) => v.type === cat.type);
            if (vids.length === 0) return null;
            return (
              <div
                key={cat.type}
                style={
                  i > 0
                    ? { marginTop: "3.5rem", paddingTop: "3rem", borderTop: "1px solid var(--sp-line)" }
                    : { marginTop: "3rem" }
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
                    <LibraryCard key={v.slug} v={v} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SALES BUNDLES */}
      <section id="bundle" className="sp-section sp-section--offer" style={{ scrollMarginTop: "4rem" }}>
        <div className="sp-wrap">
          <SectionHead
            eyebrow="Bundle and save"
            title="Bundle up,"
            accent="save more."
            sub="Three ways to take the set. Pick your videos at intake with Essential or Growth, or take every video on this page with Ultimate. All white-labeled to your SaaS."
            center
          />
          <div className="sp-bundles" style={{ marginTop: "2.5rem" }}>
            {salesBundles.map((b) => (
              <SalesBundleCard key={b.sku} b={b} />
            ))}
          </div>
        </div>
      </section>

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
      <section className="sp-section sp-section--band">
        <div className="sp-wrap">
          <SectionHead
            eyebrow="Recent work"
            title="Recently delivered,"
            accent="branded to real SaaS."
            sub="A slice of recent deliveries. Every frame is white-labeled: their logo, their dashboard, their voiceover."
          />
          <div className="sp-grid-cards" style={{ marginTop: "2.5rem" }}>
            {page.clientWork.slice(0, 6).map((c, i) => (
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
      <section className="sp-section sp-section--band">
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

      {/* TESTIMONIALS: video + logos + reviews */}
      <section className="sp-section sp-section--band">
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

function LibraryCard({ v }: { v: SalesLibVideo }) {
  const ready = !v.comingSoon && Boolean(v.preview || v.wistiaId);
  const code = codeFor(v.slug);
  return (
    <div className="sp-card sp-card--hover sp-vcard">
      <SpVideo
        src={v.preview}
        poster={v.poster}
        wistiaId={v.wistiaId}
        label={v.title}
        placeholder="Coming soon"
      />
      <div className="sp-vcard-body">
        {code ? <p className="sp-vcard-code">{code.toUpperCase()}</p> : null}
        <p className="sp-vcard-title">{v.title}</p>
        <p className="sp-muted sp-vcard-feat">{v.format}</p>
      </div>
      {ready ? (
        <>
          <div className="sp-vcard-buy">
            <span className="sp-price">{dollars(v.price)}</span>
            <a href={`/checkout/${skuFor(v.slug)}`} className="sp-btn sp-btn--primary sp-btn--sm">
              Order Now
            </a>
          </div>
          <NicheNote price={v.type === "Demo" ? 100 : 50} />
        </>
      ) : (
        <div className="sp-vcard-buy sp-vcard-buy--soon">
          <span className="sp-badge">Coming soon</span>
        </div>
      )}
    </div>
  );
}

/* the ICP upsell tooltip, matched to the premade library card. Demos retune
   at $100 (they are the bigger, pricier format); everything else at $50. */
function NicheNote({ price = 50 }: { price?: number }) {
  return (
    <div className="sp-niche">
      <button type="button" className="sp-niche-trigger" aria-label="ICP customization details">
        <span aria-hidden="true" className="sp-niche-i">i</span> Serving a specific niche?
      </button>
      <div className="sp-niche-tip" role="tooltip">
        <p className="sp-niche-tip-title">Made for your niche</p>
        <p className="sp-muted" style={{ marginTop: "0.3rem" }}>
          For an extra ${price}, we retune this video to your exact ICP:
        </p>
        <ul className="sp-niche-list">
          <li>Industry footage swapped in for yours</li>
          <li>Graphics and on-screen text rebranded</li>
          <li>Conversational messaging matched to your funnel</li>
          <li>ICP wording in the script and voiceover, like clients to patients</li>
        </ul>
        <p className="sp-niche-cta">Select it at checkout</p>
      </div>
    </div>
  );
}

function SalesBundleCard({ b }: { b: SalesBundle }) {
  const save = b.anchorPrice ? Math.round((1 - b.price / b.anchorPrice) * 100) : 0;
  const href = `/checkout/${b.sku}`;
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
      <a href={href} className="sp-btn sp-btn--primary sp-btn--wide">
        Order Now
      </a>
    </div>
  );
}
