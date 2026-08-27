import {
  clients,
  cta,
  deliveryWindow,
  featuredTestimonial,
  premadePacks,
  rating,
  recentDeliveries,
  skuFor,
  studioSince,
  whiteLabelProof,
} from "@/lib/site";
import { salesShared } from "@/lib/sales/pages";
import { SpVideo } from "@/components/sales/SpVideo";
import { SectionHead } from "@/components/sales/SectionHead";

/*
 * The AI First SaaS Pack, on its own page.
 *
 * The first version was a centred headline, a centred section head, a grid of
 * cards, and then that same shape five more times. It read as a template
 * because it was one, and it left the three most persuasive things we own
 * unused: the before and after that proves the white-labelling, a HighLevel
 * product director on camera, and real client deliveries. A page selling a
 * white-label pack that never shows a video being white-labelled is not
 * making its own argument.
 *
 * The order here IS the argument, not a list of sections:
 *
 *   1. the offer beside the work, so price and proof arrive together
 *   2. why NINE, the only reason to buy a pack instead of a video
 *   3. the same video branded, which is the claim being demonstrated
 *   4. what the nine actually are
 *   5. somebody from inside HighLevel saying we are good
 *   6. other companies' names on our work
 *   7. the offer again, as a decision rather than a heading
 *   8. how it works, the questions, the close
 *
 * Every fact comes from the catalogue, so repricing the pack in lib/site.ts
 * reprices this page and checkout together and a renamed video is renamed
 * here. This page cannot advertise last month's offer.
 */

const PACK_SLUG = "ai-first-saas-pack";
const money = (n: number) => `$${n.toLocaleString("en-US")}`;

/* Where each format sits in the buyer's funnel. This is the argument for
   taking nine rather than one, so it is written per format instead of being
   another restatement of what the videos are called. */
const PLACEMENT: Record<string, { where: string; job: string }> = {
  "Master Explainer": {
    where: "Homepage and sales page",
    job: "The video that sells the whole platform before anybody books a call.",
  },
  "Feature Explainers": {
    where: "Ads, socials, feature pages",
    job: "One per capability, so every ad and every feature section has its own video instead of sharing one.",
  },
  "Platform Demo": {
    where: "Before the demo call",
    job: "The walkthrough, so the call starts with somebody who has already watched the product work.",
  },
};

