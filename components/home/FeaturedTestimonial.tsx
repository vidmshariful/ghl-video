import { MediaFrame } from "@/components/MediaFrame";
import { Reveal, RevealItem } from "@/components/Reveal";
import { GhlMark } from "@/components/GhlMark";
import { featuredTestimonial as t } from "@/lib/site";

/*
 * Chase Buckner (HighLevel) featured endorsement. This is authority proof,
 * not peer proof, so it gets a dedicated elevated band ahead of the
 * customer founder cards rather than a slot in that grid: video left, pull
 * quote right, drawn in the site's ruled-frame language. Deliberately
 * un-numbered (no data-bp-idx / SectionChip index) so it reads as the
 * headline endorsement, not another step in the sequence. His words are
 * his own professional opinion; the footer non-affiliation disclaimer
 * stays.
 */
export function FeaturedTestimonial() {
  return (
    <section aria-label={`Testimonial from ${t.name}`} className="relative overflow-x-clip section-pad">
      <div className="shell">
        <div className="relative border border-hair">
          {/* the box's rules extend edge to edge, matching RuledSection */}
          <span aria-hidden="true" className="absolute -top-px left-1/2 -z-10 h-px w-screen -translate-x-1/2 bg-hair" />
          <span aria-hidden="true" className="absolute -bottom-px left-1/2 -z-10 h-px w-screen -translate-x-1/2 bg-hair" />
          <span aria-hidden="true" className="hatch pointer-events-none absolute inset-y-0 right-full mr-px w-[var(--rail-gutter)]" />
          <span aria-hidden="true" className="hatch pointer-events-none absolute inset-y-0 left-full ml-px w-[var(--rail-gutter)]" />

          <Reveal className="grid gap-px bg-hair lg:grid-cols-[1.05fr_1fr]">
            {/* video cell */}
            <RevealItem className="bg-canvas p-4 sm:p-5 lg:p-6">
              <MediaFrame
                src={t.src}
                poster={t.poster}
                label={`Testimonial from ${t.name}, ${t.role}`}
                tint
              />
            </RevealItem>

            {/* quote cell */}
            <RevealItem className="flex flex-col justify-center bg-canvas p-7 md:p-10">
              {/* authority marker: gold, and deliberately not a numbered chip */}
              <span className="inline-flex w-fit items-center gap-2.5 rounded-[4px] border border-gold/30 bg-gold/[0.06] py-2 pl-2.5 pr-3.5">
                <GhlMark className="h-4 w-auto" />
                <span aria-hidden="true" className="h-3.5 w-px bg-gold/30" />
                <span className="font-mono text-label uppercase tracking-[0.14em] text-gold">
                  {t.marker}
                </span>
              </span>

              <figure className="mt-6">
                <blockquote>
                  <p className="font-display text-h2 leading-[1.1] tracking-[-0.01em] text-ink">
                    &ldquo;{t.pull}&rdquo;
                  </p>
                  <p className="mt-5 max-w-[46ch] text-lede leading-relaxed text-muted">
                    {t.quote}
                  </p>
                </blockquote>
                <figcaption className="mt-7 border-l-2 border-gold pl-4">
                  <p className="font-display text-h4 font-semibold text-ink">{t.name}</p>
                  <p className="mt-0.5 text-body text-muted">{t.role}</p>
                </figcaption>
              </figure>
            </RevealItem>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
