import { Avatar } from "@/components/Avatar";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionChip } from "@/components/SectionChip";
import { SectionGlow } from "@/components/SectionGlow";
import { home, googleReviewsUrl } from "@/lib/site";

/*
 * Real Google reviews, verbatim, in a bento: one wide lead card, one
 * medium, three small. Every word is a client's own. The header links
 * to the live Google profile.
 */
const spans: Record<string, string> = {
  lg: "md:col-span-7",
  md: "md:col-span-5",
  sm: "md:col-span-4",
};

export function Testimonials() {
  const { reviews } = home;
  return (
    <section className="relative overflow-hidden section-pad border-t border-hair">
      <SectionGlow accent="gold" position="left" />
      <div className="shell relative">
        <Reveal>
          <RevealItem className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <SectionChip index={6} label={reviews.chip} />
              <h2 className="mt-6 max-w-[20ch] font-display text-h2 text-ink">
                {reviews.headline}{" "}
                <span className="text-gold">{reviews.accent}</span>
              </h2>
              <p className="mt-4 max-w-[52ch] text-lede text-muted">
                {reviews.ratingLine}
              </p>
            </div>
            <a
              href={googleReviewsUrl}
              target="_blank"
              rel="noopener"
              className="group inline-flex items-center gap-2 text-sm font-semibold text-gold"
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

        <Reveal className="mt-12 grid gap-4 md:grid-cols-12">
          {reviews.items.map((review) => (
            <RevealItem key={review.name} className={spans[review.size]}>
              <blockquote className="flex h-full flex-col rounded-card border border-hair card-glass p-7">
                <p
                  className={`leading-relaxed ${
                    review.size === "lg"
                      ? "font-display text-[1.25rem] font-semibold tracking-tight text-ink"
                      : "text-sm text-muted"
                  }`}
                >
                  {review.quote}
                </p>
                <footer className="mt-6 flex items-center gap-3 pt-2">
                  <Avatar name={review.name} photo={null} size="md" />
                  <p>
                    <span className="block text-sm font-medium text-ink">
                      {review.name}
                    </span>
                    <span className="block font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-dim">
                      Google review
                    </span>
                  </p>
                </footer>
              </blockquote>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
