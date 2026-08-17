import { KitPage, KitSection, KitTable, Note } from "@/components/uikits/kit";
import { ContrastRow, Swatch } from "@/components/uikits/live";
import { assertDevOnly } from "@/components/uikits/dev-only";

/* Every value on this page is read out of the DOM at runtime by the Swatch
 * and ContrastRow components, never typed in by hand. Edit globals.css and
 * this page changes with it. */

function SwatchRow({
  vars,
  surface,
}: {
  vars: readonly (readonly [string, string])[];
  surface?: "portal" | "checkout";
}) {
  const grid = (
    <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-4">
      {vars.map(([name, label]) => (
        <Swatch key={name} name={name} label={label} />
      ))}
    </div>
  );
  return (
    <div className="rounded-[4px] border border-[var(--kit-line)] bg-[var(--kit-panel)]">
      {surface ? <div data-surface={surface}>{grid}</div> : grid}
    </div>
  );
}

const BRAND = [
  ["--gold", "Gold"],
  ["--blue", "Blue"],
  ["--green", "Green"],
  ["--error", "Error"],
  ["--brand-gradient", "Signature gradient"],
  ["--glow-gold", "Glow, gold"],
  ["--glow-green", "Glow, green"],
] as const;

const SKIN = [
  ["--canvas", "Canvas"],
  ["--surface", "Surface"],
  ["--card", "Card"],
  ["--hair", "Hairline"],
  ["--text", "Text"],
  ["--muted", "Muted"],
  ["--dim", "Dim"],
] as const;

const GROUNDS = [
  ["--ground-deep", "Video wells, the footer, the base of card-glass"],
  ["--ground-mid", "Flat dark cards, and the card-glass midpoint"],
  ["--ground-top", "The lit crown of card-glass"],
] as const;

const UTILITIES = [
  ["shell", "width: min(100% - 3rem, 77.5rem), centred. The page container."],
  ["section-pad", "padding-block: clamp(5rem, 8vw, 7.5rem). The standard section rhythm."],
  ["section-pad-sm", "clamp(4rem, 5.5vw, 5rem). Short utility sections."],
  ["hero-pad", "padding-top: clamp(9rem, 11vw, 10rem). Clears the sticky header."],
  ["text-gradient", "The signature gradient as text fill, cloned across wrapped lines."],
  ["bg-brand-gradient", "The signature gradient as a background."],
  ["grad-line", "The animated gradient rule. 4s linear loop."],
  ["hatch", "Sparse 135deg blueprint hatch for divider strips."],
  ["card-glass", "Card ground: near-black vertical gradient with a top-edge highlight."],
  ["grunge", "Film grain, scoped to the hero only."],
  ["checkout-panel", "The one elevated surface on the money path: brand wash over canvas."],
  ["progress-glow-a / -b", "The paired sweep that carries one light across the checkout progress bar."],
] as const;

const RHYTHM = [
  ["--measure-lede", "52ch", "Lede paragraphs."],
  ["--measure-body", "68ch", "Running body copy. Only two measures exist, on purpose."],
  ["--rail-gutter", "computed", "The strip between a page-frame rail and the shell edge."],
  ["--radius-card", "4px", "Containers. rounded-card."],
  ["--radius-media", "4px", "Media. rounded-media."],
  ["(controls)", "3px", "Buttons and inputs, set inline as rounded-[3px]."],
  ["rounded-full", "—", "Dots and avatars only. No other radii exist in the system."],
] as const;

export default function TokensPage() {
  assertDevOnly();
  return (
    <KitPage
      title="Tokens"
      lede="Read live from the DOM at runtime, so these are the values the browser actually resolved, not a table somebody kept up to date by hand."
    >
      <KitSection
        title="Brand core"
        count="7"
        note="Shared by every surface. Changing one of these changes the whole platform, which is the point."
      >
        <SwatchRow vars={BRAND} />
      </KitSection>

      <KitSection
        title="Site skin"
        count="7"
        note="The :root defaults, which the main marketing site uses directly."
      >
        <SwatchRow vars={SKIN} />
      </KitSection>

      <KitSection
        title="Portal skin"
        count="7"
        note='The same seven property names redeclared inside [data-surface="portal"]. Identical to the site today by design: the surfaces match now, and the separation exists so they can diverge later without leaking.'
      >
        <SwatchRow vars={SKIN} surface="portal" />
      </KitSection>

      <KitSection title="Checkout skin" count="7">
        <SwatchRow vars={SKIN} surface="checkout" />
      </KitSection>

      <KitSection
        title="Ground ramp"
        count="3"
        note="Everything darker than canvas. Neutral grey, where the skin ramp above is cool-tinted: a video well and a card crown should read as true black rather than as a darker blue. Consolidated from five near-blacks that sat a pixel or two apart, which is drift with names on rather than a palette."
      >
        <SwatchRow vars={GROUNDS} />
        <div className="mt-4">
          <Note>
            --ground-deep is deliberately not --canvas. The gap between #030303
            and #08090d is what lets a dark video edge disappear into its well
            instead of showing a seam.
          </Note>
        </div>
      </KitSection>

      <KitSection
        title="Contrast"
        note="The dim and muted greys were lifted twice specifically to clear these bars. A restyle can undo that silently, so the kit checks it every time the page loads. Small text needs 4.5, large text and UI edges need 3."
      >
        <div className="overflow-x-auto rounded-[4px] border border-[var(--kit-line)]">
          <table className="w-full border-collapse text-left text-[0.8125rem]">
            <thead>
              <tr className="bg-[var(--kit-panel)]">
                {["Foreground", "Ground", "Ratio", "Bar", "Result"].map((h) => (
                  <th
                    key={h}
                    className="border-b border-[var(--kit-line)] px-4 py-2.5 text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--kit-dim)]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <ContrastRow fg="--text" bg="--canvas" />
              <ContrastRow fg="--text" bg="--surface" />
              <ContrastRow fg="--text" bg="--card" />
              <ContrastRow fg="--muted" bg="--canvas" />
              <ContrastRow fg="--muted" bg="--card" />
              <ContrastRow fg="--dim" bg="--canvas" />
              <ContrastRow fg="--dim" bg="--surface" />
              <ContrastRow fg="--dim" bg="--card" />
              <ContrastRow fg="--gold" bg="--canvas" />
              <ContrastRow fg="--green" bg="--canvas" />
              <ContrastRow fg="--blue" bg="--canvas" bar={3} />
              <ContrastRow fg="--error" bg="--canvas" />
              <ContrastRow fg="--hair" bg="--canvas" bar={3} />
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <Note>
            A failing row is not automatically a bug. The hairline is a
            decorative edge rather than a control boundary, and blue is used
            at large sizes. Read a FAIL as a prompt to check where the colour
            is actually used.
          </Note>
        </div>
      </KitSection>

      <KitSection
        title="Utilities, the mixin layer"
        count="13"
        note="Tailwind v4 @utility is what this system uses in place of Sass mixins. Each one is a named, reusable block declared once in globals.css and applied as a class."
      >
        <KitTable head={["Class", "What it does"]} rows={UTILITIES} />
      </KitSection>

      <KitSection title="Rhythm and radius">
        <KitTable head={["Token", "Value", "Use"]} rows={RHYTHM} />
      </KitSection>
    </KitPage>
  );
}
