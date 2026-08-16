import { Button } from "@/components/Button";
import { Eyebrow } from "@/components/Eyebrow";
import { Panel } from "@/components/Panel";
import { KitPage, KitSection, KitTable, Note } from "@/components/uikits/kit";
import { Swatch } from "@/components/uikits/live";
import { assertDevOnly } from "@/components/uikits/dev-only";

/*
 * All four skins on one screen. This is the page the four-surface rule was
 * built for: the same content, rendered under each skin, so a change to one
 * can be seen against the other three at a glance.
 */

const SKIN_VARS = ["--canvas", "--surface", "--card", "--hair", "--text", "--muted", "--dim"];

const RULES = [
  [
    "Shared by all four",
    "The brand core: gold, blue, green, the gradient, both glows, --error, the two typefaces. Plus the top-level shared components: Logo, GhlMark, chat.",
  ],
  [
    "Never shared",
    "Surface UI. ESLint fails the build if the site imports checkout components, the portals import marketing components, and so on in every direction.",
  ],
  [
    "How to restyle one",
    "Edit only that surface's block in globals.css. To fork more than colour, add the variable to the block and point the @theme mapping at it the same way.",
  ],
  [
    "The kit's exemption",
    "This page imports from every surface at once, which no shipping code may do. It is allowed because /uikits 404s outside development.",
  ],
];

/* The same three elements, rendered once per skin. */
function Specimen() {
  return (
    <div className="bg-canvas p-6">
      <Eyebrow accent="gold">Order summary</Eyebrow>
      <h3 className="mt-2 font-display text-h3 text-ink">Explainer video</h3>
      <p className="mt-2 max-w-[52ch] text-body text-muted">
        Five working days from the brief, two revision rounds included.
      </p>
      <p className="mt-1 text-body-sm text-dim">Delivered as MP4 and captions.</p>
      <Panel className="mt-5 p-4">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-body text-muted">Total</span>
          <span className="text-price text-ink">$1,495</span>
        </div>
      </Panel>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button href="#" variant="gradient" size="md">Order Now</Button>
        <Button href="#" variant="ghost" size="md">Request a Quote</Button>
      </div>
    </div>
  );
}

function SkinColumn({
  name,
  routes,
  surface,
  theme,
}: {
  name: string;
  routes: string;
  surface?: "portal" | "checkout";
  theme?: "light";
}) {
  const inner = (
    <>
      <div className="grid grid-cols-4 gap-3 border-b border-hair bg-canvas px-6 pt-6 pb-5">
        {SKIN_VARS.slice(0, 4).map((v) => (
          <Swatch key={v} name={v} label={v.replace("--", "")} />
        ))}
      </div>
      <Specimen />
    </>
  );

  return (
    <div className="overflow-hidden rounded-[4px] border border-[var(--kit-line)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--kit-line)] bg-[var(--kit-panel)] px-4 py-2.5">
        <span className="text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--kit-text)]">
          {name}
        </span>
        <span className="text-[0.625rem] text-[var(--kit-dim)]">{routes}</span>
      </div>
      {/* The light theme's selector is `[data-theme="light"] [data-surface="portal"]`,
          a DESCENDANT combinator: in production data-theme lands on <html> and the
          portal wrapper sits inside it. Both attributes on one element does not
          match, so the theme has to be an ancestor here too. */}
      {surface ? (
        theme ? (
          <div data-theme={theme}>
            <div data-surface={surface}>{inner}</div>
          </div>
        ) : (
          <div data-surface={surface}>{inner}</div>
        )
      ) : (
        inner
      )}
    </div>
  );
}

export default function SurfacesPage() {
  assertDevOnly();
  return (
    <KitPage
      title="Surfaces"
      lede="One piece of content, rendered under each skin. The three dark skins are deliberately identical today: the surfaces match now, and the separation exists so they can diverge later without leaking into each other."
    >
      <KitSection title="The rule">
        <KitTable head={["Aspect", "How it works"]} rows={RULES} />
      </KitSection>

      <KitSection title="Site skin" note=":root defaults. The marketing pages.">
        <SkinColumn name="MAIN SITE" routes="app/(site)" />
      </KitSection>

      <KitSection
        title="Portal skin"
        note='[data-surface="portal"]. Serves /admin, /portal and /partners.'
      >
        <SkinColumn name="PORTALS, DARK" routes="/admin, /portal, /partners" surface="portal" />
      </KitSection>

      <KitSection
        title="Portal light theme"
        count="the only light theme in the system"
        note="The portal top bar stamps data-theme on <html>, persisted in localStorage and applied pre-paint so there is no flash. Only the portal surface responds; the other three are untouched. Buttons on bright brand fills keep near-black text in both themes, which is why .text-canvas is overridden rather than allowed to flip."
      >
        <SkinColumn
          name="PORTALS, LIGHT"
          routes='data-theme="light"'
          surface="portal"
          theme="light"
        />
      </KitSection>

      <KitSection title="Checkout skin" note='[data-surface="checkout"]. The money path.'>
        <SkinColumn name="CHECKOUT" routes="/checkout" surface="checkout" />
        <div className="mt-4 overflow-hidden rounded-[4px] border border-[var(--kit-line)]">
          <div className="border-b border-[var(--kit-line)] bg-[var(--kit-panel)] px-4 py-2.5 text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--kit-text)]">
            CHECKOUT PANEL, THE ONE ELEVATED SURFACE
          </div>
          <div data-surface="checkout" className="bg-canvas p-6">
            <div className="checkout-panel rounded-card border border-hair p-6">
              <Eyebrow accent="gold">Secure checkout</Eyebrow>
              <p className="mt-2 max-w-[52ch] text-body text-muted">
                A restrained brand wash over canvas, so it leads the eye as
                the thing to act on without fighting the dark form fields
                sitting on top of it.
              </p>
            </div>
          </div>
        </div>
      </KitSection>

      <Note>
        The sales pages are the fourth surface and do not appear here,
        because they share none of these variables. They have their own
        namespace, their own radius and their own rhythm. See the Sales
        system page.
      </Note>
    </KitPage>
  );
}
