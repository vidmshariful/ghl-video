import { KitPage, KitSection, KitTable, Note } from "@/components/uikits/kit";
import { assertDevOnly } from "@/components/uikits/dev-only";

/*
 * The audit page. It used to be a warning list; the leaks it named have now
 * been tokenised, so it is a record of what was wrong, what is deliberately
 * still literal, and how to re-check. The numbers below were measured, not
 * estimated: see "How this was measured" at the bottom.
 */

const SCORE = [
  ["Before", "224", "87", "39%", "Two in five painted surfaces ignored the skin."],
  ["After", "226", "2", "1%", "Both remaining are the grunge noise texture, which has no colour to follow."],
];

const VERDICT = [
  ["Colour", "Yes", "20 global properties plus 10 in the sales namespace."],
  ["Type scale", "Yes", "11 steps, each carrying its own line-height, tracking and weight."],
  ["Radius", "Yes", "--radius-card and --radius-media, plus a 3px control radius set inline."],
  ["Rhythm", "Yes", "section-pad, section-pad-sm, hero-pad, shell, and the two measures."],
  ["Motion", "Partly", "Durations and easings are written per animation. No timing tokens exist."],
  ["Spacing", "No", "Tailwind's default scale is used directly. There is no custom ramp, which is fine."],
  ["Shadow", "N/A", "The system uses glows, not shadows. There is nothing to tokenise."],
];

const FIXED = [
  [
    "Media grounds",
    "--media-ground",
    "bg-[#030303] in MediaFrame, the premade cards and the hero. The single biggest offender: it kept the hero block black through any reskin. The poster scrims that fade it out use --media-ground-rgb.",
  ],
  [
    "Primary button",
    "--btn-deep-top / -bottom / -hover",
    "Button.tsx wrote four hex values inline, so the most-used control on the site ignored the skin entirely.",
  ],
  [
    "Card ground",
    "--card-glass-top / -mid / -base",
    "card-glass, behind every Panel. Plus --edge-light for the top-edge highlight.",
  ],
  [
    "Ambient glows and tints",
    "--gold-rgb / --green-rgb / --blue-rgb",
    "35 call sites wrote the brand channels out by hand at their own alpha. They now compose rgba() from a shared triplet.",
  ],
  [
    "Animated rule, checkout panel, selection",
    "--gold / --green / --on-brand",
    "grad-line, checkout-panel and ::selection all restated the brand hues as literals.",
  ],
  [
    "Manifesto scroll animation",
    "read at runtime",
    "GSAP cannot tween var(), so three token colours were copied as hex. It now reads the resolved values from the DOM instead of holding copies.",
  ],
  [
    "Footer, team cards, hero sketch",
    "--footer-ground / --card-glass-mid / --sketch-line",
    "Three more one-off near-blacks and greys.",
  ],
];

const STILL_LITERAL = [
  [
    "PaymentMarks.tsx",
    "Visa, Mastercard, Amex, Google Pay",
    "Third-party brand marks. These must NOT follow a restyle: the card networks specify their colours and a recoloured Visa mark is a trademark problem, not a design choice.",
  ],
  [
    "GhlMark.tsx and ghl-glow",
    "#0098FD, #FFC503, #00D001",
    "The logo's own artwork, close to the brand tokens but deliberately not identical. The mark should not shift when a surface is reskinned.",
  ],
  [
    "grunge",
    "an SVG noise data URI",
    "Monochrome film grain. There is no colour in it to tokenise, which is why it is the only thing left standing in the measurement above.",
  ],
  [
    "The sales system",
    "the --sp-* namespace",
    "A deliberate second system with its own palette and radius, not a leak. Its --sp-grad still restates the gradient rather than referencing --brand-gradient, which is the one real item left there.",
  ],
];

const OPEN = [
  [
    "Four near-blacks",
    "#030303, #050505, #0a0a0a, #121212",
    "All named now, so all reskinnable, but they are close enough that a deliberate ground ramp would probably serve better than four separate names. A design call, worth making before the first reskin rather than during.",
  ],
  [
    "Two hairline greys",
    "--hair #2b2f40, --sketch-line #3a4157",
    "One step apart. Same question.",
  ],
  [
    "Paired hue tokens",
    "--gold and --gold-rgb",
    "The same colour declared twice, because CSS cannot take an alpha of a hex custom property without changing colour space. They have to be kept in step by hand.",
  ],
];