export function PackLanding() {
  const pack = premadePacks.find((p) => p.slug === PACK_SLUG);
  /* price is nullable on the catalogue type, and this page is one long
     argument about a number. Without it there is no page to render. */
  if (!pack || pack.price == null || pack.anchorPrice == null) return null;
  const price = pack.price;
  const anchor = pack.anchorPrice;

  const sku = skuFor(pack.slug);
  /* counted from the videos rather than read off `count`, which can drift
     from what is actually in the array */
  const total = pack.categories.reduce((n, c) => n + c.videos.length, 0);
  const master = pack.categories[0]?.videos[0] ?? null;
  const save = Math.round((1 - price / anchor) * 100);
  const each = Math.round(price / total);

  return (
    <>
      {/* ========================================= 1. the offer, beside the work */}
      <header className="sp-section" style={{ position: "relative", overflow: "hidden" }}>
        <div className="sp-glow" />
        <div className="sp-wrap" style={{ position: "relative" }}>
          <div className="sp-hero-split">
            <div>
              <span className="sp-eyebrow">
                The HighLevel-only video studio, since {studioSince}
              </span>
              <h1
                className="sp-display sp-h1"
                style={{ marginTop: "1rem", fontSize: "clamp(2.05rem, 4.8vw, 3.3rem)" }}
              >
                Your whole funnel, <span className="sp-grad-text">in {total} videos.</span>
              </h1>

              {/* the discount reads before the price, which is the order
                  somebody scanning actually takes it in */}
              <div className="sp-offer" style={{ marginTop: "1.4rem" }}>
                <span className="sp-offer-tag">{save}% OFF</span>
                <span>the whole {total} video set</span>
              </div>

              <p className="sp-lede" style={{ marginTop: "1.3rem", maxWidth: "36rem" }}>
                {total} AI-first HighLevel videos, white-labeled to your SaaS. A homepage
                explainer, one video per capability for your ads, and a demo that runs
                before the call. Written brand-agnostic, so nothing in them names anybody
                but you.
              </p>

              <p style={{ marginTop: "1.6rem" }}>
                <span className="sp-price" style={{ fontSize: "2.6rem" }}>
                  {money(price)}
                </span>
                <span className="sp-strike" style={{ marginLeft: "0.7rem" }}>
                  {money(anchor)}
                </span>
                <span className="sp-muted" style={{ display: "block", marginTop: "0.3rem" }}>
                  {money(each)} a video, delivered in {deliveryWindow}.
                </span>
              </p>

              <div className="sp-hero-actions" style={{ marginTop: "1.9rem" }}>
                <a href={`/checkout/${sku}/`} className="sp-btn sp-btn--primary">
                  {cta.orderPremade}
                </a>
                <a href="#proof" className="sp-btn sp-btn--ghost">
                  See it branded
                </a>
              </div>

              <div
                className="sp-trust"
                style={{ justifyContent: "flex-start", marginTop: "1.9rem" }}
              >
                <span className="sp-trust-item">
                  <span className="sp-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span> {rating} on
                  Google
                </span>
                <span className="sp-trust-item">
                  <span className="sp-trust-num">{clients}+</span> HighLevel clients
                </span>
              </div>
            </div>

            {/* video is the product, so it sits beside the price rather than
                a scroll below it */}
            {master ? (
              <SpVideo
                src={master.src}
                poster={master.poster}
                label="the master explainer"
                placeholder="The master explainer"
              />
            ) : null}
          </div>
        </div>
      </header>

      {/* ==================================================== 2. why a set */}
      <section className="sp-section sp-section--band">
        <div className="sp-wrap">
          <SectionHead
            eyebrow="Why a set"
            title="One video sells one thing."
            accent="A funnel needs more."
            sub="These are not nine versions of the same video. Each format sits somewhere different in your funnel and does a different job, which is the whole reason to take the set."
          />
          <div className="sp-steps" style={{ marginTop: "2.5rem" }}>
            {pack.categories.map((cat, i) => {
              const place = PLACEMENT[cat.name];
              return (
                <div key={cat.name} className="sp-step">
                  <span className="sp-step-n">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="sp-display sp-h4">
                      {cat.videos.length} x {cat.name}
                    </p>
                    <p className="sp-eyebrow" style={{ marginTop: "0.5rem" }}>
                      {place?.where ?? "In your funnel"}
                    </p>
                    <p className="sp-muted" style={{ marginTop: "0.4rem" }}>
                      {place?.job ?? cat.line}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================== 3. the claim, demonstrated */}
      <section id="proof" className="sp-section" style={{ scrollMarginTop: "4rem" }}>
        <div className="sp-wrap">
          <SectionHead
            eyebrow="White-label"
            title="The same video,"
            accent="wearing your brand."
            sub="On the left, the cut as we write it. On the right, that same video delivered to a real SaaS: their logo, their dashboard, their colors, their voiceover. Every video in this pack becomes that."
            center
          />
          <div className="sp-ba" style={{ marginTop: "2.5rem" }}>
            <div>
              <div className="sp-ba-label sp-muted">
                <span className="sp-ba-dot" /> Brand-agnostic cut
              </div>
              <SpVideo
                src={whiteLabelProof.generic}
                poster={whiteLabelProof.poster}
                label="original cut"
                placeholder="Original coming"
              />
            </div>
            <div>
              <div className="sp-ba-label" style={{ color: "var(--sp-gold)" }}>
                <span className="sp-ba-dot sp-ba-dot--on" /> Delivered to a client
              </div>
              <SpVideo
                src={whiteLabelProof.branded}
                poster={whiteLabelProof.poster}
                label="branded cut"
                placeholder="Branded coming"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ================================================ 4. what the nine are */}
      <section
        id="whats-inside"
        className="sp-section sp-section--band"
        style={{ scrollMarginTop: "4rem" }}
      >
        <div className="sp-wrap">
          <SectionHead
            eyebrow="What is inside"
            title={`All ${total} videos,`}
            accent="every one included."
            sub="Preview any of them. Nothing here is a mockup or a coming soon: every video in this pack is finished and ships the week you order."
          />
          {pack.categories.map((cat, i) => (
            <div
              key={cat.name}
              style={
                i > 0
                  ? {
                      marginTop: "3rem",
                      paddingTop: "2.5rem",
                      borderTop: "1px solid var(--sp-line)",
                    }
                  : { marginTop: "2.5rem" }
              }
            >
              <div className="sp-vtype-head">
                <div style={{ maxWidth: "46rem" }}>
                  <span className="sp-eyebrow">{PLACEMENT[cat.name]?.where ?? cat.name}</span>
                  <h3 className="sp-display sp-h3" style={{ marginTop: "0.5rem" }}>
                    {cat.name}
                  </h3>
                </div>
                <span className="sp-vtype-count">
                  {cat.videos.length} {cat.videos.length === 1 ? "video" : "videos"}
                </span>
              </div>
              <div className="sp-grid-cards" style={{ marginTop: "1.5rem" }}>
                {cat.videos.map((v) => (
                  <figure key={v.title} className="sp-card sp-card--hover" style={{ margin: 0 }}>
                    <SpVideo
                      src={v.src}
                      poster={v.poster}
                      label={v.capability}
                      placeholder={v.title}
                    />
                    <figcaption style={{ padding: "1rem 1.15rem" }}>
                      <p style={{ fontWeight: 600 }}>{v.title}</p>
                      <p className="sp-muted" style={{ fontSize: "0.9rem", marginTop: "0.2rem" }}>
                        {v.capability}
                      </p>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ==================================================== 5. the authority */}
      <section className="sp-section">
        <div className="sp-wrap">
          <div className="sp-hero-split">
            <div>
              <span className="sp-badge">{featuredTestimonial.marker}</span>
              <p className="sp-display sp-h2" style={{ marginTop: "1.2rem", lineHeight: 1.15 }}>
                &ldquo;{featuredTestimonial.pull}&rdquo;
              </p>
              <p className="sp-muted" style={{ marginTop: "1.2rem", maxWidth: "34rem" }}>
                {featuredTestimonial.quote}
              </p>
              <p style={{ marginTop: "1.4rem", fontWeight: 600 }}>{featuredTestimonial.name}</p>
              <p className="sp-muted" style={{ fontSize: "0.9rem" }}>
                {featuredTestimonial.role}
              </p>
            </div>
            <SpVideo
              src={featuredTestimonial.src}
              poster={featuredTestimonial.poster}
              label={featuredTestimonial.name}
              placeholder={featuredTestimonial.name}
            />
          </div>
        </div>
      </section>

      {/* ============================================= 6. under their own names */}
      <section className="sp-section sp-section--band">
        <div className="sp-wrap">
          <SectionHead
            eyebrow="Recent work"
            title="Delivered and running,"
            accent="under their names."
            sub="A slice of recent deliveries. Every frame is white-labeled: their logo, their dashboard, their voiceover."
          />
          <div className="sp-grid-cards" style={{ marginTop: "2.5rem" }}>
            {recentDeliveries.slice(0, 3).map((c) => (
              <figure key={c.src} className="sp-card sp-card--hover" style={{ margin: 0 }}>
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

      {/* =============================================== 7. the decision itself */}
      <section
        id="offer"
        className="sp-section sp-section--offer"
        style={{ scrollMarginTop: "4rem" }}
      >
        <div className="sp-wrap" style={{ maxWidth: "44rem" }}>
          <SectionHead
            eyebrow="The offer"
            title="The whole set,"
            accent={`for ${money(price)}.`}
            center
          />
          {/* one card, so the decision has somewhere to happen instead of
              being a heading with cards loose underneath it */}
          <div className="sp-card" style={{ marginTop: "2.5rem", padding: "2rem 1.75rem" }}>
            <p style={{ textAlign: "center" }}>
              <span className="sp-price" style={{ fontSize: "3rem" }}>
                {money(price)}
              </span>
              <span className="sp-strike" style={{ marginLeft: "0.7rem" }}>
                {money(anchor)}
              </span>
            </p>
            <p className="sp-muted" style={{ textAlign: "center", marginTop: "0.35rem" }}>
              {money(each)} a video. One payment, no plan, no call.
            </p>
            <div className="sp-guarantees" style={{ marginTop: "1.8rem" }}>
              {salesShared.guarantees.map((g) => (
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
            <div style={{ display: "flex", justifyContent: "center", marginTop: "1.9rem" }}>
              <a href={`/checkout/${sku}/`} className="sp-btn sp-btn--primary sp-btn--wide">
                {cta.orderPremade}
              </a>
            </div>
            <p
              className="sp-muted"
              style={{ textAlign: "center", marginTop: "0.9rem", fontSize: "0.9rem" }}
            >
              Send your brand kit at checkout. Delivered in {deliveryWindow}.
            </p>
          </div>
        </div>
      </section>

      {/* ================================================ 8. how, questions, close */}
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
                <div>
                  <p className="sp-display sp-h4">{s.title}</p>
                  <p className="sp-muted" style={{ marginTop: "0.4rem" }}>
                    {s.line}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sp-section sp-section--band">
        <div className="sp-wrap" style={{ maxWidth: "48rem" }}>
          <SectionHead
            eyebrow="Before you order"
            title="The questions"
            accent="that come up."
            center
          />
          <div style={{ marginTop: "2.5rem" }}>
            {salesShared.faq.slice(0, 5).map((f) => (
              <details key={f.q} className="sp-faq">
                <summary className="sp-faq-q">{f.q}</summary>
                <p className="sp-muted" style={{ marginTop: "0.6rem" }}>
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="sp-section" style={{ position: "relative", overflow: "hidden" }}>
        <div className="sp-glow" />
        <div className="sp-wrap" style={{ position: "relative", textAlign: "center" }}>
          <h2 className="sp-display sp-h2">
            {total} videos, {money(price)},{" "}
            <span className="sp-grad-text">live this week.</span>
          </h2>
          <p className="sp-lede" style={{ margin: "1.1rem auto 0", maxWidth: "40rem" }}>
            Send your brand kit today and publish in {deliveryWindow}.
          </p>
          <div className="sp-hero-actions" style={{ justifyContent: "center", marginTop: "2rem" }}>
            <a href={`/checkout/${sku}/`} className="sp-btn sp-btn--primary">
              {cta.orderPremade}
            </a>
            <a href={cta.bookACall.href} className="sp-btn sp-btn--ghost">
              {cta.bookACall.label}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
