import { SectionHead } from "@/components/sales/SectionHead";
import { BookCall } from "@/components/sales/BookCall";
import { QuoteRequest } from "@/components/sales/QuoteRequest";
import { JsonLd } from "@/components/JsonLd";
import { faqSchema, serviceSchema } from "@/lib/schema";
import {
  clients,
  cta,
  disclaimer,
  entityLine,
  featuredTestimonial,
  pages,
  rating,
  studioSince,
} from "@/lib/site";

/*
 * The custom production landing page.
 *
 * One job: somebody who needs a video made for their own platform, and wants
 * to know what it costs before they book a call. Everything on it already
 * existed as copy on the marketing page; what is different here is the order.
 *
 * Price comes early, and the four floors are printed rather than hidden
 * behind a form. The whole objection this page answers is "how much", and a
 * page that makes you fill in a brief to find out is a page people leave.
 * The form is the close, not the toll gate.
 */
export function CustomLanding() {
  const c = pages.custom;
  const ft = featuredTestimonial;
  const formatNames = c.formats.items.map((f) => f.name);
  const from = Math.min(...c.formats.items.map((f) => f.from));

  return (
    <>
      <JsonLd
        schema={[
          serviceSchema({
            name: "Custom Video Production for HighLevel SaaS",
            description: c.hero.lede,
            path: "/lp/custom-video/",
            offers: {
              lowPrice: from,
              highPrice: Math.max(...c.formats.items.map((f) => f.from)),
              count: c.formats.items.length,
            },
          }),
          faqSchema(c.faq.items),
        ]}
      />

      {/* ---------------------------------------------- hero */}
      <section className="sp-section" style={{ position: "relative", overflow: "hidden" }}>
        <div className="sp-glow" />
        <div className="sp-wrap sp-narrow" style={{ position: "relative", textAlign: "center" }}>
          <span className="sp-eyebrow">{c.hero.chip}</span>
          <h1 className="sp-display sp-h1" style={{ marginTop: "0.8rem" }}>
            {c.hero.headline} <span className="sp-grad-text">{c.hero.accent}</span>
          </h1>
          <p className="sp-lede sp-muted" style={{ marginTop: "1.1rem" }}>
            {c.hero.lede}
          </p>

          {/* the number, above the fold, because it is the question */}
          <p className="sp-price" style={{ marginTop: "1.6rem" }}>
            From ${from.toLocaleString("en-US")}
            <span className="sp-muted" style={{ fontSize: "1rem", fontWeight: 400 }}>
              {" "}
              per project, quoted exactly before we start
            </span>
          </p>

          <div
            style={{
              marginTop: "1.8rem",
              display: "flex",
              gap: "0.8rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <a href="#quote" className="sp-btn sp-btn--primary">
              {cta.requestQuote.label}
            </a>
            <BookCall className="sp-btn sp-btn--ghost" />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------- trust */}
      <section className="sp-section sp-section--tight">
        <div className="sp-wrap sp-trust">
          {/* the + is not decoration: the count is written as 1000+ everywhere,
              and printing a bare 1000 reads as an exact figure we do not claim */}
          <div className="sp-trust-item">
            <span className="sp-trust-num">{clients}+</span>
            <span className="sp-muted">HighLevel SaaS served</span>
          </div>
          <div className="sp-trust-item">
            <span className="sp-trust-num">{studioSince}</span>
            <span className="sp-muted">creating HighLevel videos since</span>
          </div>
          <div className="sp-trust-item">
            <span className="sp-trust-num">{rating}</span>
            <span className="sp-muted">every review, five stars</span>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------- the four formats, priced */}
      <section className="sp-section sp-section--band" id="formats">
        <div className="sp-wrap">
          <SectionHead
            eyebrow={c.formats.chip}
            title={c.formats.headline}
            accent={c.formats.accent}
            sub={c.formats.intro}
            center
          />
          {/* sp-cformats, not sp-grid-cards: four formats in a three column
              grid leaves one orphan on its own row, and this one is already
              1 / 2 / 4. sp-card is a bare surface with no padding, meant to
              wrap media; sp-cformat is the padded one. */}
          <div className="sp-cformats" style={{ marginTop: "2.5rem" }}>
            {c.formats.items.map((f) => (
              <div key={f.name} className="sp-cformat">
                <p className="sp-cformat-name">{f.name}</p>
                <p className="sp-cformat-from">
                  From <strong>${f.from.toLocaleString("en-US")}</strong>
                </p>
                <p className="sp-muted" style={{ marginTop: "0.7rem", fontSize: "0.92rem" }}>
                  {f.line}
                </p>
                <ul className="sp-tier-list" style={{ marginTop: "1.1rem" }}>
                  {f.includes.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------- how pricing works */}
      <section className="sp-section">
        <div className="sp-wrap">
          <SectionHead
            eyebrow={c.pricing.chip}
            title={c.pricing.headline}
            accent={c.pricing.accent}
            center
          />
          <div className="sp-grid-cards" style={{ marginTop: "2.5rem" }}>
            {c.pricing.points.map((p) => (
              <div key={p.title} className="sp-cformat">
                <h3 className="sp-display sp-h3">{p.title}</h3>
                <p className="sp-muted" style={{ marginTop: "0.6rem" }}>
                  {p.line}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------- what every video has to do */}
      <section className="sp-section sp-section--band">
        <div className="sp-wrap">
          <SectionHead
            eyebrow={c.craft.chip}
            title={c.craft.headline}
            accent={c.craft.accent}
            sub={c.craft.intro}
            center
          />
          <div className="sp-grid-cards" style={{ marginTop: "2.5rem" }}>
            {c.craft.items.map((i) => (
              <div key={i.title} className="sp-cformat">
                <h3 className="sp-display sp-h3">{i.title}</h3>
                <p className="sp-muted" style={{ marginTop: "0.6rem" }}>
                  {i.line}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------- the process */}
      <section className="sp-section">
        <div className="sp-wrap">
          <SectionHead
            eyebrow={c.process.chip}
            title={c.process.headline}
            accent={c.process.accent}
            sub={c.process.intro}
            center
          />
          <div className="sp-flow" style={{ marginTop: "2.5rem" }}>
            {c.process.steps.map((s, i) => (
              <div key={s.title} className="sp-flow-step">
                <span className="sp-step-icon">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="sp-display sp-flow-title">{s.title}</h3>
                <p className="sp-muted sp-flow-line">{s.line}</p>
              </div>
            ))}
          </div>
          <p className="sp-muted" style={{ marginTop: "2rem", textAlign: "center" }}>
            You watch all six happen. Every project gets a portal where each step
            shows its state, and nothing moves past you without your approval.
          </p>
        </div>
      </section>

      {/* ---------------------------------------------- why us */}
      <section className="sp-section sp-section--band">
        <div className="sp-wrap">
          <SectionHead
            eyebrow={c.difference.chip}
            title={c.difference.headline}
            accent={c.difference.accent}
            sub={c.difference.intro}
            center
          />
          <div className="sp-grid-cards" style={{ marginTop: "2.5rem" }}>
            {c.capabilities.map((x) => (
              <div key={x.title} className="sp-cformat">
                <h3 className="sp-display sp-h3">{x.title}</h3>
                <p className="sp-muted" style={{ marginTop: "0.6rem" }}>
                  {x.line}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------- the one that carries weight */}
      <section className="sp-section">
        <div className="sp-wrap sp-narrow">
          <div className="sp-review" style={{ textAlign: "center" }}>
            <p className="sp-stars">{"★".repeat(5)}</p>
            <p className="sp-person-quote" style={{ marginTop: "1rem" }}>
              {ft.quote}
            </p>
            <p className="sp-muted" style={{ marginTop: "1.2rem" }}>
              <strong style={{ color: "var(--sp-text)" }}>{ft.name}</strong>
              {ft.role ? `, ${ft.role}` : ""}
            </p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------- the close: the form */}
      <section className="sp-section sp-section--offer" id="quote" style={{ scrollMarginTop: "2rem" }}>
        <div className="sp-wrap sp-narrow">
          <SectionHead
            eyebrow={c.getStarted.chip}
            title={c.getStarted.headline}
            accent={c.getStarted.accent}
            sub={c.getStarted.intro}
            center
          />
          {/* its own panel rather than a nested sp-wrap: two wraps inside each
              other each apply their own max-width and the form ended up half
              width and hard left under a centred heading */}
          <div className="sp-quote-panel">
            <QuoteRequest formats={formatNames} />
          </div>
          <p className="sp-muted" style={{ marginTop: "1.5rem", textAlign: "center" }}>
            Rather talk it through first? <BookCall className="sp-link" />
          </p>
        </div>
      </section>

      {/* ---------------------------------------------- faq */}
      <section className="sp-section sp-section--band">
        <div className="sp-wrap sp-narrow">
          <SectionHead eyebrow={c.faq.chip} title={c.faq.headline} accent={c.faq.accent} center />
          <div className="sp-faq" style={{ marginTop: "2rem" }}>
            {c.faq.items.map((f) => (
              <details key={f.q} className="sp-faq-item">
                <summary className="sp-faq-q">
                  {f.q}
                  <span className="sp-faq-chevron" aria-hidden="true" />
                </summary>
                <p className="sp-muted sp-faq-a">{f.a}</p>
              </details>
            ))}
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
