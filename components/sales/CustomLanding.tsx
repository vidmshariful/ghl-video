import { SectionHead } from "@/components/sales/SectionHead";
import { SpVideo } from "@/components/sales/SpVideo";
import { BookCall } from "@/components/sales/BookCall";
import { QuoteRequest } from "@/components/sales/QuoteRequest";
import { JsonLd } from "@/components/JsonLd";
import { faqSchema, serviceSchema } from "@/lib/schema";
import { clips, posters } from "@/lib/content/media";
import type { CustomSalesPage } from "@/lib/sales/pages";
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
 * Who it is for: somebody selling HighLevel under their own brand who needs a
 * video about THEIR positioning, and wants the price before a call.
 *
 * Two things drive the layout.
 *
 * It sells video, so it shows video. The first pass of this page was a wall
 * of text with a price in it and not one moving frame, on the one product
 * where the work IS the argument. Every format now plays its own example
 * beside its own price, which makes the pricing section and the sample reel
 * one section: you watch what $2,500 buys while you read what it costs.
 *
 * And it alternates rather than repeats. The first pass had three rows of
 * three identical cards, which is the exact thing the house rules ban, and it
 * read as a template. The format rows flip side to side, and the sections
 * between them change shape instead of restating one.
 */
const MEDIA: Record<string, { src: string | null; poster: string | null }> = {
  featured: { src: clips.featured, poster: posters.featured },
  sampleA: { src: clips.sampleA, poster: posters.sampleA },
  sampleB: { src: clips.sampleB, poster: posters.sampleB },
  sampleC: { src: clips.sampleC, poster: posters.sampleC },
};

