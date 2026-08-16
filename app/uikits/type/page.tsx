import { KitPage, KitSection, KitTable, Note } from "@/components/uikits/kit";
import { TypeRow } from "@/components/uikits/live";
import { assertDevOnly } from "@/components/uikits/dev-only";

/* The scale, rendered at whatever size the current viewport resolves it to.
 * Several steps are clamp() based, so resize the window and the readouts
 * move with it. That is the honest way to show a fluid scale. */

const FACES = [
  [
    "Archivo",
    "--font-display",
    "next/font/google",
    "Display only. Weight 600, tight tracking. Headlines and nothing else.",
  ],
  [
    "Raveo Display",
    "--font-body",
    "app/fonts, 4 weights",
    "Body, labels, and the wide-tracked microtype. Self-hosted, SIL OFL 1.1.",
  ],
  [
    "(mono slot)",
    "--font-mono",
    "aliased to body",
    "There is no third typeface. font-mono resolves to Raveo by client direction, so utility labels stay in the body face.",
  ],
] as const;

const ROOT_SCALE = [
  ["Under 1024px", "browser default", "Usually 16px. Readability wins on small screens."],
  ["1024px and up", "clamp(14px, 9.5px + 0.4vw, 17px)", "A laptop lands near 15.3px, the approved density."],
  ["Form fields under 1024px", "1rem forced", "iOS Safari zooms the viewport on any field under 16px."],
] as const;

export default function TypePage() {
  assertDevOnly();
  return (
    <KitPage
      title="Type"
      lede="Eleven steps, two typefaces. The whole design is rem-based off a fluid root, so the numbers below are what this viewport resolved, right now."
    >
      <KitSection title="Typefaces" count="2">
        <KitTable head={["Face", "Variable", "Loaded by", "Role"]} rows={FACES} />
      </KitSection>

      <KitSection
        title="The scale"
        count="11 steps"
        note="Each step carries its own line-height, tracking and weight in the @theme block, so text-hero is one class and not four."
      >
        <div className="rounded-[4px] border border-[var(--kit-line)] bg-[var(--kit-panel)] px-5">
          <TypeRow
            name="text-hero"
            className="font-display text-hero"
            sample="Video that sells the software"
          />
          <TypeRow
            name="text-h2"
            className="font-display text-h2"
            sample="Section headline voice"
          />
          <TypeRow
            name="text-h3"
            className="font-display text-h3"
            sample="Subsection headline voice"
          />
          <TypeRow
            name="text-h4"
            className="font-display text-h4"
            sample="The card and cell title voice"
          />
          <TypeRow
            name="text-lede"
            className="text-lede"
            sample="The opening paragraph under a hero, capped at the lede measure so it stays in the comfortable reading band."
          />
          <TypeRow
            name="text-body"
            className="text-body"
            sample="The running text size, and the only one. The site used to ship 14px and 15px side by side, a pixel apart, in the same layouts."
          />
          <TypeRow
            name="text-body-sm"
            className="text-body-sm"
            sample="Dense secondary text only: card subtitles, notes, fine print."
          />
          <TypeRow name="text-price" className="text-price" sample="$1,495" />
          <TypeRow name="text-stat-lg" className="text-stat-lg" sample="1000+" />
          <TypeRow
            name="text-label"
            className="text-label"
            sample="WIDE TRACKED MICROLABEL"
          />
        </div>
      </KitSection>

      <KitSection title="Measures" count="2">
        <div className="flex flex-col gap-4">
          <div className="rounded-[4px] border border-[var(--kit-line)] bg-[var(--kit-panel)] p-5">
            <div className="mb-2 text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--kit-accent)]">
              --measure-lede, 52ch
            </div>
            <p className="text-lede text-ink" style={{ maxWidth: "var(--measure-lede)" }}>
              The lede measure. Wide enough to carry an opening thought,
              narrow enough that the eye returns to the right place without
              hunting for the next line.
            </p>
          </div>
          <div className="rounded-[4px] border border-[var(--kit-line)] bg-[var(--kit-panel)] p-5">
            <div className="mb-2 text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--kit-accent)]">
              --measure-body, 68ch
            </div>
            <p className="text-body text-ink" style={{ maxWidth: "var(--measure-body)" }}>
              The body measure. Prose caps had drifted to nine different
              values between 26ch and 72ch, which squeezed some columns to
              roughly 32 characters a line and let others run past 80. Both
              ends sit outside the 60 to 75 a reader wants, so the system
              carries two measures and only two. Inside a narrow grid cell
              the cap goes inert and the column does the work.
            </p>
          </div>
        </div>
      </KitSection>

      <KitSection title="Root scale">
        <KitTable head={["Viewport", "html font-size", "Why"]} rows={ROOT_SCALE} />
      </KitSection>

      <Note>
        Headings carry text-wrap: balance and paragraphs carry text-wrap:
        pretty, so display type never strands a single word on its last line.
        Both are set globally on h1, h2, h3 and p rather than per component.
      </Note>
    </KitPage>
  );
}
