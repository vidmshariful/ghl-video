import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { DrawnBorder } from "@/components/DrawnBorder";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionChip } from "@/components/SectionChip";
import { SectionGlow } from "@/components/SectionGlow";
import { home, cta, googleReviewsUrl } from "@/lib/site";

/*
 * Real Google reviews, verbatim: pitch column left, a continuously
 * rising feed of review cards right (pauses on hover, static under
 * reduced motion). Five gold stars on every card because every one of
 * the 17 reviews is five stars.
 */

function Stars() {
  return (
    <span className="flex gap-1" role="img" aria-label="Five star review">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg
          key={i}
          viewBox="0 0 12 12"
          className="h-3 w-3 fill-gold"
          aria-hidden="true"
        >
          <path d="M6 .8l1.57 3.18 3.51.51-2.54 2.48.6 3.5L6 8.82l-3.14 1.65.6-3.5L.92 4.49l3.51-.51L6 .8z" />
        </svg>
      ))}
    </span>
  );
}

function ReviewCard({ quote, name }: { quote: string; name: string }) {
  return (
    <blockquote className="rounded-card border border-hair card-glass p-6">
      <Stars />
      <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted">
        {quote}
      </p>
      <footer className="mt-5 flex items-center justify-between gap-4 border-t border-hair pt-4">
        <p>
          <span className="block text-[0.9375rem] font-medium text-ink">
            {name}
          </span>
          <span className="block font-mono text-label uppercase text-dim">
            Google review
          </span>
        </p>
        <Avatar name={name} photo={null} size="md" />
      </footer>
    </blockquote>
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
        <div className="grid items-center gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <RevealItem>
              <SectionChip index={6} label={reviews.chip} />
              <h2
                id="reviews-heading"
                className="mt-6 max-w-[16ch] font-display text-h2 text-ink"
              >
                {reviews.headline}{" "}
                <span className="text-gold">{reviews.accent}</span>
              </h2>
              <p className="mt-4 max-w-[44ch] text-lede text-muted">
                {reviews.ratingLine}
              </p>
              <div className="mt-9">
                <Button href={cta.bookACall.href} variant="primary">
                  {cta.bookACall.label}
                </Button>
              </div>
              <a
                href={googleReviewsUrl}
                target="_blank"
                rel="noopener"
                className="group mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gold"
              >
                Read all 17 reviews on Google
                <span
                  aria-hidden="true"
                  className="transition-transform duration-200 group-hover:translate-x-1"
                >
                  &rarr;
                </span>
              </a>
            </RevealItem>
          </Reveal>

          {/* the rising feed */}
          <Reveal className="lg:col-span-7">
            <RevealItem>
              <div className="marquee-v-wrap relative h-[34rem] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)]">
                <div className="marquee-v flex flex-col gap-4">
                  <div className="flex flex-col gap-4">
                    {reviews.items.map((r) => (
                      <ReviewCard key={r.name} quote={r.quote} name={r.name} />
                    ))}
                  </div>
                  <div className="flex flex-col gap-4" aria-hidden="true">
                    {reviews.items.map((r) => (
                      <ReviewCard
                        key={`${r.name}-clone`}
                        quote={r.quote}
                        name={r.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </RevealItem>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
