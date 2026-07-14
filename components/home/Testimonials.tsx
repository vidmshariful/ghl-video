import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { DrawnBorder } from "@/components/DrawnBorder";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionChip } from "@/components/SectionChip";
import { SectionGlow } from "@/components/SectionGlow";
import { home, cta, clients, rating, googleReviewsUrl } from "@/lib/site";

/*
 * Real Google reviews, verbatim. The feed used to auto-scroll, which
 * meant nobody could actually read the proof. Now it is a static,
 * scannable masonry with a trust bar up top: read at your own pace,
 * every review visible, nothing sliding away.
 */

function Stars() {
  return (
    <span className="flex gap-1" role="img" aria-label="Five star review">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg
          key={i}
          viewBox="0 0 12 12"
          className="h-3.5 w-3.5 fill-gold"
          aria-hidden="true"
        >
          <path d="M6 .8l1.57 3.18 3.51.51-2.54 2.48.6 3.5L6 8.82l-3.14 1.65.6-3.5L.92 4.49l3.51-.51L6 .8z" />
        </svg>
      ))}
    </span>
  );
}

/* factual review attribution: a quiet Google cue, monochrome to sit in
 * the brand rather than fight it */
function GoogleCue() {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-label uppercase text-dim">
      <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
        <path
          fill="currentColor"
          d="M8 6.5v3.1h4.3A4.3 4.3 0 1 1 8 3.7c1.1 0 2.1.4 2.9 1.1l2.2-2.2A7.3 7.3 0 1 0 15.3 8c0-.5 0-.9-.1-1.5H8z"
        />
      </svg>
      Google review
    </span>
  );
}

function ReviewCard({ quote, name }: { quote: string; name: string }) {
  return (
    <blockquote className="mb-5 break-inside-avoid rounded-card border border-hair bg-surface p-6">
      <Stars />
      <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted">{quote}</p>
      <footer className="mt-5 flex items-center justify-between gap-4 border-t border-hair pt-4">
        <p>
          <span className="block text-[0.9375rem] font-medium text-ink">
            {name}
          </span>
          <GoogleCue />
        </p>
        <Avatar name={name} photo={null} size="md" />
      </footer>
    </blockquote>
  );
}

/* three locked figures in one ruled row */
function TrustBar() {
  const stats = [
    { v: rating, l: "on Google", stars: true },
    { v: "17", l: "5-star reviews" },
    { v: `${clients}+`, l: "teams served" },
  ];
  return (
    <div className="grid grid-cols-3 divide-x divide-hair overflow-hidden rounded-card border border-hair bg-surface">
      {stats.map((s) => (
        <div key={s.l} className="px-4 py-4">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[1.5rem] font-bold leading-none text-gold [font-variant-numeric:tabular-nums]">
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
      <SectionGlow accent="gold" position="left" />
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
              <p className="mt-4 max-w-[44ch] text-lede text-muted">
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
                  className="group inline-flex items-center gap-2 text-sm font-semibold text-gold"
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
                  <ReviewCard key={r.name} quote={r.quote} name={r.name} />
                ))}
              </div>
            </RevealItem>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
