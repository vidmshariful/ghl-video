import { Eyebrow } from "@/components/Eyebrow";
import { Panel } from "@/components/Panel";
import { RuledBox } from "@/components/RuledBox";
import { SectionHead } from "@/components/SectionHead";
import { KitPage, KitSection, KitTable, Note, Spec, SpecGrid } from "@/components/uikits/kit";
import { assertDevOnly } from "@/components/uikits/dev-only";

/*
 * Containers and compositions. The very large page-level pieces (Hero,
 * PremadeLibrary, Header, Footer, the checkout form) are listed rather than
 * embedded: they pull live data, own scroll behaviour, or take over the
 * viewport, and a gallery that renders them stops being a gallery.
 */

const PAGE_LEVEL = [
  ["Header", "components/Header.tsx", "Sticky nav. Hides on scroll down when the premade library asks it to."],
  ["Footer", "components/Footer.tsx", "Carries the brand line and the HighLevel disclaimer."],
  ["NoticeBar", "components/NoticeBar.tsx", "Dismissible strip above the header, remembered in localStorage."],
  ["Hero", "components/home/Hero.tsx", "The one orchestrated motion moment on the site."],
  ["HeroAtmosphere", "components/HeroAtmosphere.tsx", "Hero-scoped film grain and ambient glow."],
  ["PremadeLibrary", "components/PremadeLibrary.tsx", "The full catalogue browser. Owns its own sticky tab bar."],
  ["QuoteForm", "components/QuoteForm.tsx", "Posts to /api/quote."],
  ["StudioRequestForm", "components/StudioRequestForm.tsx", "The studio intake."],
  ["BookingCalendars", "components/BookingCalendars.tsx", "LeadConnector embeds."],
  ["ChatThread", "components/chat/ChatThread.tsx", "Portal and admin messaging. Polls on purpose."],
  ["ScrollRuler", "components/ScrollRuler.tsx", "The blueprint edge rule."],
  ["PageFrame", "components/PageFrame.tsx", "The rails the marketing pages sit inside."],
  ["Watermark", "components/Watermark.tsx", "Scroll-linked closing mark."],
];

const MOTION = [
  ["Reveal / RevealItem", "components/Reveal.tsx", "The only sanctioned scroll reveal. Staggers children by 80ms. Never scatter fade-ups across every element."],
  ["DrawnBorder", "components/DrawnBorder.tsx", "A hairline that draws itself in from the left, once."],
  ["DrawnArt / DrawnIcon", "components/DrawnArt.tsx", "Stroke-draw illustration and icons."],
  ["Marquee", "components/Marquee.tsx", "Horizontal loop, 42s, pauses on hover."],
  ["ProcessArt", "components/pages/ProcessArt.tsx", "The step illustrations. 14 named ps-anim-* micro movements, all gated."],
  ["SectionGradient", "components/SectionGradient.tsx", "Ambient section wash."],
];

