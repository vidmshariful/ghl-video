import { Button } from "@/components/Button";
import { ReviewCard } from "@/components/ReviewCard";
import { SectionChip } from "@/components/SectionChip";
import { Reveal, RevealItem } from "@/components/Reveal";
import { home, googleReviewsUrl } from "@/lib/site";

/*
 * Real Google reviews as a calm vertical feed. Left: the pitch and a
 * single "Review us" CTA, nothing else. Right: one column of review
 * cards scrolling up forever, three to four in view, the top and bottom
 * masked so only the centre is in focus. Pauses on hover; static under
 * reduced motion. The visible run is duplicated for a seamless loop; the
 * duplicate is hidden from assistive tech so the proof is read once.
 */
export function Testimonials() {
  const { reviews } = home;
  const mask =
    "linear-gradient(to bottom, transparent, #000 18%, #000 82%, transparent)";
  return (
    <section
      data-bp-idx="6"
      aria-labelledby="reviews-heading"
      className="relative overflow-hidden section-pad"
    >
      <div className="shell">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          {/* left: pitch + one CTA */}
          <Reveal>
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
              <div className="mt-9">
                <Button href={googleReviewsUrl} external>
                  Review us
                </Button>
              </div>
            </RevealItem>
          </Reveal>

          {/* right: vertical review marquee, centre in focus */}
          <div
            className="marquee-v-wrap relative h-[30rem] overflow-hidden lg:h-[34rem]"
            style={{ maskImage: mask, WebkitMaskImage: mask }}
          >
            <div className="marquee-v flex flex-col">
              {reviews.items.map((r) => (
                <ReviewCard
                  key={r.name}
                  quote={r.quote}
                  name={r.name}
                  className="mb-4"
                />
              ))}
              {/* duplicate run for the seamless loop, hidden from a11y */}
              <div aria-hidden="true" className="contents">
                {reviews.items.map((r) => (
                  <ReviewCard
                    key={`dup-${r.name}`}
                    quote={r.quote}
                    name={r.name}
                    className="mb-4"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
