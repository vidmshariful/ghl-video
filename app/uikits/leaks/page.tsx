import { KitPage, KitSection, KitTable, Note } from "@/components/uikits/kit";
import { assertDevOnly } from "@/components/uikits/dev-only";

/*
 * The audit page, and the reason the kit is worth having.
 *
 * The system is variable-driven, but not completely. Every row below is a
 * value written as a literal where a token was available. They are what
 * makes "change the look and feel" partially fail: you edit a skin block,
 * reload, and some of the screen has not moved.
 *
 * Line numbers are accurate as of the commit that added this page. Verify
 * with the grep at the bottom rather than trusting them after a refactor.
 */

const BREAKS_A_RESTYLE = [
  [
    "Button.tsx:17",
    "#181b23, #0f1116, #1c2029, #12141a",
    "The deep fill behind the primary and hero variants, plus its inset highlight. This is the most-used control on the site and it does not read a single skin token, so a restyle leaves every body button behind.",
  ],
  [
    "globals.css:424",
    "#121212, #0a0a0a, #030303",
    "card-glass, the default Panel ground. Every card in the system sits on these three literals.",
  ],
  [
    "globals.css:439",
    "#fcc000, #00cc00",
    "grad-line restates the brand hues instead of using var(--gold) and var(--green). Change the brand colours and the animated rule keeps the old ones.",
  ],
  [
    "globals.css:509",
    "rgba(252,192,0,.16), rgba(0,204,0,.09)",
    "checkout-panel, the one elevated surface on the money path. Same two hues, restated as alpha literals.",
  ],
  [
    "globals.css:356",
    "rgba(252,192,0,.3), #08090d",
    "::selection. Gold and canvas, restated.",
  ],
  [
    "sales.css",
    "--sp-grad",
    "Restates the gold-to-green gradient rather than referencing --brand-gradient.",
  ],
  [
    "Manifesto.tsx:13-15",
    "#7d8499, #EEF0F6, #FCC000",
    "Duplicates --dim, --text and --gold as literals inside the component.",
  ],
  [
    "MediaFrame, premade/cards, TeamSection, Footer",
    "#030303, #0a0a0a, #050505",
    "The card-glass family again, hand-written at four more call sites. If card-glass were tokenised these would follow it.",
  ],
  [
    "Hero.tsx:82",
    "#3A4157",
    "A one-off grey that sits between --hair and --dim without being either.",
  ],
  [
    "portal/team.tsx:74",
    "#FCC000",
    "Gold, restated inside the portal surface.",
  ],
];

/* Measured on the live homepage, not estimated: override every skin and brand
 * property at once (what a concept board does) and count the painted fills
 * that refuse to move. 224 painted fills, 87 unchanged. */
const MEASURED = [
  ["Painted fills on the homepage", "224", "Elements larger than 8px with a background colour or image."],
  ["Unchanged after a full token swap", "87", "39 percent. Roughly two in five painted surfaces ignore the skin."],
  ["Still showing original brand literals", "65", "Matched against the current gold, green and the five near-black greys."],
];

const WIDER_CLASSES = [
  [
    "Media grounds",
    "bg-[#030303]",
    "MediaFrame, premade cards and the hero block. This is the single biggest contributor: the hero stays pure black through any reskin.",
  ],
  [
    "Ambient glows",
    "radial-gradient(..., rgba(252,192,0,.08), rgba(0,204,0,.04))",
    "Section and hero glows write the brand hues inline as rgba instead of using --glow-gold and --glow-green, which exist for exactly this.",
  ],
  [
    "Card tints",
    "linear-gradient(135deg, rgba(252,192,0,.06), transparent 55%)",
    "The hover wash on library and service cards. Same two hues, restated per call site at several different alphas.",
  ],
];

const CORRECT_AS_IS = [
  [
    "PaymentMarks.tsx",
    "Visa, Mastercard, Amex, Google Pay",
    "Third-party brand marks. These must NOT follow a restyle: the card networks specify their colours and a recoloured Visa mark is a trademark problem, not a design choice.",
  ],
  [
    "GhlMark.tsx:17-25",
    "#0098FD, #FFC503, #00D001",
    "The logo's own artwork. Close to the brand tokens but deliberately not identical, and the logo should not shift when a surface is reskinned. Worth documenting rather than tokenising, because the near-match invites somebody to 'fix' it.",
  ],
  [
    "globals.css:630-636",
    "The ghl-glow keyframes",
    "The mark's breathing glow, matched to the logo artwork above rather than to the brand tokens. Consistent with the mark, which is the right reference here.",
  ],
  [
    "sales.css",
    "The whole --sp-* namespace",
    "A deliberate second system, not a leak. It is separate so the landing pages can look different from the site.",
  ],
];

