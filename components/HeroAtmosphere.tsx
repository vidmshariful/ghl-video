/*
 * The hero is the one place the marketing site carries any ambient colour
 * and grain (client direction). A reduced gold-to-green glow plus a light
 * film grunge, both absolutely positioned, so they must sit inside a
 * `relative overflow-x-clip` (or overflow-hidden) hero section. Everything
 * else on the site stays a clean near-black. Decorative only.
 */
export function HeroAtmosphere() {
  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-16 mx-auto h-[26rem] w-[44rem] max-w-[92%]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(252,192,0,0.08), rgba(0,204,0,0.04) 55%, transparent 76%)",
        }}
      />
      <span
        aria-hidden="true"
        className="grunge pointer-events-none absolute inset-0"
      />
    </>
  );
}