const METHOD = [
  [
    "Zero visual change",
    "17 pages, 0 differences",
    "Snapshotted 12 colour-bearing computed properties of every element on 17 pages, before and after, and diffed. The before pass ran against a verified pre-refactor stylesheet and the after pass against a verified post-refactor one.",
  ],
  [
    "Colour notation is normalised",
    "painted to sRGB bytes",
    "lab(), oklab(), color(srgb ...) and rgba() can all describe one colour. Each value is painted to a 1px canvas and compared as bytes, so the diff reports rendered result rather than spelling.",
  ],
  [
    "color-mix() was rejected",
    "wrong colour space",
    "The tidier modern way to take an alpha of a token. It serialises to color(srgb 0.988235 ...) instead of rgba(252, 192, 0, ...), so every glow would have moved. Hence the RGB triplets.",
  ],
  [
    "Transitions must be disabled to measure",
    "transition-colors does not repaint",
    "Swapping a custom property at runtime does not drive a CSS colour transition, so elements carrying transition-colors keep their old paint until the next real style recalc. They read as stuck when they are merely stale. The measurement disables transitions first, and a live concept board should reload rather than hot-swap.",
  ],
];

export default function LeaksPage() {
  assertDevOnly();
  return (
    <KitPage
      title="Leaks"
      lede="Values written as literals where a token was available. The named ones are now fixed: a full skin swap moves everything on the page except one monochrome texture. This page is the record of what was wrong, what is literal on purpose, and how to re-check."
    >
      <KitSection
        title="How much moves under a full skin swap"
        note="Measured on the live homepage by overriding every skin and brand property at once, which is what a concept board does, and counting the painted fills that stay put."
      >
        <KitTable
          head={["Pass", "Painted fills", "Unchanged", "Share", "Notes"]}
          rows={SCORE}
        />
        <div className="mt-4">
          <Note>
            The two survivors are both grunge, the film-grain data URI. It is
            monochrome, so there is nothing in it for a token to change. In
            practice every colour-bearing surface now follows the skin.
          </Note>
        </div>
      </KitSection>

      <KitSection
        title="Is the system variable-driven?"
        note="Colour, type, radius and rhythm all resolve through custom properties, and Tailwind v4 @utility is the mixin equivalent."
      >
        <KitTable head={["Concern", "Tokenised", "Detail"]} rows={VERDICT} />
      </KitSection>

      <KitSection
        title="Fixed"
        count={FIXED.length}
        note="Each of these used to hold its own literal. None of them changed appearance: the literals already matched the tokens they now read, which is what made the refactor safe to prove."
      >
        <KitTable head={["What", "Now reads", "Why it mattered"]} rows={FIXED} />
      </KitSection>

      <KitSection
        title="Literal on purpose"
        count={STILL_LITERAL.length}
        note="Not everything hardcoded is a mistake. Tokenising these would be the bug."
      >
        <KitTable head={["Where", "Value", "Why it is correct"]} rows={STILL_LITERAL} />
      </KitSection>

      <KitSection
        title="Open questions for the reskin"
        count={OPEN.length}
        note="Naming decisions the refactor deliberately did not make on its own, because they change the design vocabulary rather than just the plumbing."
      >
        <KitTable head={["Question", "Today", "The call to make"]} rows={OPEN} />
      </KitSection>

      <KitSection title="How this was measured">
        <KitTable head={["Property", "Result", "Detail"]} rows={METHOD} />
      </KitSection>

      <KitSection title="Re-run the audit">
        <p className="mb-3 text-[0.8125rem] leading-relaxed text-[var(--kit-dim)]">
          Finds any new hex literal that has crept into a component:
        </p>
        <pre className="overflow-x-auto rounded-[4px] border border-[var(--kit-line)] bg-[var(--kit-panel)] px-4 py-3 text-[0.75rem] leading-relaxed text-[var(--kit-text)]">
          <code>{`grep -rnE '#[0-9a-fA-F]{6}' components/ app/globals.css`}</code>
        </pre>
      </KitSection>
    </KitPage>
  );
}
