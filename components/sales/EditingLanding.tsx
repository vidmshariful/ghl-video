import { SpVideo } from "@/components/sales/SpVideo";
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
  rating,
  studioSince,
  trustLogos,
} from "@/lib/site";

/*
 * The editing landing page.
 *
 * One page that sells the editing plans and nothing else, for paid traffic and
 * for the link we send when somebody replies to a cold email. Ten sections in
 * the order approved on 25 August 2026, each with one job: the work is on
 * screen by the third for the cold click, the price by the fifth for the warm
 * reply.
 *
 * Every word is in lib/content/editing-lp.ts. Every price and plan comes from
 * lib/site.ts and every credit cost from lib/editing-credits.ts, so the page
 * cannot quote a number checkout will not charge. Rendered inside the (sales)
 * layout, so the .sp system is in scope and there is no nav to leave by.
 */

const dollars = (n: number) => `$${n.toLocaleString("en-US")}`;
const lp = editingLp;

/* the cheapest plan, for the hero's price anchor */
const from = Math.min(...editingPlans.map((p) => p.price));

export function EditingLanding() {
  return (
    <>
      <JsonLd
        schema={[
          serviceSchema({
            name: "HighLevel video editing plans",
            description: lp.hero.lede,
            path: "/lp/video-editing/",
            /* the real plan range, read off the catalog rather than typed */
            offers: {
              lowPrice: from,
              highPrice: Math.max(...editingPlans.map((p) => p.price)),
              count: editingPlans.length,
            },
          }),
          faqSchema(lp.faq.items.map((f) => ({ q: f.q, a: f.a }))),
        ]}
      />

      {/* ---------------------------------------------- 01. hero */}
      <section className="sp-section">
        <div className="sp-glow" />
        <div className="sp-wrap sp-hero-split">
          <div>
            <p className="sp-eyebrow">{lp.hero.eyebrow}</p>
            <h1 className="sp-display sp-h1">
              {lp.hero.headline}{" "}
              <span className="sp-grad-text">{lp.hero.accent}</span>
            </h1>
            <p className="sp-lede">{lp.hero.lede}</p>

            <div className="sp-hero-actions">
              <a href={lp.hero.cta.href} className="sp-btn sp-btn--primary">
                {lp.hero.cta.label}
              </a>
              <a href={lp.hero.secondary.href} className="sp-btn sp-btn--ghost">
                {lp.hero.secondary.label}
              </a>
              <span className="sp-from">
                {lp.hero.priceNote} <b>{dollars(from)}</b> a month
              </span>
            </div>
          </div>

          <div>
            <SpVideo
              src={lp.hero.videoSrc}
              poster={lp.hero.videoPoster}
              label="What we cut"
              placeholder="Showreel coming"
            />
          </div>
        </div>

        {/* trust, on the same screen as the headline */}
        <div className="sp-wrap">
          <div className="sp-trust">
            <span className="sp-trust-item">
              <span className="sp-trust-num">{clients}+</span> clients
            </span>
            <span className="sp-trust-item">
              <span className="sp-trust-num">{rating}</span>
              <span className="sp-stars" aria-hidden="true">
                {"★★★★★"}
              </span>
              every review five stars
            </span>
            <span className="sp-trust-item">
              Creating HighLevel videos since <span className="sp-trust-num">{studioSince}</span>
            </span>
          </div>
          <div className="sp-logos" aria-label="Clients we make videos for">
            {trustLogos.slice(0, 14).map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="" className="sp-logo" loading="lazy" />
            ))}
          </div>
        </div>
      </section>

      <div className="sp-hr" />

      {/* ---------------------------------------------- 02. the bottleneck */}
      <section className="sp-section sp-section--tight">
        <div className="sp-wrap sp-narrow">
          <p className="sp-eyebrow">{lp.bottleneck.eyebrow}</p>
          <h2 className="sp-display sp-h2">
            {lp.bottleneck.headline}{" "}
            <span className="sp-grad-text">{lp.bottleneck.accent}</span>
          </h2>
          <p className="sp-lede">{lp.bottleneck.body}</p>
          <ul className="sp-plainlist">
            {lp.bottleneck.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      </section>

      <div className="sp-hr" />

      {/* ---------------------------------------------- 03. the work */}
      <section className="sp-section">
        <div className="sp-wrap">
          <p className="sp-eyebrow">{lp.work.eyebrow}</p>
          <h2 className="sp-display sp-h2">
            {lp.work.headline} <span className="sp-grad-text">{lp.work.accent}</span>
          </h2>
          <p className="sp-lede">{lp.work.intro}</p>

          <div className="sp-samples">
            {lp.work.samples.map((s) => (
              <figure key={s.label} className="sp-sample">
                <SpVideo src={s.src} poster={s.poster} label={s.label} />
                <figcaption>
                  <span className="sp-sample-label">{s.label}</span>
                  <span className="sp-sample-sub">{s.sub}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <div className="sp-hr" />

      {/* ---------------------------------------------- 04. how it works */}
      <section className="sp-section">
        <div className="sp-wrap">
          <p className="sp-eyebrow">{lp.how.eyebrow}</p>
          <h2 className="sp-display sp-h2">
            {lp.how.headline} <span className="sp-grad-text">{lp.how.accent}</span>
          </h2>

          <div className="sp-steps">
            {lp.how.steps.map((s) => (
              <div key={s.n} className="sp-step">
                <span className="sp-step-n">{s.n}</span>
                <h3 className="sp-display sp-h3">{s.title}</h3>
                <p className="sp-muted">{s.line}</p>
              </div>
            ))}
          </div>

          <p className="sp-promise">{lp.how.promise}</p>
        </div>
      </section>

      <div className="sp-hr" />

      {/* ---------------------------------------------- 05. the plans */}
      <section className="sp-section" id="plans">
        <div className="sp-wrap">
          <p className="sp-eyebrow">{lp.plans.eyebrow}</p>
          <h2 className="sp-display sp-h2">
            {lp.plans.headline} <span className="sp-grad-text">{lp.plans.accent}</span>
          </h2>
          <p className="sp-lede">{lp.plans.intro}</p>

          <div className="sp-tiers sp-tiers--three">
            {editingPlans.map((p) => (
              <div
                key={p.sku}
                className={`sp-tier${p.featured ? " sp-tier--featured" : ""}`}
              >
                {p.featured && <span className="sp-tier-badge">Most picked</span>}
                <h3 className="sp-display sp-h3">{p.name}</h3>
                <p className="sp-muted">{p.blurb}</p>
                <p className="sp-price">
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

          {/* the objections, answered once under all three */}
          <div className="sp-assure">
            {lp.plans.includes.map((g) => (
              <div key={g.title} className="sp-assure-item">
                <h3>{g.title}</h3>
                <p>{g.line}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="sp-hr" />

      {/* ---------------------------------------------- 06. credits */}
      <section className="sp-section sp-section--tight">
        <div className="sp-wrap">
          <p className="sp-eyebrow">{lp.credits.eyebrow}</p>
          <h2 className="sp-display sp-h2">
            {lp.credits.headline}{" "}
            <span className="sp-grad-text">{lp.credits.accent}</span>
          </h2>
          <p className="sp-lede">{lp.credits.intro}</p>

          <div className="sp-rates">
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

          <p className="sp-muted sp-rates-note">{lp.credits.note}</p>
        </div>
      </section>

      <div className="sp-hr" />

      {/* ---------------------------------------------- 07. who it is for */}
      <section className="sp-section">
        <div className="sp-wrap">
          <p className="sp-eyebrow">{lp.fit.eyebrow}</p>
          <h2 className="sp-display sp-h2">
            {lp.fit.headline} <span className="sp-grad-text">{lp.fit.accent}</span>
          </h2>

          <div className="sp-fit">
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

      <div className="sp-hr" />

      {/* ---------------------------------------------- 08. proof */}
      <section className="sp-section">
        <div className="sp-wrap">
          <p className="sp-eyebrow">{lp.proof.eyebrow}</p>
          <h2 className="sp-display sp-h2">
            {lp.proof.headline} <span className="sp-grad-text">{lp.proof.accent}</span>
          </h2>

          <div className="sp-people">
            {lp.proof.clients.map((c) => (
              <div key={c.name} className="sp-card sp-person">
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
                  <p className="sp-person-quote">{c.quote}</p>
                ) : (
                  <p className="sp-person-quote sp-person-quote--pending">{lp.proof.pending}</p>
                )}
              </div>
            ))}
          </div>

          {/* authority, given its own weight: he is HighLevel staff, not a
              customer, so it is a different kind of proof to the cards above */}
          <div className="sp-featured">
            <div>
              <SpVideo
                src={featuredTestimonial.src}
                poster={featuredTestimonial.poster}
                label={`${featuredTestimonial.name} testimonial`}
              />
            </div>
            <div>
              <p className="sp-eyebrow">{featuredTestimonial.marker}</p>
              <p className="sp-pull">{featuredTestimonial.pull}</p>
              <p className="sp-muted">{featuredTestimonial.quote}</p>
              <p className="sp-attrib">
                <b>{featuredTestimonial.name}</b>
                <span>{featuredTestimonial.role}</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="sp-hr" />

      {/* ---------------------------------------------- 09. faq */}
      <section className="sp-section sp-section--tight">
        <div className="sp-wrap sp-narrow">
          <p className="sp-eyebrow">{lp.faq.eyebrow}</p>
          <h2 className="sp-display sp-h2">
            {lp.faq.headline} <span className="sp-grad-text">{lp.faq.accent}</span>
          </h2>

          <div className="sp-faq">
            {lp.faq.items.map((f) => (
              <details key={f.q} className="sp-faq-item">
                <summary className="sp-faq-q">{f.q}</summary>
                <p className="sp-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------- 10. close */}
      <section className="sp-section">
        <div className="sp-glow" />
        <div className="sp-wrap sp-narrow sp-close">
          <h2 className="sp-display sp-h2">
            {lp.closing.headline}{" "}
            <span className="sp-grad-text">{lp.closing.accent}</span>
          </h2>
          <p className="sp-lede">{lp.closing.sub}</p>
          <div className="sp-hero-actions">
            <a href="#plans" className="sp-btn sp-btn--primary">
              {cta.startEditing}
            </a>
            <a href={cta.bookACall.href} className="sp-btn sp-btn--ghost">
              {cta.bookACall.label}
            </a>
          </div>
        </div>
      </section>

      <footer className="sp-footer">
        <div className="sp-wrap">
          <p>{entityLine}</p>
          <p>{disclaimer}</p>
        </div>
      </footer>
    </>
  );
}
