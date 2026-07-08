/*
 * Placeholder lockup rebuilt as inline SVG until the real logo SVG is
 * delivered: tri-color rotational mark plus the two-tone wordmark.
 */
export function Logo({ className = "h-7" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        viewBox="0 0 36 36"
        className="h-full w-auto"
        aria-hidden="true"
        fill="none"
        strokeWidth="7"
        strokeLinecap="round"
      >
        {/* rounded triangle drawn as three strokes, one per brand color */}
        <path d="M13 6.9 L30 14.8" stroke="#0090FC" />
        <path d="M32.5 21.5 L20 31.5" stroke="#00CC00" />
        <path d="M8.5 27 L5.5 13" stroke="#FCC000" />
      </svg>
      <span className="font-display text-[1.15rem] font-bold tracking-tight leading-none">
        <span className="text-gold">GHL</span>{" "}
        <span className="text-green">VIDEO</span>
      </span>
    </span>
  );
}
