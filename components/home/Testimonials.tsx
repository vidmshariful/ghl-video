import { Button } from "@/components/Button";
import { DrawnBorder } from "@/components/DrawnBorder";
import { Reveal, RevealItem } from "@/components/Reveal";
import { ReviewCard } from "@/components/ReviewCard";
import { SectionChip } from "@/components/SectionChip";
import { SectionGlow } from "@/components/SectionGlow";
import { home, cta, rating, googleReviewsUrl } from "@/lib/site";

/*
 * Real Google reviews, verbatim. The feed used to auto-scroll, which
 * meant nobody could actually read the proof. Now it is a static,
 * scannable masonry with a trust bar up top: read at your own pace,
 * every review visible, nothing sliding away.
 */

/* the review figures, and only those: "teams served" is the client
 * wall's line, and it was being said here for the third time */
function TrustBar() {
  const stats = [
    { v: rating, l: "on Google", stars: true },
    { v: "17", l: "5-star reviews" },
  ];
  return (
    <div className="grid grid-cols-2 divide-x divide-hair overflow-hidden rounded-card border border-hair bg-surface">
      {stats.map((s) => (
        <div key={s.l} className="px-4 py-4">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-price font-bold leading-none text-gold [font-variant-numeric:tabular-nums]">
              {s.v}
            </span>
          </div>
          <p className="mt-1.5 font-mono text-label uppercase text-dim">{s.l}</p>
        </div>
      ))}
    </div>
  );
}

export function Testimonials() {
  const { reviews } = home;
  return (
    <section
      data-bp-idx="6"
      aria-labelledby="reviews-heading"
      className="relative overflow-hidden section-pad"
    >
      <DrawnBorder />
      <SectionGlow position="left" />
      <div className="shell relative">
        <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-12">
          <Reveal className="lg:col-span-5 lg:sticky lg:top-28">
            <RevealItem>
              <SectionChip index={6} label={reviews.chip} />
              <h2
                id="reviews-heading"
                className="mt-6 max-w-[16ch] font-display text-h2 text-ink"
              >
                {reviews.headline}{" "}
                <span className="text-gradient">{reviews.accent}</span>
              </h2>
              <p className="mt-4 max-w-[var(--measure-lede)] text-lede text-muted">
                {reviews.ratingLine}
              </p>
              <div className="mt-8">
                <TrustBar />
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
                <Button href={cta.bookACall.href} variant="primary">
                  {cta.bookACall.label}
                </Button>
                <a
                  href={googleReviewsUrl}
                  target="_blank"
                  rel="noopener"
                  className="group inline-flex items-center gap-2 text-body font-semibold text-gold"
                >
                  Read all 17 on Google
                  <span
                    aria-hidden="true"
                    className="transition-transform duration-200 group-hover:translate-x-1"
                  >
                    &rarr;
                  </span>
                </a>
              </div>
            </RevealItem>
          </Reveal>

          {/* static, scannable masonry: every review readable at once */}
          <Reveal className="lg:col-span-7">
            <RevealItem>
              <div className="columns-1 gap-5 sm:columns-2">
                {reviews.items.map((r) => (
                  <ReviewCard key={r.name} quote={r.quote} name={r.name} className="mb-5" />
                ))}
              </div>
            </RevealItem>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
