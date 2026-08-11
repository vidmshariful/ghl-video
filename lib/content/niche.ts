/* The ICP "niche customization" upsell, shared by the premade library card
 * (site) and the sales-LP library card. Each renders it in its own design
 * system, but the words and the price live here once so the two can't drift
 * (they already had two different fourth bullets before this). The demo price
 * is higher because a demo is the bigger, pricier format; the checkout bumps
 * charge the same split (see the order_bumps rows). */
export const nicheAddon = {
  trigger: "Serving a specific niche?",
  title: "Made for your niche",
  cta: "Select it at checkout",
  bullets: [
    "Industry footage swapped in for yours",
    "Graphics and on-screen text rebranded",
    "Conversational messaging matched to your funnel",
    'ICP wording in the script and the voiceover (say "clients" not "customers")',
  ],
  priceStandard: 50,
  priceDemo: 100,
} as const;

/** The retune price for a card: demos cost more than standard videos. */
export const nicheAddonPrice = (isDemo: boolean): number =>
  isDemo ? nicheAddon.priceDemo : nicheAddon.priceStandard;

/** The intro line, with the price filled in. */
export const nicheIntro = (price: number): string =>
  `For an extra $${price}, we retune this video to your exact ICP:`;
