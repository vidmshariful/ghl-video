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
const dollars = (n: number) => `$${n.toLocaleString("en-US")}`;

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
  /* the three a buyer chooses between, and the programme that is a different
     kind of decision. Found by name rather than by index so reordering the
     catalogue cannot silently promote the wrong one into the row of three. */
  const series = items.find((f) => f.name === "Onboarding Series") ?? null;
  const main = items.filter((f) => f !== series);

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

      {/* ------------------------------- hero */}
      <section
        className="sp-section"
        style={{
          position: "relative",
          overflow: "hidden",
          paddingBlockStart: "clamp(2.5rem, 6vw, 4.5rem)",
        }}
      >
        <div className="sp-glow" />
        <div className="sp-wrap" style={{ position: "relative", textAlign: "center" }}>
          <span className="sp-eyebrow">{page.hero.eyebrow}</span>
          <h1 className="sp-display sp-h1" style={{ marginTop: "1.1rem" }}>
            {page.hero.headline}{" "}
            <span className="sp-grad-text" style={{ display: "block" }}>
              {page.hero.accent}
            </span>
          </h1>
          <p
            className="sp-lede"
            style={{ margin: "1.35rem auto 0", maxWidth: "46rem", textWrap: "normal" }}
          >
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
            <a href="#formats" className="sp-btn sp-btn--primary">
              See the floor pricing
            </a>
            <a href="#quote" className="sp-btn sp-btn--ghost">
              {cta.requestQuote.label}
            </a>
          </div>
          <p className="sp-muted" style={{ marginTop: "1rem", fontSize: "0.92rem" }}>
            From {dollars(from)} a project. A fixed quote in 24 hours, before anything starts.
          </p>
        </div>

        {/* the showreel, under the promise rather than beside it */}
        <div
          className="sp-wrap"
          style={{
            position: "relative",
            marginTop: "clamp(2.5rem, 5vw, 3.5rem)",
            maxWidth: "980px",
          }}
        >
          <SpVideo
            src={page.hero.videoSrc}
            poster={page.hero.videoPoster}
            label="watch the showreel"
            placeholder="Custom work showreel"
          />
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

      {/* ------------------------------- what each one costs, and looks like */}
      <section className="sp-section sp-section--band" id="formats">
        <div className="sp-wrap">
          <SectionHead
            eyebrow={c.formats.chip}
            title={c.formats.headline}
            accent={c.formats.accent}
            sub={page.formatsIntro}
            center
          />

          <div className="sp-fmt-grid">
            {main.map((f) => {
              const m = MEDIA[f.mediaKey] ?? { src: null, poster: null };
              return (
                <article key={f.name} className="sp-fmt">
                  <SpVideo src={m.src} poster={m.poster} label={f.name} placeholder={f.name} />
                  <div className="sp-fmt-body">
                    <h3 className="sp-fmt-name">{f.name}</h3>
                    <p className="sp-fmt-price">
                      Starting at
                      <strong>{dollars(f.from)}</strong>
                    </p>
                    <p className="sp-fmt-line">{f.line}</p>
                    <ul className="sp-tier-list" style={{ marginTop: "1.2rem", flex: 1 }}>
                      {f.includes.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                    {/* every pack asks for the same thing, so nobody has to
                        scroll back to the hero to act on the one they picked.
                        A plain #quote: a fragment with a query on it matches no
                        element id and would scroll nowhere at all. */}
                    <a
                      href="#quote"
                      className="sp-btn sp-btn--ghost sp-fmt-cta"
                    >
                      {cta.requestQuote.label}
                    </a>
                  </div>
                </article>
              );
            })}
          </div>

          {/* the biggest thing we sell, so it gets a band rather than a fourth
              column that made it read as an afterthought */}
          {series && (
            <article className="sp-fmt-wide">
              <div>
                <span className="sp-eyebrow">The full programme</span>
                <h3 className="sp-display sp-h2" style={{ marginTop: "0.8rem" }}>
                  {series.name}
                </h3>
                <p className="sp-fmt-price" style={{ borderTop: 0, paddingTop: 0 }}>
                  Starting at
                  <strong>{dollars(series.from)}</strong>
                </p>
                <p className="sp-muted" style={{ marginTop: "0.9rem", maxWidth: "34rem" }}>
                  {series.line}
                </p>
                <ul className="sp-tier-list" style={{ marginTop: "1.3rem" }}>
                  {series.includes.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
                <a
                  href="#quote"
                  className="sp-btn sp-btn--primary"
                  style={{ marginTop: "1.6rem" }}
                >
                  {cta.requestQuote.label}
                </a>
              </div>
              <SpVideo
                src={(MEDIA[series.mediaKey] ?? {}).src ?? null}
                poster={(MEDIA[series.mediaKey] ?? {}).poster ?? null}
                label={series.name}
                placeholder={series.name}
              />
            </article>
          )}
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
        <div className="sp-wrap">
          <SectionHead
            eyebrow={c.craft.chip}
            title={c.craft.headline}
            accent={c.craft.accent}
            sub={c.craft.intro}
          />
          {/* a sequence, at size. These three are the argument the page is
              making about craft, and three small cards in a row said them in
              a whisper. */}
          <div className="sp-craft">
            {c.craft.items.map((i, n) => (
              <div key={i.title} className="sp-craft-row">
                <span className="sp-craft-n" aria-hidden="true">
                  {String(n + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="sp-craft-title">{i.title}</h3>
                  <p className="sp-craft-line">{i.line}</p>
                </div>
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
        <div className="sp-wrap">
          {/* deliberately not the shape of the section above it: a claim on
              one side, the three things backing it on the other, so two
              "here are three qualities" moments do not read as one template
              printed twice */}
          <div className="sp-caps">
            <div>
              <span className="sp-eyebrow">{c.difference.chip}</span>
              <h2 className="sp-display sp-h2" style={{ marginTop: "0.7rem" }}>
                {c.difference.headline}{" "}
                <span className="sp-grad-text">{c.difference.accent}</span>
              </h2>
              <p className="sp-muted" style={{ marginTop: "1.1rem" }}>
                {c.difference.intro}
              </p>
              <p className="sp-muted" style={{ marginTop: "1.1rem" }}>
                Every video on this page was made by the same in-house team, for
                brands selling the same platform you sell.
              </p>
            </div>
            <div className="sp-caps-list">
              {c.capabilities.map((x) => (
                <div key={x.title} className="sp-caps-item">
                  <h3 className="sp-caps-title">{x.title}</h3>
                  <p className="sp-caps-line">{x.line}</p>
                </div>
              ))}
            </div>
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
