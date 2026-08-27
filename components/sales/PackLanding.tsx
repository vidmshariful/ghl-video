import {
  clients,
  cta,
  deliveryWindow,
  featuredTestimonial,
  premadePacks,
  premadeVideos,
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
 * Three things this page has to do, in this order, and the order is the
 * whole design:
 *
 *   SHOW the videos. Somebody arrives to watch, not to read. The shelf is
 *   the point, so it comes before every argument about it, exactly as the
 *   white-label page does. The before and after used to sit above the
 *   library here, which is a proof of a claim nobody had seen yet.
 *
 *   Let them buy ONE. Every video in this pack is separately sellable at its
 *   own price, so each card carries that price and its own checkout link. A
 *   page that only sells the set turns somebody who wanted the demo into
 *   somebody who bought nothing.
 *
 *   Then make the set the obvious call. Nine bought one at a time is the sum
 *   of the individual prices; the set is a fraction of it. That argument only
 *   lands after they have seen the prices on the cards, which is why the
 *   offer sits directly under the shelf.
 *
 * No hero video. Nobody supplied a VSL for this page and the master
 * explainer is already in the shelf below: putting it in the hero as well
 * meant the same video twice on one page, the first time before anybody had
 * been told what they were watching.
 *
 * Every number is read from the catalogue, including the individual prices,
 * so the comparison on this page cannot drift from what checkout charges.
 */

const PACK_SLUG = "ai-first-saas-pack";
const money = (n: number) => `$${n.toLocaleString("en-US")}`;

/*
 * Where each format goes in a reseller's funnel. Only the placement: what
 * each format DOES is the catalogue's own line, which is where the AI story
 * is written, and an earlier version of this file replaced those lines with
 * funnel copy of its own. That is how a page about AI-first videos ended up
 * never mentioning AI. The label is ours, the sentence is the catalogue's.
 */
const PLACEMENT: Record<string, string> = {
  "Master Explainer": "Homepage and sales page",
  "Feature Explainers": "Ads, socials, feature pages",
  "Platform Demo": "Before the demo call",
};

export function PackLanding() {
  const pack = premadePacks.find((p) => p.slug === PACK_SLUG);
  if (!pack || pack.price == null) return null;
  const price = pack.price;
  const sku = skuFor(pack.slug);

  /*
   * Each pack video joined to its catalogue entry, which is where its own
   * slug and its own price live. That join is what makes "buy just this one"
   * possible, and it is done by title because the pack lists what is in it
   * while the catalogue lists what is for sale.
   */
  const shelf = pack.categories.map((cat) => ({
    name: cat.name,
    line: cat.line,
    items: cat.videos.map((v) => {
      const sold = premadeVideos.find((p) => p.title === v.title);
      return {
        title: v.title,
        capability: v.capability,
        src: v.src,
        poster: v.poster,
        price: sold?.price ?? null,
        sku: sold ? skuFor(sold.slug) : null,
      };
    }),
  }));

  const all = shelf.flatMap((c) => c.items);
  const total = all.length;
  /* the sum of what these actually cost one at a time, added up rather than
     asserted, so the number cannot disagree with the prices on the cards */
  const singly = all.reduce((sum, v) => sum + (v.price ?? 0), 0);
  const save = singly > 0 ? Math.round((1 - price / singly) * 100) : 0;
  /* the parts of HighLevel these videos cover, read off the feature
     explainers, which are the ones the catalogue describes as having the AI
     woven through them. Adding a tenth video adds a tenth chip on its own. */
  const aiCovered = (shelf.find((c) => c.name === "Feature Explainers")?.items ?? []).map(
    (v) => v.capability,
  );

  return (
    <>
      {/* ===================================================== hero, no video */}
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
            For agencies and founders white-labeling HighLevel
          </span>
          <h1
            className="sp-display sp-h1"
            style={{ marginTop: "1.1rem", fontSize: "clamp(2.2rem, 5.6vw, 3.5rem)" }}
          >
            {total}{" "}videos on HighLevel&apos;s AI,
            <span className="sp-grad-text" style={{ display: "block" }}>
              branded as your platform.
            </span>
          </h1>
          <p className="sp-lede" style={{ margin: "1.3rem auto 0", maxWidth: "44rem" }}>
            You sell HighLevel as your own SaaS, and AI is what your prospects are
            asking about. Every video here takes one part of the platform and shows
            the AI doing the work inside it, white-labeled to you: your logo, your
            dashboard, your voiceover, and not one mention of HighLevel or of us.
          </p>

          {/* what is in the box, before anybody scrolls */}
          <div
            className="sp-trust"
            style={{ justifyContent: "center", marginTop: "1.8rem" }}
          >
            {shelf.map((c) => (
              <span key={c.name} className="sp-trust-item">
                <span className="sp-trust-num">{c.items.length}</span> {c.name}
              </span>
            ))}
          </div>

          <div className="sp-hero-actions" style={{ justifyContent: "center", marginTop: "2rem" }}>
            <a href="#videos" className="sp-btn sp-btn--primary">
              Watch all {total}
            </a>
            <a href="#pack" className="sp-btn sp-btn--ghost">
              Take the set for {money(price)}
            </a>
          </div>
        </div>
      </header>

      {/* ================================================================ trust */}
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

      {/* ============================ what makes it THIS pack and not another */}
      <section className="sp-section sp-section--band">
        <div className="sp-wrap">
          <SectionHead
            eyebrow="Why AI first"
            title="Not nine videos about HighLevel."
            accent="Nine about the AI inside it."
            sub="Any studio can film a feature tour. What your prospects are actually asking is what the AI does, so that is what every one of these answers: the feature, and then the AI working inside it. That is the whole pack, and it is why it is called what it is."
          />
          {/* the capabilities, taken from the videos themselves rather than
              listed by hand, so this claim cannot outgrow the pack */}
          <ul
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.6rem",
              listStyle: "none",
              padding: 0,
              margin: "2.25rem 0 0",
            }}
          >
            {aiCovered.map((c) => (
              <li key={c} className="sp-badge">
                {c}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ================================== the shelf: watch, then buy one or all */}
      <section id="videos" className="sp-section" style={{ scrollMarginTop: "4rem" }}>
        <div className="sp-wrap">
          <SectionHead
            eyebrow="The pack"
            title="Watch the AI, feature by feature."
            accent="Take one or take all nine."
            sub="Every video below is finished and sold on its own, at the price on its card. Preview any of them, buy just the ones you need, or take the set underneath for less than half."
            center
          />
          {shelf.map((cat, i) => (
            <div
              key={cat.name}
              style={
                i > 0
                  ? {
                      marginTop: "3rem",
                      paddingTop: "2.5rem",
                      borderTop: "1px solid var(--sp-line)",
                    }
                  : { marginTop: "3rem" }
              }
            >
              <div className="sp-vtype-head">
                <div style={{ maxWidth: "46rem" }}>
                  <span className="sp-eyebrow">{PLACEMENT[cat.name] ?? cat.name}</span>
                  <h3 className="sp-display sp-h3" style={{ marginTop: "0.5rem" }}>
                    {cat.name}
                  </h3>
                  {/* the catalogue's own line: this is where the AI in each
                      format is described, so it is quoted, not paraphrased */}
                  <p className="sp-muted" style={{ marginTop: "0.45rem" }}>
                    {cat.line}
                  </p>
                </div>
                <span className="sp-vtype-count">
                  {cat.items.length} {cat.items.length === 1 ? "video" : "videos"}
                </span>
              </div>
              <div className="sp-grid-cards" style={{ marginTop: "1.75rem" }}>
                {cat.items.map((v) => (
                  <figure key={v.title} className="sp-card sp-card--hover" style={{ margin: 0 }}>
                    <SpVideo
                      src={v.src}
                      poster={v.poster}
                      label={v.capability}
                      placeholder={v.title}
                    />
                    <figcaption
                      style={{
                        padding: "1rem 1.15rem 1.2rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.75rem",
                      }}
                    >
                      <div>
                        <p style={{ fontWeight: 600, lineHeight: 1.3 }}>{v.title}</p>
                        <p
                          className="sp-muted"
                          style={{ fontSize: "0.88rem", marginTop: "0.2rem" }}
                        >
                          {v.capability}
                        </p>
                      </div>
                      {v.price != null && v.sku ? (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "0.75rem",
                            marginTop: "auto",
                          }}
                        >
                          <span className="sp-price">{money(v.price)}</span>
                          <a href={`/checkout/${v.sku}/`} className="sp-btn sp-btn--ghost">
                            Order this one
                          </a>
                        </div>
                      ) : null}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================= the set, argued from the prices just shown */}
      <section
        id="pack"
        className="sp-section sp-section--offer"
        style={{ scrollMarginTop: "4rem" }}
      >
        <div className="sp-wrap" style={{ maxWidth: "44rem" }}>
          <SectionHead
            eyebrow="Or take all of them"
            title="Every video above,"
            accent={`for ${money(price)}.`}
            sub={`Bought one at a time the ${total} come to ${money(singly)}. Together they are ${money(price)}.`}
            center
          />
          <div className="sp-card" style={{ marginTop: "2.5rem", padding: "2rem 1.75rem" }}>
            <p style={{ textAlign: "center" }}>
              <span className="sp-price" style={{ fontSize: "3rem" }}>
                {money(price)}
              </span>
              <span className="sp-strike" style={{ marginLeft: "0.7rem" }}>
                {money(singly)}
              </span>
            </p>
            <p className="sp-muted" style={{ textAlign: "center", marginTop: "0.35rem" }}>
              {save}% off. One payment, no plan, no call.
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

      {/* ====================== now the proof, on videos they have already seen */}
      <section className="sp-section">
        <div className="sp-wrap">
          <SectionHead
            eyebrow="White-label"
            title="The same HighLevel video,"
            accent="wearing your brand."
            sub="On the left, the cut as we write it. On the right, that same video delivered to a real SaaS: their logo, their dashboard, their colors, their voiceover. Every video above becomes that."
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

      {/* ================================================ under their own names */}
      <section className="sp-section sp-section--band">
        <div className="sp-wrap">
          <SectionHead
            eyebrow="Recent work"
            title="Running as their platform,"
            accent="not ours."
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

      {/* ====================================================== the authority */}
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

      {/* ========================================================= how it works */}
      <section className="sp-section sp-section--band">
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

      {/* ================================================================= faq */}
      <section className="sp-section">
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

      {/* =============================================================== close */}
      <section className="sp-section" style={{ position: "relative", overflow: "hidden" }}>
        <div className="sp-glow" />
        <div className="sp-wrap" style={{ position: "relative", textAlign: "center" }}>
          <h2 className="sp-display sp-h2">
            HighLevel&apos;s AI, branded as yours,{" "}
            <span className="sp-grad-text">live this week.</span>
          </h2>
          <p className="sp-lede" style={{ margin: "1.1rem auto 0", maxWidth: "40rem" }}>
            Take one at {money(all[0]?.price ?? 0)} or the set at {money(price)}. Send your
            brand kit today and publish in {deliveryWindow}.
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
