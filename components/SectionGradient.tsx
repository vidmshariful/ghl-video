/*
 * The section-box surface (client system, July 2026): gradient pick 16,
 * blue glowing from the top-left into TRUE black, with the band-strength
 * grain riding the light shoulder. Boxed to the frame rails with
 * PageFrame's exact geometry, and it re-draws the rails on itself
 * (border-x): the surface is opaque, so without them it would swallow
 * the fixed PageFrame lines and break the page's grid reading.
 *
 * `belowHeader` starts the surface at the fixed header's bottom rule
 * (h-20) instead of the section's true top, so the gradient never
 * shows behind or under the nav. Heroes pass it; the closing band
 * does not. Shared by both; change the recipe here and the whole
 * system follows.
 */
export function SectionGradient({ belowHeader = false }: { belowHeader?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute bottom-0 left-1/2 w-[min(100%-1.5rem,80.5rem)] -translate-x-1/2 border-x border-hair/70 ${
        belowHeader ? "top-20" : "top-0"
      }`}
      style={{
        /* gradient pick 16: blue corner, top left (client choice) */
        background:
          "linear-gradient(135deg, rgba(0,144,252,0.13) 0%, rgba(0,144,252,0.035) 34%, rgba(0,0,0,0) 60%), #000",
      }}
    >
      <span
        aria-hidden="true"
        className="grunge absolute inset-0"
        style={{ opacity: 0.15 }}
      />
    </div>
  );
}
