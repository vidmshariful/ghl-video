import {
  clients,
  cta,
  deliveryWindow,
  premadePacks,
  rating,
  skuFor,
  studioSince,
} from "@/lib/site";
import { salesShared } from "@/lib/sales/pages";
import { SpVideo } from "@/components/sales/SpVideo";
import { SectionHead } from "@/components/sales/SectionHead";

/*
 * The AI First SaaS Pack, on its own page.
 *
 * The other premade landing page shows the whole library and lets somebody
 * pick. This one sells one thing, so it is built the other way round: what
 * is in the pack, what it costs against buying the same nine singly, and one
 * button. A page that sells one product should not open by offering a
 * catalogue.
 *
 * Everything factual comes from the catalogue: the price, the anchor, the
 * nine titles, their posters and their clips. Nothing here is typed twice,
 * so repricing the pack in lib/site.ts reprices this page and checkout at
 * the same time, and a video renamed in the catalogue is renamed here.
 */

const PACK_SLUG = "ai-first-saas-pack";
const money = (n: number) => `$${n.toLocaleString("en-US")}`;

export function PackLanding() {
  const pack = premadePacks.find((p) => p.slug === PACK_SLUG);
  /* the catalogue gate in the build would have caught this long before a
     visitor did, but rendering nothing beats rendering a page about a pack
     that no longer exists */
  /* price is nullable on the catalogue type, and this page is one long
     argument about a number. Without it there is no page to render. */
  if (!pack || pack.price == null || pack.anchorPrice == null) return null;
  const price = pack.price;
  const anchor = pack.anchorPrice;
  /* count is nullable on the type; the videos themselves are the truth
     anyway, so count them rather than trusting a field that can drift */
  const total = pack.categories.reduce((n, c) => n + c.videos.length, 0);

  const sku = skuFor(pack.slug);
  const videos = pack.categories.flatMap((c) => c.videos);
  const master = videos[0] ?? null;
  const save = Math.round((1 - price / anchor) * 100);
  const each = Math.round(price / total);

  return (
    <>
      {/* ---------------------------------------------------------- hero */}
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
          <span className="sp-eyebrow">
            The HighLevel-only video studio, since {studioSince}
          </span>
          <h1
            className="sp-display sp-h1"
            style={{ marginTop: "1.1rem", fontSize: "clamp(2.2rem, 5.8vw, 3.6rem)" }}
          >
            Nine AI-first videos for your SaaS,
            <span className="sp-grad-text" style={{ display: "block" }}>
              branded and ready to publish.
            </span>
          </h1>
          <p className="sp-lede" style={{ margin: "1.35rem auto 0", maxWidth: "50rem", textWrap: "normal" }}>
            {pack.tagline}
          </p>

          {/* the price belongs in the hero on a page that sells one thing */}
          <p style={{ marginTop: "1.6rem" }}>
            <span className="sp-price" style={{ fontSize: "2.6rem" }}>
              {money(price)}
            </span>
            <span className="sp-strike" style={{ marginLeft: "0.7rem" }}>
              {money(anchor)}
            </span>
          </p>
          <p className="sp-muted" style={{ marginTop: "0.35rem" }}>
            All {total} videos, white-labeled. That is {money(each)} a video, and{" "}
            {save}% off buying them one at a time.
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
            <a href={`/checkout/${sku}/`} className="sp-btn sp-btn--primary">
              {cta.orderPremade}
            </a>
            <a href="#whats-inside" className="sp-btn sp-btn--ghost">
              See all {total} videos
            </a>
          </div>
        </div>

        {master ? (
          <div
            className="sp-wrap"
            style={{ position: "relative", marginTop: "clamp(2.5rem, 5vw, 3.5rem)", maxWidth: "980px" }}
          >
            <SpVideo
              src={master.src}
              poster={master.poster}
              label="the master explainer, start to finish"
              placeholder="The master explainer"
            />
          </div>
        ) : null}
      </header>

      {/* --------------------------------------------------------- trust */}
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
            <span className="sp-trust-num">Full</span> commercial rights
          </span>
        </div>
      </section>

      {/* ------------------------------------------------- what is inside */}
      <section id="whats-inside" className="sp-section" style={{ scrollMarginTop: "4rem" }}>
        <div className="sp-wrap">
          <SectionHead
            eyebrow="What is inside"
            title="Nine videos,"
            accent="three jobs."
            sub="One master explainer to sell the platform, seven feature explainers to sell the parts, and a demo that does the walkthrough before your call. Preview any of them."
            center
          />
          {pack.categories.map((cat, i) => (
            <div
              key={cat.name}
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
                    {cat.line}
                  </p>
                </div>
                <span className="sp-vtype-count">
                  {cat.videos.length} {cat.videos.length === 1 ? "video" : "videos"}
                </span>
              </div>
              <div className="sp-grid-cards" style={{ marginTop: "1.75rem" }}>
                {cat.videos.map((v) => (
                  <div key={v.title} className="sp-card">
                    <SpVideo src={v.src} poster={v.poster} label={v.capability} placeholder={v.title} />
                    <div style={{ padding: "1rem 1.1rem 1.2rem" }}>
                      <p className="sp-display sp-h4" style={{ lineHeight: 1.25 }}>
                        {v.title}
                      </p>
                      <p className="sp-muted" style={{ marginTop: "0.35rem", fontSize: "0.85rem" }}>
                        {v.format}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------- the offer */}
      <section id="offer" className="sp-section sp-section--offer" style={{ scrollMarginTop: "4rem" }}>
        <div className="sp-wrap">
          <SectionHead
            eyebrow="The offer"
            title="The whole set,"
            accent={`for ${money(price)}.`}
            sub={`Bought one at a time these come to ${money(anchor)}. Taken together they are ${money(price)}, which is ${money(each)} a video.`}
            center
          />
          {/* the same guarantee list the other sales pages use, with its own
              layout: four of these as plain cards left an orphan on the
              second row and read as filler rather than reassurance */}
          <div className="sp-guarantees" style={{ marginTop: "2.5rem" }}>
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
          <div style={{ display: "flex", justifyContent: "center", marginTop: "2.5rem" }}>
            {/* not sp-btn--wide: that modifier is for filling a bundle card,
                and in a full-width wrap it becomes a gradient bar the width
                of the page */}
            <a href={`/checkout/${sku}/`} className="sp-btn sp-btn--primary">
              {cta.orderPremade}
            </a>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------- who it is for */}
      <section className="sp-section">
        <div className="sp-wrap">
          <SectionHead
            eyebrow="Fit"
            title="Worth saying"
            accent="who this is for."
            sub="HighLevel SaaS resellers. People selling the platform under their own brand: agencies, SaaS founders, and the coaches and affiliates who sell alongside them."
          />
          <div className="sp-grid-cards" style={{ marginTop: "2.5rem" }}>
            {[
              {
                t: "You resell HighLevel as your own SaaS",
                l: "Every video is white-labeled to your brand. Nothing in them names us, and nothing names a competitor.",
              },
              {
                t: "You need a full funnel, not one video",
                l: "A homepage explainer, seven feature videos for ads and landing pages, and a demo for the pre-call. That is a funnel, in one order.",
              },
              {
                t: "AI is your positioning",
                l: "Every script is written AI-first, because that is what your prospects are being sold on this year.",
              },
              {
                t: "You want it live this week",
                l: `Send your brand kit and the set lands in ${deliveryWindow}, after a full review round.`,
              },
            ].map((x) => (
              <div key={x.t} className="sp-card" style={{ padding: "1.4rem 1.5rem" }}>
                <p className="sp-display sp-h4">{x.t}</p>
                <p className="sp-muted" style={{ marginTop: "0.45rem" }}>
                  {x.l}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- how it works */}
      <section className="sp-section sp-section--band">
        <div className="sp-wrap">
          <SectionHead
            eyebrow="How it works"
            title={salesShared.howItWorks.heading}
            accent={salesShared.howItWorks.accent}
            center
          />
          <div className="sp-grid-cards" style={{ marginTop: "2.5rem" }}>
            {salesShared.howItWorks.steps.map((s) => (
              <div key={s.n} className="sp-card" style={{ padding: "1.4rem 1.5rem" }}>
                <span className="sp-eyebrow">{s.n}</span>
                <p className="sp-display sp-h4" style={{ marginTop: "0.5rem" }}>
                  {s.title}
                </p>
                <p className="sp-muted" style={{ marginTop: "0.45rem" }}>
                  {s.line}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ faq */}
      <section className="sp-section">
        <div className="sp-wrap" style={{ maxWidth: "48rem" }}>
          <SectionHead eyebrow="Before you order" title="The questions" accent="that come up." center />
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

      {/* ---------------------------------------------------------- close */}
      <section className="sp-section" style={{ position: "relative", overflow: "hidden" }}>
        <div className="sp-glow" />
        <div className="sp-wrap" style={{ position: "relative", textAlign: "center" }}>
          <h2 className="sp-display sp-h2">
            Your whole funnel,{" "}
            <span className="sp-grad-text">branded and live this week.</span>
          </h2>
          <p className="sp-lede" style={{ margin: "1.1rem auto 0", maxWidth: "42rem" }}>
            {total} videos for {money(price)}. Send your brand kit today and publish in{" "}
            {deliveryWindow}.
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
