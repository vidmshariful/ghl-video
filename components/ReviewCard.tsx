import { Avatar } from "@/components/Avatar";

/*
 * One real Google review, verbatim. Shared by the homepage feed and the
 * service pages, so a review looks the same wherever it is quoted.
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

export function ReviewCard({
  quote,
  name,
  className = "",
}: {
  quote: string;
  name: string;
  className?: string;
}) {
  return (
    <blockquote
      className={`break-inside-avoid rounded-card border border-hair bg-surface p-6 ${className}`}
    >
      <Stars />
      <p className="mt-4 text-body leading-relaxed text-muted">{quote}</p>
      <footer className="mt-5 flex items-center justify-between gap-4 border-t border-hair pt-4">
        <p>
          <span className="block text-body font-medium text-ink">{name}</span>
          <GoogleCue />
        </p>
        <Avatar name={name} photo={null} size="md" />
      </footer>
    </blockquote>
  );
}