export default function PatternsPage() {
  assertDevOnly();
  return (
    <KitPage
      title="Patterns"
      lede="Containers, section furniture and the motion vocabulary. Page-level pieces are catalogued rather than rendered, for the reasons noted below."
    >
      <KitSection
        title="Panel"
        count="2 grounds"
        note="The card container. Glass is the default: a near-black vertical gradient with a whisper of top-edge light. Solid drops to flat canvas, so elevation stays reserved for the hero and for true offers. Corner ticks are on by default."
      >
        <SpecGrid cols={2}>
          <Spec label="GLASS, TICKS ON" code="<Panel>...</Panel>">
            <div className="w-full">
              <Panel className="p-6">
                <Eyebrow accent="gold">Included</Eyebrow>
                <h3 className="mt-2 font-display text-h4 text-ink">Script and storyboard</h3>
                <p className="mt-2 text-body-sm text-muted">
                  Written for your product, not filled into a template.
                </p>
              </Panel>
            </div>
          </Spec>
          <Spec label="SOLID, TICKS OFF" code="<Panel solid ticks={false}>...</Panel>">
            <div className="w-full">
              <Panel solid ticks={false} className="p-6">
                <Eyebrow accent="green">Feature</Eyebrow>
                <h3 className="mt-2 font-display text-h4 text-ink">Two revision rounds</h3>
                <p className="mt-2 text-body-sm text-muted">
                  Notes in the portal, timestamped to the frame.
                </p>
              </Panel>
            </div>
          </Spec>
        </SpecGrid>
      </KitSection>

      <KitSection title="Ruled box" note="The blueprint container: hairline rules, no fill.">
        <Spec label="RULED BOX" code="<RuledBox>...</RuledBox>">
          <div className="w-full">
            <RuledBox className="p-6">
              <p className="text-body text-muted">
                A quieter container for supporting content, where a card
                would claim more attention than the content deserves.
              </p>
            </RuledBox>
          </div>
        </Spec>
      </KitSection>

      <KitSection
        title="Section head"
        note="The standard section opener: numbered chip, headline with one accent phrase, optional intro. The accent word renders in the signature gradient."
      >
        <Spec label="SECTION HEAD" code='<SectionHead index={3} chip="How it works" headline="From brief to" accent="finished video" intro="..." />'>
          <div className="w-full">
            <SectionHead
              index={3}
              chip="How it works"
              headline="From brief to"
              accent="finished video"
              intro="Four steps, five working days, and you never open an editor."
            />
          </div>
        </Spec>
      </KitSection>

      <KitSection
        title="Surface grounds"
        note="The four ground values, shown stacked so the steps between them are visible. Every card in the system sits on one of these."
      >
        <Spec label="CANVAS, SURFACE, CARD, HAIRLINE">
          <div className="flex w-full flex-col gap-0 overflow-hidden rounded-card border border-hair">
            {[
              ["bg-canvas", "canvas, the page ground"],
              ["bg-surface", "surface, one step up"],
              ["bg-card", "card, the top step"],
            ].map(([cls, label]) => (
              <div key={cls} className={`${cls} border-b border-hair px-5 py-4 last:border-0`}>
                <span className="text-body-sm text-muted">{label}</span>
              </div>
            ))}
          </div>
        </Spec>
      </KitSection>

      <KitSection
        title="Gradient treatments"
        count="3"
        note="The signature, in its three sanctioned forms. It is the one highlight treatment on the site, which is why it does not appear on everything."
      >
        <SpecGrid cols={3}>
          <Spec label="TEXT" code="className=&quot;text-gradient&quot;">
            <span className="font-display text-h3 text-gradient">finished video</span>
          </Spec>
          <Spec label="FILL" code="className=&quot;bg-brand-gradient&quot;">
            <div className="h-12 w-full rounded-[3px] bg-brand-gradient" />
          </Spec>
          <Spec label="ANIMATED RULE" code="className=&quot;grad-line&quot;">
            <div className="grad-line h-px w-full" />
          </Spec>
        </SpecGrid>
      </KitSection>

      <KitSection
        title="Textures"
        count="3"
        note="Soft radial glows over drop shadows, always. There are no box shadows in the elevation system."
      >
        <SpecGrid cols={3}>
          <Spec label="HATCH">
            <div className="hatch h-16 w-full" />
          </Spec>
          <Spec label="GRUNGE, HERO ONLY">
            <div className="grunge h-16 w-full bg-surface" />
          </Spec>
          <Spec label="CARD GLASS">
            <div className="card-glass h-16 w-full rounded-card border border-hair" />
          </Spec>
        </SpecGrid>
      </KitSection>

      <KitSection
        title="Motion vocabulary"
        count="6"
        note="GSAP plus Framer Motion. Every animation in the system sits behind a prefers-reduced-motion gate, and print forces reveals visible so a PDF capture never loses content."
      >
        <KitTable head={["Piece", "File", "Behaviour"]} rows={MOTION} />
      </KitSection>

      <KitSection
        title="Page-level pieces"
        count="13"
        note="Catalogued, not embedded. These fetch live data, own scroll or viewport behaviour, or take over the page."
      >
        <KitTable head={["Component", "File", "Note"]} rows={PAGE_LEVEL} />
      </KitSection>

      <Note tone="warn">
        SectionGlow is a no-op: it takes a position prop, ignores it, and
        returns null. It is still imported at its call sites. Worth deleting
        or reviving, but not silently leaving in the inventory as if it
        renders something.
      </Note>
    </KitPage>
  );
}
