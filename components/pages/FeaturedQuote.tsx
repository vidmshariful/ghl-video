import { GhlMark } from "@/components/GhlMark";
import { featuredTestimonial as t } from "@/lib/site";

/*
 * Chase Buckner's endorsement as a text callout, for pages that show a
 * review grid or strip rather than the home video band (checkout, custom,
 * editing, premade). Authority proof, so it leads the section. His words
 * are his own professional opinion; the footer non-affiliation disclaimer
 * stays.
 */
export function FeaturedQuote({ className = "" }: { className?: string }) {
  return (
    <figure
      className={`relative overflow-hidden rounded-card border border-gold/25 bg-gold/[0.04] p-6 shadow-[0_0_44px_-16px_rgba(var(--gold-rgb),0.35)] md:p-8 ${className}`}
    >
      <span className="inline-flex w-fit items-center gap-2.5 rounded-[4px] border border-gold/30 bg-canvas/60 py-1.5 pl-2 pr-3">
        <GhlMark className="h-3.5 w-auto" />
        <span aria-hidden="true" className="h-3 w-px bg-gold/30" />
        <span className="font-mono text-label uppercase tracking-[0.14em] text-gold">
          {t.marker}
        </span>
      </span>
      <blockquote className="mt-5">
        <p className="max-w-[52ch] font-display text-h3 leading-snug text-ink">
          &ldquo;{t.short}&rdquo;
        </p>
      </blockquote>
      <figcaption className="mt-5 border-l-2 border-gold pl-4">
        <p className="font-display text-h4 font-semibold text-ink">{t.name}</p>
        <p className="mt-0.5 text-body text-muted">{t.role}</p>
      </figcaption>
    </figure>
  );
}
