/*
 * Concept boards: alternate directions for the look and feel.
 *
 * A board is nothing but a set of custom-property overrides. That is only
 * useful because the tokenisation pass made it true: a full skin swap now
 * moves every colour-bearing surface on the page except the monochrome film
 * grain, so what you see under a board is what the site would actually
 * become, not an approximation of it.
 *
 * What a board deliberately does NOT touch: the brand hues. Gold, blue and
 * green are pixel-exact from the logo and the gradient is the signature, so
 * a board changes the room the brand sits in, not the brand. Moving those
 * is possible (they are tokens like any other) but it desynchronises the
 * mark, which is a different and much larger decision.
 */

export type Board = {
  id: string;
  name: string;
  blurb: string;
  /* custom property name -> value, without the leading -- */
  tokens: Record<string, string>;
};

/* The live system, as a board, so it can be compared like for like. */
export const CURRENT: Board = {
  id: "current",
  name: "Current",
  blurb:
    "What ships today. Cool-tinted near-black with a neutral ground ramp underneath it.",
  tokens: {
    canvas: "#08090d",
    surface: "#111219",
    card: "#161821",
    hair: "#2b2f40",
    text: "#eef0f6",
    muted: "#9096a8",
    dim: "#7d8499",
    "ground-deep": "#030303",
    "ground-mid": "#0a0a0a",
    "ground-top": "#121212",
    "btn-deep-top": "#181b23",
    "btn-deep-bottom": "#0f1116",
    "btn-deep-top-hover": "#1c2029",
    "btn-deep-bottom-hover": "#12141a",
  },
};

export const BOARDS: Board[] = [
  CURRENT,
  {
    id: "graphite",
    name: "Graphite",
    blurb:
      "The same room with the lights up. Every step lifts, the hairline becomes visible rather than implied, and cards read as objects instead of as slightly different darkness. Less severe, easier to scan, and the gradient has more to push against.",
    tokens: {
      canvas: "#0e1015",
      surface: "#171a21",
      card: "#1d212a",
      hair: "#333949",
      text: "#f0f2f7",
      muted: "#9aa1b3",
      dim: "#848b9f",
      "ground-deep": "#08090c",
      "ground-mid": "#101319",
      "ground-top": "#1a1e26",
      "btn-deep-top": "#232734",
      "btn-deep-bottom": "#171a22",
      "btn-deep-top-hover": "#2a2f3e",
      "btn-deep-bottom-hover": "#1c2029",
    },
  },
  {
    id: "void",
    name: "Void",
    blurb:
      "True black and neutral, with the blue tint taken out entirely. The most product-like of the three: video sits in nothing, text is pure white, and the accents do all the colour work on their own. Harder edged, and unforgiving of any surface that is not deliberate.",
    tokens: {
      canvas: "#000000",
      surface: "#0a0a0c",
      card: "#101013",
      hair: "#2f2f36",
      text: "#ffffff",
      muted: "#a0a0aa",
      dim: "#85858f",
      "ground-deep": "#000000",
      "ground-mid": "#060608",
      "ground-top": "#0e0e11",
      "btn-deep-top": "#16161a",
      "btn-deep-bottom": "#0b0b0d",
      "btn-deep-top-hover": "#1d1d22",
      "btn-deep-bottom-hover": "#101013",
    },
  },
  {
    id: "ember",
    name: "Ember",
    blurb:
      "Warm dark instead of cool dark: a brown-black room rather than a blue-black one. Gold stops being an accent on a cold ground and starts looking native, which changes the mood more than the numbers suggest. Green has the most work to do here.",
    tokens: {
      canvas: "#0d0a08",
      surface: "#171310",
      card: "#1e1815",
      hair: "#3a3029",
      text: "#f5f0ea",
      muted: "#ada39a",
      dim: "#928880",
      "ground-deep": "#060403",
      "ground-mid": "#0f0b09",
      "ground-top": "#191310",
      "btn-deep-top": "#221b16",
      "btn-deep-bottom": "#14100d",
      "btn-deep-top-hover": "#2a221c",
      "btn-deep-bottom-hover": "#191410",
    },
  },
];

export function boardById(id: string): Board {
  return BOARDS.find((b) => b.id === id) ?? CURRENT;
}

/* The board as a stylesheet. Injected into a preview frame at first paint
 * rather than applied to a live document: swapping a custom property at
 * runtime does not drive transition-colors, so anything carrying it would
 * keep its old paint and read as broken. */
export function boardCss(board: Board): string {
  const decls = Object.entries(board.tokens)
    .map(([k, v]) => `--${k}:${v};`)
    .join("");
  return `:root{${decls}}`;
}

/* ---- contrast, so a board cannot quietly fail the bar the system cleared ---- */

function channel(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function contrast(aHex: string, bHex: string): number {
  const lum = (hex: string) => {
    const [r, g, b] = hexToRgb(hex);
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const [hi, lo] = [lum(aHex), lum(bHex)].sort((x, y) => y - x);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

/* The brand hues are constant across boards, but their contrast against a
 * board's grounds is not, so they are checked too. */
export const BRAND = { gold: "#fcc000", green: "#00cc00", blue: "#0090fc", error: "#ff6b6b" };

export type Check = {
  fg: string;
  bg: string;
  ratio: number;
  bar: number;
  pass: boolean;
  /* Advisory rows are reported but do not count as failures. The hairline is
   * a decorative edge rather than a control boundary, and it sits at 1.50 on
   * the live system today. Counting it would mark every board, including the
   * one that ships, as failing, which turns the whole check into noise. */
  advisory?: boolean;
};

export function checksFor(board: Board): Check[] {
  const t = board.tokens;
  const pairs: [string, string, string, string, number, boolean?][] = [
    ["text", t.text, "canvas", t.canvas, 4.5],
    ["text", t.text, "card", t.card, 4.5],
    ["muted", t.muted, "canvas", t.canvas, 4.5],
    ["muted", t.muted, "card", t.card, 4.5],
    ["dim", t.dim, "canvas", t.canvas, 4.5],
    ["dim", t.dim, "surface", t.surface, 4.5],
    ["dim", t.dim, "card", t.card, 4.5],
    ["dim", t.dim, "ground-top", t["ground-top"], 4.5],
    ["gold", BRAND.gold, "canvas", t.canvas, 4.5],
    ["green", BRAND.green, "canvas", t.canvas, 4.5],
    ["blue", BRAND.blue, "canvas", t.canvas, 3],
    ["error", BRAND.error, "canvas", t.canvas, 4.5],
    ["hair", t.hair, "canvas", t.canvas, 3, true],
  ];
  return pairs.map(([fg, fgv, bg, bgv, bar, advisory]) => {
    const ratio = contrast(fgv, bgv);
    return { fg, bg, ratio, bar, pass: ratio >= bar, advisory };
  });
}

/* How a board compares with what ships, on the numbers rather than the vibe. */
export function scoreBoard(board: Board) {
  const checks = checksFor(board);
  const binding = checks.filter((c) => !c.advisory);
  return {
    failures: binding.filter((c) => !c.pass).length,
    checked: binding.length,
    /* the weakest binding pair: what a board is limited by */
    weakest: binding.reduce((a, b) => (b.ratio < a.ratio ? b : a)),
  };
}
