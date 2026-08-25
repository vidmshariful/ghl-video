import { SpVideo } from "@/components/sales/SpVideo";
import { SectionHead } from "@/components/sales/SectionHead";
import { JsonLd } from "@/components/JsonLd";
import { faqSchema, serviceSchema } from "@/lib/schema";
import { editingLp } from "@/lib/content/editing-lp";
import { PODCAST_TIERS, VIDEO_TIERS } from "@/lib/editing-credits";
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
 * The editing landing page.
 *
 * One page that sells the editing plans and nothing else, for paid traffic and
 * for the link we send when somebody replies to a cold email. Ten sections in
 * the order approved on 25 August 2026: the work is on screen by the third for
 * the cold click, the price by the fifth for the warm reply.
 *
 * BUILT ON THE WHITE-LABEL PAGE'S SPINE
 * -------------------------------------
 * The first version invented its own layout in every section and read as a
 * different page each time you scrolled. This one uses the structure
 * /lp/white-label-videos already proved: a centred hero with the video under
 * it, a trust strip, then sections alternating plain and banded, each opening
 * with the same SectionHead, the offer on sp-section--offer with the guarantee
 * row beneath it, and a centred close. Nothing here is a new pattern.
 *
 * Every word is in lib/content/editing-lp.ts. Every price and plan comes from
 * lib/site.ts and every credit cost from lib/editing-credits.ts, so the page
 * cannot quote a number checkout will not charge.
 */

const dollars = (n: number) => `$${n.toLocaleString("en-US")}`;
const lp = editingLp;

const from = Math.min(...editingPlans.map((p) => p.price));
const upTo = Math.max(...editingPlans.map((p) => p.price));

