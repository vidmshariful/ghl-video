/*
 * The design system's enforcement vocabulary.
 *
 * The UI kit at /uikits made the look swappable: a full reskin is now about
 * fourteen custom properties instead of a hunt through every component. That
 * is only true while it stays true, and nothing about a token system defends
 * itself. Two ways it decays:
 *
 *   1. A token gets renamed or merged, and the pages that document it keep
 *      naming the dead one. This already happened once. The kit's audit page
 *      still advertised --media-ground, --card-glass-top/-mid/-base,
 *      --footer-ground and --sketch-line one commit after all six were
 *      consolidated away, so it was teaching names that resolve to nothing.
 *
 *   2. Somebody types #0a0a0a into a new component. Nothing complains, the
 *      leak rate creeps back up, and a year later the skin swap moves 60% of
 *      the page instead of 99%.
 *
 * `npm run check:tokens` and `npm run check:leaks` are what complain. This
 * file is the vocabulary both of them read.
 */

/**
 * Tokens that used to exist, and what took over.
 *
 * A name lands here when it is merged or renamed, which makes retirement a
 * decision somebody records rather than a silence. The kit may still mention
 * a retired name (its history tables do, on purpose) but nothing may point at
 * one as if it were live, and re-defining one is refused: a retirement that
 * is not true is worse than no record at all.
 */
export const RETIRED_TOKENS: Record<string, string> = {
  "media-ground": "--ground-deep. Video wells, the footer and the base of card-glass share one value now.",
  "media-ground-rgb": "--ground-deep-rgb.",
  "card-glass-top": "--ground-top. The lit crown of a glass card.",
  "card-glass-mid": "--ground-mid.",
  "card-glass-base": "--ground-deep.",
  "footer-ground": "--ground-deep. The footer was two shades off the video wells for no reason.",
  "sketch-line": "--hair. A stray #3a4157 grey folded into the standard hairline.",
};

/**
 * Where a colour literal is correct, and why.
 *
 * Not everything hardcoded is a leak, and a check that cannot tell the
 * difference gets switched off. Anything outside this list is treated as a
 * leak, so adding a file here is a deliberate act with a reason attached
 * rather than a number quietly going up.
 *
 * `only` narrows the pardon to named values. Prefer it: a whole-file pass
 * means the next genuine leak in that file arrives unannounced, which is how
 * an allowlist turns into the thing it was meant to prevent. Leave it off
 * only where the literals are the file's actual subject matter.
 */
export const LITERAL_ALLOWLIST: { path: string; why: string; only?: string[] }[] = [
  {
    path: "app/globals.css",
    why: "Where the tokens are defined. The literals here are the palette itself.",
  },
  {
    path: "app/(sales)/sales.css",
    why: "The sales pages are a deliberate second system with their own --sp-* palette, kept separate so a campaign restyle cannot touch the main site.",
  },
  {
    path: "components/checkout/PaymentMarks.tsx",
    why: "Visa, Mastercard, Amex and Google Pay artwork. The card networks specify these colours and a recoloured mark is a trademark problem, not a design choice. These must NOT follow a reskin.",
  },
  {
    path: "components/GhlMark.tsx",
    why: "The logo's own artwork, close to the brand tokens but deliberately not identical. The mark should not shift when a surface is reskinned.",
  },
  {
    path: "components/BookingCalendars.tsx",
    why: "A colour handed to the LeadConnector embed, which renders in an iframe we do not style.",
  },
  {
    path: "app/admin/CustomerRecord.tsx",
    why: "The same video-frame preview grounds as the portal Brand Kit, so the studio judges the client's marks on the grounds they will actually sit on.",
    only: ["#08090D"],
  },
  {
    path: "components/sales/SpVideo.tsx",
    why: "Belongs to the --sp-* sales system rather than the main skin.",
  },
  {
    path: "app/api/admin/integrations/route.ts",
    why: "Colours inside generated email HTML. Mail clients do not support custom properties, so a literal is the only thing that renders.",
  },
  {
    path: "app/api/portal/socialx/route.ts",
    why: "Same reason: colours baked into an email body.",
  },
  {
    path: "components/home/Testimonials.tsx",
    only: ["#000"],
    why: "A mask gradient, where only the alpha channel does anything. The black is carrying opacity, not colour, so pointing it at a token would be meaningless at best and would break the fade at worst.",
  },
  {
    path: "app/checkout/intake/[orderId]/IntakeClient.tsx",
    only: ["#0090FC", "#00CC00"],
    why: "The client's own brand colours, typed by them at intake. These are data we collect, not styling we apply, and they must not follow our skin. The two values are the starting suggestions in the picker.",
  },
  {
    path: "app/api/admin/campaigns/send/route.ts",
    why: "Colours inside a generated offer email. Mail clients do not support custom properties, so a literal is the only thing that renders. Same reason as the other two email routes above.",
  },
  {
    path: "app/portal/BrandKitView.tsx",
    only: ["#F25C1A", "#1F7A4D", "#08090D", "#9096A8"],
    why: "Two kinds of deliberate literal. #F25C1A and #1F7A4D are example hex codes in a hint and two placeholders: illustrative text, not styling. #08090D and #9096A8 paint the logo preview tiles, which simulate video frames: the dark mark is judged on true white and the white mark on the brand near-black whatever skin the portal wears, so these must not follow a reskin. Scoped rather than pardoning the whole file, so a real leak here would still be caught.",
  },
];

/** Is this literal pardoned in this file? */
export const isAllowlisted = (path: string, value?: string) => {
  const entry = LITERAL_ALLOWLIST.find((a) => a.path === path);
  if (!entry) return false;
  if (!entry.only) return true;
  return value !== undefined && entry.only.some((v) => v.toLowerCase() === value.toLowerCase());
};
