/*
 * The section-box surface (client system, July 2026): gradient pick 16,
 * blue glowing from the top-left into TRUE black, with the band-strength
 * grain riding the light shoulder. Boxed to the frame rails with
 * PageFrame's exact geometry, so it stops at the rails and reads one
 * step deeper than the page canvas around it. Shared by the closing CTA
 * band and every inner-page hero; change the recipe here and the whole
 * system follows.
 */
export function SectionGradient() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-1/2 w-[min(100%-1.5rem,80.5rem)] -translate-x-1/2"
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