export function EditingLanding() {
  return (
    <>
      <JsonLd
        schema={[
          serviceSchema({
            name: "HighLevel video editing plans",
            description: lp.hero.lede,
            path: "/lp/video-editing-for-highlevel-creators/",
            offers: { lowPrice: from, highPrice: upTo, count: editingPlans.length },
          }),
          faqSchema(lp.faq.items.map((f) => ({ q: f.q, a: f.a }))),
        ]}
      />

      {/* ---------------------------------------------- 01. hero */}
      <header
        className="sp-section"
        style={{
          position: "relative",
          overflow: "hidden",
          paddingBlockStart: "clamp(2.5rem, 6vw, 4.5rem)",
        }}
      >
        <div className="sp-glow" />
        <div className="sp-wrap" style={{ position: "relative", textAlign: "center" }}>
          <span className="sp-eyebrow">{lp.hero.eyebrow}</span>
          <h1
            className="sp-display sp-h1"
            style={{ marginTop: "1.1rem", fontSize: "clamp(2.2rem, 5.8vw, 3.6rem)" }}
          >
            {lp.hero.headline}{" "}
            <span className="sp-grad-text" style={{ display: "block" }}>
              {lp.hero.accent}
            </span>
          </h1>
          <p
            className="sp-lede"
            style={{ margin: "1.35rem auto 0", maxWidth: "50rem", textWrap: "normal" }}
          >
            {lp.hero.lede}
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
            <a href="#plans" className="sp-btn sp-btn--primary">
              See the plans and pricing
            </a>
            <a href={cta.bookACall.href} className="sp-btn sp-btn--ghost">
              {cta.bookACall.label}
            </a>
          </div>
          <p className="sp-muted" style={{ marginTop: "1rem", fontSize: "0.92rem" }}>
            {lp.hero.priceNote} {dollars(from)} a month. No contract.
          </p>
        </div>
        <div
          className="sp-wrap"
          style={{
            position: "relative",
            marginTop: "clamp(2.5rem, 5vw, 3.5rem)",
            maxWidth: "980px",
          }}
        >
          <SpVideo
            src={lp.hero.videoSrc}
            poster={lp.hero.videoPoster}
            label="watch the showreel"
            placeholder="Your showreel goes here"
          />
        </div>
      </header>

      {/* ---------------------------------------------- trust */}
      <section className="sp-section--tight">
        <div className="sp-wrap sp-trust">
          <span className="sp-trust-item">
            <span className="sp-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span> {rating} on Google
          </span>
          <span className="sp-trust-item">
            <span className="sp-trust-num">{clients}+</span> HighLevel clients
          </span>
          <span className="sp-trust-item">
            <span className="sp-trust-num">Since {studioSince}</span> HighLevel-only studio
          </span>
          <span className="sp-trust-item">
            <span className="sp-trust-num">2 to 3 days</span> per video
          </span>
        </div>
      </section>

      {/* ---------------------------------------------- 02. the bottleneck */}
      <section className="sp-section sp-section--band">
        <div className="sp-wrap">
          <SectionHead
            eyebrow={lp.bottleneck.eyebrow}
            title={lp.bottleneck.headline}
            accent={lp.bottleneck.accent}
            sub={lp.bottleneck.body}
            center
          />
          <div className="sp-grid-cards" style={{ marginTop: "2.5rem" }}>
            {lp.bottleneck.points.map((p) => (
              <div key={p} className="sp-review">
                <p>{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------- 03. the work */}
      <section className="sp-section">
        <div className="sp-wrap">
          <SectionHead
            eyebrow={lp.work.eyebrow}
            title={lp.work.headline}
            accent={lp.work.accent}
            sub={lp.work.intro}
            center
          />
          <div className="sp-grid-cards" style={{ marginTop: "2.5rem" }}>
            {lp.work.samples.map((s) => (
              <figure key={s.label} className="sp-card sp-card--hover" style={{ margin: 0 }}>
                <SpVideo src={s.src} poster={s.poster} label={s.label} />
                <figcaption style={{ padding: "1rem 1.15rem" }}>
                  <p style={{ fontWeight: 600 }}>{s.label}</p>
                  <p className="sp-muted" style={{ fontSize: "0.9rem", marginTop: "0.2rem" }}>
                    {s.sub}
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------- 04. how it works */}
      <section className="sp-section sp-section--band">
        <div className="sp-wrap">
          <SectionHead
            eyebrow={lp.how.eyebrow}
            title={lp.how.headline}
            accent={lp.how.accent}
            center
          />
          <div className="sp-steps" style={{ marginTop: "2.5rem" }}>
            {lp.how.steps.map((s) => (
              <div key={s.n} className="sp-step">
                <span className="sp-step-n">{s.n}</span>
                <p
                  className="sp-display"
                  style={{ marginTop: "0.5rem", fontSize: "1.3rem", fontWeight: 600 }}
                >
                  {s.title}
                </p>
                <p className="sp-muted" style={{ marginTop: "0.4rem" }}>
                  {s.line}
                </p>
              </div>
            ))}
          </div>
          <p
            className="sp-muted"
            style={{ textAlign: "center", marginTop: "1.75rem", fontSize: "0.95rem" }}
          >
            {lp.how.promise}
          </p>
        </div>
      </section>

      {/* ---------------------------------------------- 05. the plans */}
      <section
        id="plans"
        className="sp-section sp-section--offer"
        style={{ scrollMarginTop: "4rem" }}
      >
        <div className="sp-wrap">
          <SectionHead
            eyebrow={lp.plans.eyebrow}
            title={lp.plans.headline}
            accent={lp.plans.accent}
            sub={lp.plans.intro}
            center
          />

          <div className="sp-tiers sp-tiers--three" style={{ marginTop: "2.5rem" }}>
            {editingPlans.map((p) => (
              <div key={p.sku} className={`sp-tier${p.featured ? " sp-tier--featured" : ""}`}>
                {p.featured && <span className="sp-tier-badge">Most picked</span>}
                <h3 className="sp-display sp-h3" style={{ lineHeight: 1.3 }}>
                  {p.name}
                </h3>
                <p className="sp-muted" style={{ marginTop: "0.3rem" }}>
                  {p.blurb}
                </p>
                <p className="sp-price" style={{ marginTop: "1rem" }}>
                  {dollars(p.price)}
                  <span className="sp-per">a month</span>
                </p>
                <p className="sp-strike">{dollars(p.anchorPrice)}</p>
                <ul className="sp-tier-list">
                  {p.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <a
                  href={`/checkout/${p.sku}/`}
                  className={`sp-btn sp-btn--wide ${p.featured ? "sp-btn--primary" : "sp-btn--ghost"}`}
                >
                  {cta.startEditing}
                </a>
              </div>
            ))}
          </div>

          {/* risk reversal, right under the offer where the decision is made */}
          <div className="sp-guarantees">
            {lp.plans.includes.map((g) => (
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

      {/* ---------------------------------------------- 06. credits */}
      <section className="sp-section">
        <div className="sp-wrap">
          <SectionHead
            eyebrow={lp.credits.eyebrow}
            title={lp.credits.headline}
            accent={lp.credits.accent}
            sub={lp.credits.intro}
            center
          />
          <div className="sp-rates" style={{ marginTop: "2.5rem" }}>
            {VIDEO_TIERS.map((t) => (
              <div key={t.key} className="sp-rate">
                <span className="sp-rate-n">{t.credits}</span>
                <span className="sp-rate-word">{t.credits === 1 ? "credit" : "credits"}</span>
                <h3>{t.label}</h3>
                <p>{t.lengthNote}</p>
              </div>
            ))}
            {PODCAST_TIERS.map((t) => (
              <div key={t.key} className="sp-rate">
                <span className="sp-rate-n">{t.perBlock}</span>
                <span className="sp-rate-word">per 30 min</span>
                <h3>{t.label}</h3>
                <p>{t.lengthNote}</p>
              </div>
            ))}
          </div>
          <p
            className="sp-muted"
            style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.9rem" }}
          >
            {lp.credits.note}
          </p>
        </div>
      </section>

      {/* ---------------------------------------------- 07. who it is for */}
      <section className="sp-section sp-section--band">
        <div className="sp-wrap">
          <SectionHead
            eyebrow={lp.fit.eyebrow}
            title={lp.fit.headline}
            accent={lp.fit.accent}
            center
          />
          <div className="sp-fit" style={{ marginTop: "2.5rem" }}>
            <div className="sp-card sp-fit-col sp-fit-col--yes">
              <h3 className="sp-display sp-h3">{lp.fit.forYou.title}</h3>
              <ul>
                {lp.fit.forYou.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
            <div className="sp-card sp-fit-col sp-fit-col--no">
              <h3 className="sp-display sp-h3">{lp.fit.notForYou.title}</h3>
              <ul>
                {lp.fit.notForYou.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------- 08. proof */}
      <section className="sp-section">
        <div className="sp-wrap sp-featured">
          <SpVideo
            src={featuredTestimonial.src}
            poster={featuredTestimonial.poster}
            label={`Testimonial from ${featuredTestimonial.name}`}
          />
          <div>
            <span
              className="sp-pill"
              style={{ color: "var(--sp-gold)", borderColor: "rgba(252, 192, 0, 0.3)" }}
            >
              {featuredTestimonial.marker}
            </span>
            <blockquote style={{ margin: "1.2rem 0 0" }}>
              <p className="sp-display sp-h3" style={{ lineHeight: 1.25 }}>
                &ldquo;{featuredTestimonial.pull}&rdquo;
              </p>
              <p className="sp-lede" style={{ marginTop: "0.9rem" }}>
                {featuredTestimonial.quote}
              </p>
            </blockquote>
            <p
              style={{
                marginTop: "1.2rem",
                borderLeft: "2px solid var(--sp-gold)",
                paddingLeft: "0.9rem",
              }}
            >
              <span style={{ fontWeight: 600, display: "block" }}>{featuredTestimonial.name}</span>
              <span className="sp-muted">{featuredTestimonial.role}</span>
            </p>
          </div>
        </div>
      </section>

      <section className="sp-section sp-section--band">
        <div className="sp-wrap">
          <SectionHead
            eyebrow={lp.proof.eyebrow}
            title={lp.proof.headline}
            accent={lp.proof.accent}
            center
          />

          {/* the three named clients. Photos and words are null until they
              send them, and the card says so rather than inventing a sentence
              to sit under a real person's name. */}
          <div className="sp-grid-cards" style={{ marginTop: "2.5rem" }}>
            {lp.proof.clients.map((c) => (
              <div key={c.name} className="sp-review">
                <div className="sp-person-head">
                  {c.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.photo} alt="" className="sp-person-photo" />
                  ) : (
                    <span className="sp-person-photo sp-person-photo--empty" aria-hidden="true">
                      {c.name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")}
                    </span>
                  )}
                  <span>
                    <b>{c.name}</b>
                    <span className="sp-person-co">{c.company}</span>
                  </span>
                </div>
                {c.quote ? (
                  <p className="sp-person-quote">&ldquo;{c.quote}&rdquo;</p>
                ) : (
                  <p className="sp-person-quote sp-person-quote--pending">{lp.proof.pending}</p>
                )}
              </div>
            ))}
          </div>

          {/* logo marquee, same as the white-label page */}
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
                  // eslint-disable-next-line @next/next/no-img-element
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
          <p
            className="sp-muted"
            style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.9rem" }}
          >
            Every review on Google, five stars.
          </p>
        </div>
      </section>

      {/* ---------------------------------------------- 09. faq */}
      <section className="sp-section">
        <div className="sp-wrap sp-narrow">
          <SectionHead
            eyebrow={lp.faq.eyebrow}
            title={lp.faq.headline}
            accent={lp.faq.accent}
            center
          />
          <div className="sp-faq" style={{ marginTop: "2rem" }}>
            {lp.faq.items.map((f) => (
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

      {/* ---------------------------------------------- 10. close */}
      <section
        className="sp-section"
        style={{ position: "relative", overflow: "hidden", textAlign: "center" }}
      >
        <div className="sp-glow" />
        <div className="sp-wrap sp-narrow" style={{ position: "relative" }}>
          <span className="sp-eyebrow">Start this week</span>
          <h2 className="sp-display sp-h2" style={{ marginTop: "0.8rem" }}>
            {lp.closing.headline} <span className="sp-grad-text">{lp.closing.accent}</span>
          </h2>
          <p className="sp-lede" style={{ margin: "1rem auto 0", maxWidth: "42rem" }}>
            {lp.closing.sub}
          </p>
          <div
            style={{
              display: "flex",
              gap: "0.9rem",
              justifyContent: "center",
              marginTop: "1.8rem",
              flexWrap: "wrap",
            }}
          >
            <a href="#plans" className="sp-btn sp-btn--primary">
              {cta.startEditing}
            </a>
            <a href={cta.bookACall.href} className="sp-btn sp-btn--ghost">
              {cta.bookACall.label}
            </a>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------- footer */}
      <footer className="sp-footer">
        <div
          className="sp-wrap"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "1.25rem",
            alignItems: "center",
            justifyContent: "space-between",
          }}
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
