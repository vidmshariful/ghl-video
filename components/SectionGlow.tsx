/*
 * Section glow is retired (client direction, July 2026): the marketing
 * body is a clean near-black, and the only ambient glow lives in the hero
 * (see HeroAtmosphere). This component now renders nothing so the many
 * existing `<SectionGlow />` call sites keep compiling without a glow.
 */
export function SectionGlow(_props?: {
  position?: "left" | "right";
}) {
  void _props;
  return null;
}
