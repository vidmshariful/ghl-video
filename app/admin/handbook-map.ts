import type { View } from "./nav";

/*
 * Which handbook topic explains which screen.
 *
 * The moment somebody needs the handbook is while they are staring at the
 * screen that confused them, not later when they remember to go looking. So
 * every mapped screen carries a quiet link straight to its page.
 *
 * Lives here rather than in lib/handbook.ts to keep the direction of imports
 * honest: the app knows about its own screens, the library does not need to.
 * `npm run check:handbook` fails if any slug here stops existing, so a renamed
 * or deleted topic cannot leave a dead link behind on a screen.
 */
export const HANDBOOK_FOR: Partial<Record<View, { slug: string; label: string }>> = {
  production: { slug: "the-studio-day", label: "How the studio day works" },
  editing: { slug: "the-studio-day", label: "How the studio day works" },
  orders: { slug: "how-an-order-flows", label: "How an order flows" },
  products: { slug: "products-and-prices", label: "How products and prices work" },
  catalog: { slug: "products-and-prices", label: "How products and prices work" },
  emails: { slug: "emails", label: "What each email does" },
  messages: { slug: "reviews-and-revisions", label: "How feedback reaches us" },
  customers: { slug: "what-the-client-sees", label: "What the client sees" },
  settings: { slug: "who-can-see-what", label: "Roles and access" },
  health: { slug: "when-something-breaks", label: "What each of these means" },
  code: { slug: "getting-on-the-site", label: "How site access works" },
};

export const handbookFor = (view: View) => HANDBOOK_FOR[view] ?? null;