export function CustomLanding({ page }: { page: CustomSalesPage }) {
  const c = pages.custom;
  const ft = featuredTestimonial;
  const items = c.formats.items;
  const formatNames = items.map((f) => f.name);
  const from = Math.min(...items.map((f) => f.from));

  return (
    <>
      <JsonLd
        schema={[
          serviceSchema({
            name: "Custom Video Production for HighLevel SaaS",
            description: page.hero.sub,
            path: "/lp/custom-video/",
            offers: {
              lowPrice: from,
              highPrice: Math.max(...items.map((f) => f.from)),
              count: items.length,
            },
          }),
          faqSchema(c.faq.items),
        ]}
      />

      {/* ------------------------------- hero: the work, not a promise about it */}
      <section className="sp-section" style={{ position: "relative", overflow: "hidden" }}>
        <div className="sp-glow" />
        <div className="sp-wrap" style={{ position: "relative" }}>
          <div className="sp-hero-split">
            <div>
              <span className="sp-eyebrow">{page.hero.eyebrow}</span>
              <h1 className="sp-display sp-h1" style={{ marginTop: "0.8rem" }}>
                {page.hero.headline} <span className="sp-grad-text">{page.hero.accent}</span>
              </h1>
              <p className="sp-lede sp-muted" style={{ marginTop: "1.1rem" }}>
                {page.hero.sub}
              </p>

              <p className="sp-hero-price">
                From <strong>${from.toLocaleString("en-US")}</strong>
                <span> a project, quoted exactly before we start</span>
              </p>

              <div className="sp-hero-actions" style={{ marginTop: "1.6rem" }}>
                <a href="#quote" className="sp-btn sp-btn--primary">
                  {cta.requestQuote.label}
                </a>
                <BookCall className="sp-btn sp-btn--ghost" />
              </div>
            </div>

            <SpVideo
              src={clips.featured}
              poster={posters.featured}
              label="A recent custom build"
              placeholder="Custom work"
            />
          </div>
        </div>
      </section>

      {/* ------------------------------- trust */}
      <section className="sp-section sp-section--tight">
        <div className="sp-wrap sp-trust">
          {/* the + is not decoration: the count is written as 1000+ everywhere,
              and a bare 1000 reads as an exact figure we do not claim */}
          <div className="sp-trust-item">
            <span className="sp-trust-num">{clients}+</span>
            <span className="sp-muted">HighLevel SaaS served</span>
          </div>
          <div className="sp-trust-item">
            <span className="sp-trust-num">{studioSince}</span>
            <span className="sp-muted">building HighLevel videos since</span>
          </div>
          <div className="sp-trust-item">
            <span className="sp-trust-num">{rating}</span>
            <span className="sp-muted">every review, five stars</span>
          </div>
        </div>
      </section>

      {/* ------------------------------- what each one costs, and what it looks like */}
      <section className="sp-section sp-section--band" id="formats">
        <div className="sp-wrap">
          <SectionHead
            eyebrow={c.formats.chip}
            title={c.formats.headline}
            accent={c.formats.accent}
            sub={page.formatsIntro}
            center
          />

          <div className="sp-formats">
            {items.map((f, i) => {
              const m = MEDIA[f.mediaKey] ?? { src: null, poster: null };
              return (
                <div
                  key={f.name}
                  className={`sp-hero-split sp-format-row${i % 2 ? " sp-format-row--flip" : ""}`}
                >
                  <div className="sp-format-copy">
                    {/* a heading, not a styled span: these four are the most
                        scannable thing on the page and were missing from the
                        outline entirely, so nothing navigating by heading
                        could find a format */}
                    <h3 className="sp-eyebrow">{f.name}</h3>
                    <p className="sp-format-price">
                      From <strong>${f.from.toLocaleString("en-US")}</strong>
                    </p>
                    <p className="sp-muted" style={{ marginTop: "0.9rem", maxWidth: "34rem" }}>
                      {f.line}
                    </p>
                    <ul className="sp-tier-list" style={{ marginTop: "1.3rem" }}>
                      {f.includes.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="sp-format-media">
                    <SpVideo src={m.src} poster={m.poster} label={f.name} placeholder={f.name} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------- how pricing works: a sequence, not a third card row */}
      <section className="sp-section">
        <div className="sp-wrap sp-narrow">
          <SectionHead
            eyebrow={c.pricing.chip}
            title={c.pricing.headline}
            accent={c.pricing.accent}
            center
          />
          <ol className="sp-pricing-steps">
            {c.pricing.points.map((p, i) => (
              <li key={p.title}>
                <span className="sp-pricing-n">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="sp-display sp-h3">{p.title}</h3>
                  <p className="sp-muted" style={{ marginTop: "0.4rem" }}>
                    {p.line}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------- Chase, in his own voice */}
      <section className="sp-section sp-section--band">
        <div className="sp-wrap">
          <div className="sp-hero-split">
            <div>
              <span className="sp-badge">{ft.marker}</span>
              <p className="sp-display sp-h2" style={{ marginTop: "1.2rem", lineHeight: 1.15 }}>
                &ldquo;{ft.pull}&rdquo;
              </p>
              <p className="sp-muted" style={{ marginTop: "1.2rem", maxWidth: "34rem" }}>
                {ft.quote}
              </p>
              <p style={{ marginTop: "1.4rem", fontWeight: 600 }}>{ft.name}</p>
              <p className="sp-muted" style={{ fontSize: "0.9rem" }}>
                {ft.role}
              </p>
            </div>
            <SpVideo src={ft.src} poster={ft.poster} label={ft.name} placeholder={ft.name} />
          </div>
        </div>
      </section>

      {/* ------------------------------- what every video has to do */}
      <section className="sp-section">
        <div className="sp-wrap sp-narrow">
          <SectionHead
            eyebrow={c.craft.chip}
            title={c.craft.headline}
            accent={c.craft.accent}
            sub={c.craft.intro}
          />
          <div className="sp-necks" style={{ marginTop: "2rem" }}>
            {c.craft.items.map((i) => (
              <div key={i.title} className="sp-neck">
                <h3 className="sp-display sp-neck-title">{i.title}</h3>
                <p className="sp-muted sp-neck-line">{i.line}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------- the process */}
      <section className="sp-section sp-section--band">
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

      {/* ------------------------------- why a team that already knows the platform */}
      <section className="sp-section">
        <div className="sp-wrap sp-narrow">
          <SectionHead
            eyebrow={c.difference.chip}
            title={c.difference.headline}
            accent={c.difference.accent}
            sub={c.difference.intro}
          />
          <div className="sp-necks" style={{ marginTop: "2rem" }}>
            {c.capabilities.map((x) => (
              <div key={x.title} className="sp-neck">
                <h3 className="sp-display sp-neck-title">{x.title}</h3>
                <p className="sp-muted sp-neck-line">{x.line}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------- the close */}
      <section
        className="sp-section sp-section--offer"
        id="quote"
        style={{ scrollMarginTop: "2rem" }}
      >
        <div className="sp-wrap sp-narrow">
          <SectionHead
            eyebrow={c.getStarted.chip}
            title={c.getStarted.headline}
            accent={c.getStarted.accent}
            sub={c.getStarted.intro}
            center
          />
          {/* its own panel rather than a nested sp-wrap: two wraps inside each
              other each apply their own max-width, and the form ended up half
              width and hard left under a centred heading */}
          <div className="sp-quote-panel">
            <QuoteRequest formats={formatNames} />
          </div>
          <p className="sp-muted" style={{ marginTop: "1.5rem", textAlign: "center" }}>
            Rather talk it through first? <BookCall className="sp-link" />
          </p>
        </div>
      </section>

      {/* ------------------------------- faq */}
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

      {/* ------------------------------- footer */}
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