const VERDICT = [
  ["Colour", "Yes, with the leaks above", "17 global properties plus 10 in the sales namespace."],
  ["Type scale", "Yes, fully", "11 steps, each carrying its own line-height, tracking and weight."],
  ["Radius", "Yes", "--radius-card and --radius-media, plus a 3px control radius set inline."],
  ["Rhythm", "Yes", "section-pad, section-pad-sm, hero-pad, shell, and the two measures."],
  ["Motion", "Partly", "Durations and easings are written per animation. No timing tokens exist."],
  ["Spacing", "No", "Tailwind's default scale is used directly. There is no custom spacing ramp, which is fine."],
  ["Shadow", "N/A", "The system uses glows, not shadows. There is nothing to tokenise."],
];

export default function LeaksPage() {
  assertDevOnly();
  return (
    <KitPage
      title="Leaks"
      lede="Values written as literals where a token was available. Read this page before changing the look and feel: these are the parts of the screen that will not move when you edit a skin block."
    >
      <KitSection
        title="Is the system variable-driven?"
        note="The short answer is yes. Colour, type, radius and rhythm all resolve through custom properties, and Tailwind v4 @utility is the mixin equivalent. This table is the honest version of that answer."
      >
        <KitTable head={["Concern", "Tokenised", "Detail"]} rows={VERDICT} />
      </KitSection>

      <KitSection
        title="How much actually moves"
        note="Measured, not estimated. Override every skin and brand property on the live homepage at once, which is what a concept board does, and count the painted fills that stay put."
      >
        <KitTable head={["Measure", "Count", "Detail"]} rows={MEASURED} />
        <div className="mt-4">
          <Note tone="warn">
            Two in five painted surfaces ignore the skin. The visible result
            is a page that reskins around its edges while the hero block
            stays black, because the largest single offender is the media
            ground below. Fix these before building concept boards, or every
            board will show the same black hero.
          </Note>
        </div>
      </KitSection>

      <KitSection
        title="Whole classes of leak, beyond the named rows"
        count={WIDER_CLASSES.length}
        note="Found by the measurement above rather than by reading files, which is why they are not in the itemised list: they repeat across many call sites instead of sitting in one place."
      >
        <KitTable head={["Class", "Shape", "Where and why it matters"]} rows={WIDER_CLASSES} />
      </KitSection>

      <KitSection
        title="Will break a restyle"
        count={BREAKS_A_RESTYLE.length}
        note="Named, single-site offenders. Each should read a variable and does not, and the first row matters most because it is the primary button. This list is not the whole picture on its own: see the measurement above."
      >
        <KitTable head={["Where", "Literal", "Why it matters"]} rows={BREAKS_A_RESTYLE} />
        <div className="mt-4">
          <Note tone="warn">
            None of this is broken today, because every literal currently
            matches the token it duplicates. The cost is paid the moment a
            skin changes, which is exactly what this kit exists to support.
          </Note>
        </div>
      </KitSection>

      <KitSection
        title="Hardcoded on purpose"
        count={CORRECT_AS_IS.length}
        note="Not everything literal is a mistake. These should stay exactly as they are, and tokenising them would be the bug."
      >
        <KitTable head={["Where", "Value", "Why it is correct"]} rows={CORRECT_AS_IS} />
      </KitSection>

      <KitSection title="Re-run the audit">
        <p className="mb-3 text-[0.8125rem] leading-relaxed text-[var(--kit-dim)]">
          Line numbers above go stale. This finds the current set:
        </p>
        <pre className="overflow-x-auto rounded-[4px] border border-[var(--kit-line)] bg-[var(--kit-panel)] px-4 py-3 text-[0.75rem] leading-relaxed text-[var(--kit-text)]">
          <code>{`grep -rnE '#[0-9a-fA-F]{6}' components/ app/globals.css 'app/(sales)/sales.css'`}</code>
        </pre>
      </KitSection>
    </KitPage>
  );
}
