import Link from "next/link";
import { KitPage, KitSection, KitTable, Note } from "@/components/uikits/kit";
import { assertDevOnly } from "@/components/uikits/dev-only";

/* The index: what this system is made of, counted and named. Every row here
 * is something that exists in the repo today, not something planned. */

const LAYERS = [
  [
    "1. Brand core",
    "app/globals.css :root",
    "Custom properties shared by every surface: the three brand colours, the signature gradient, the two ambient glows, --error, the two reading measures.",
  ],
  [
    "2. Surface skins",
    ":root + [data-surface]",
    "canvas / surface / card / hair / text / muted / dim, redeclared per surface. Edit one block, restyle one surface, no leak.",
  ],
  [
    "3. Tailwind bridge",
    "@theme inline",
    "Maps the properties above onto utility classes, so --gold reaches markup as bg-gold and text-gold. Also carries radius and the whole type scale.",
  ],
  [
    "4. Utilities",
    "@utility",
    "The mixin equivalent in Tailwind v4. Thirteen of them: layout rhythm, the gradient treatments, textures, the animated brand line.",
  ],
  [
    "5. Sales system",
    "app/(sales)/sales.css",
    "A separate namespace, --sp-* inside .sp, with its own palette, radius and rhythm. Shares only the brand hues.",
  ],
] as const;

const SURFACES = [
  ["Main site", "app/(site)", ":root defaults", "Marketing pages, blog, legal"],
  [
    "Portals",
    "/admin, /portal, /partners",
    '[data-surface="portal"]',
    "Plus the only light theme in the system",
  ],
  ["Checkout", "/checkout", '[data-surface="checkout"]', "The money path"],
  ["Sales", "app/(sales)", ".sp in sales.css", "Campaign landing pages"],
] as const;

const INVENTORY = [
  [
    "Shared components",
    "44",
    "components/*.tsx",
    "Button, Panel, Eyebrow, SectionHead, MediaFrame, Stat, Avatar, Marquee, Reveal, DrawnIcon and the rest. Importable from any surface.",
  ],
  [
    "Home sections",
    "16",
    "components/home",
    "Hero, Manifesto, ServicePanels, Comparison, Testimonials, TrustStrip, ClientWall, TeamSection, Faq and siblings.",
  ],
  [
    "Page sections",
    "9",
    "components/pages",
    "PageHero, ProcessSection, ProcessArt, ProofStrip, CrossSell, GetStarted, WhiteLabelDemo, FeaturedQuote, LaunchCountdown.",
  ],
  [
    "Premade library",
    "8 files, 20 exports",
    "components/premade",
    "VideoBrowser, LibraryCard, PosterPlay, PreviewLightbox, BundleView, PackTile, FeaturePriceCard and the filter chrome.",
  ],
  [
    "Portal chrome",
    "5 files, 17 exports",
    "components/portal",
    "PortalTopbar, PortalSidebar, ProfileMenu, NotificationsBell, ThemeToggle, AvatarUploader, TeamCard, the booking views.",
  ],
  [
    "Checkout",
    "5",
    "components/checkout",
    "CheckoutHeader, CheckoutProgress, CheckoutTrust, PaymentMarks, SecurePaymentsBand.",
  ],
  [
    "Sales",
    "3",
    "components/sales",
    "PartnerLanding, MultiPartnerLanding, SpVideo. The look lives in CSS classes, not components.",
  ],
  ["Chat", "1", "components/chat", "ChatThread, shared by portal and admin."],
] as const;

const CSS_ASSETS = [
  ["Custom properties", "27", "17 global, 10 in the sales namespace"],
  ["Tailwind @theme entries", "40+", "colours, fonts, radius, 11 type steps"],
  ["@utility mixins", "13", "shell, section-pad, text-gradient, hatch, and more"],
  ["Keyframe animations", "21", "all of them behind a reduced-motion gate"],
  ["Sales .sp classes", "150", "a full parallel system"],
  ["Icons", "15", "one curated lucide set, stroke-drawn, 4 tones"],
] as const;

export default function UikitsOverview() {
  assertDevOnly();
  return (
    <KitPage
      title="What this system is made of"
      lede="A live gallery of every element the platform renders. Everything here imports the real production component or reads the real CSS variable, so it cannot drift from what ships. Dev only: this route 404s outside development."
    >
      <KitSection
        title="The system is variable-driven, in five layers"
        note="Answering the question directly: yes. Colour, type, radius, rhythm and motion all resolve through custom properties, and Tailwind v4 utilities are the mixin equivalent. The exceptions are on the Leaks page."
      >
        <KitTable head={["Layer", "Where", "What it carries"]} rows={LAYERS} />
      </KitSection>

      <KitSection
        title="Four surfaces, four skins"
        note="Each non-site layout stamps data-surface on its wrapper, and lint rules stop one surface importing another's UI. Restyling one surface means editing one block."
      >
        <KitTable
          head={["Surface", "Routes", "Skin", "Notes"]}
          rows={SURFACES}
        />
      </KitSection>

      <KitSection title="Component inventory" count="95 files">
        <KitTable
          head={["Group", "Count", "Path", "What is in it"]}
          rows={INVENTORY}
        />
      </KitSection>

      <KitSection title="CSS inventory">
        <KitTable head={["Asset", "Count", "Notes"]} rows={CSS_ASSETS} />
      </KitSection>

      <KitSection title="Where to go next">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {[
            ["/uikits/tokens", "Every colour, glow, measure and radius, read live from the DOM, with contrast ratios."],
            ["/uikits/type", "The eleven type steps at their real rendered sizes."],
            ["/uikits/primitives", "Buttons, eyebrows, chips, icons, avatars, stats, lists."],
            ["/uikits/patterns", "Panels, ruled boxes, section heads, media frames, cards."],
            ["/uikits/surfaces", "All four skins side by side on one screen."],
            ["/uikits/sales", "The .sp system, the separate one."],
            ["/uikits/leaks", "Hardcoded values that will NOT follow a restyle. Read this before changing the look."],
          ].map(([href, desc]) => (
            <Link
              key={href}
              href={href}
              className="rounded-[4px] border border-[var(--kit-line)] bg-[var(--kit-panel)] p-4 transition-colors hover:border-[var(--kit-accent)]"
            >
              <div className="text-[0.8125rem] font-semibold text-[var(--kit-text)]">
                {href}
              </div>
              <div className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--kit-dim)]">
                {desc}
              </div>
            </Link>
          ))}
        </div>
      </KitSection>

      <Note tone="warn">
        Every route here 404s outside development, and the guard runs in each
        page rather than only in the layout: a layout and its page render in
        parallel, so guarding the layout alone produced a 404 whose response
        body still carried the whole kit inside its RSC payload. The route
        files are still built and uploaded, they are simply unreachable and
        render nothing. Removing them from the bundle needs a build-time
        exclusion, which is not wired up.
      </Note>
    </KitPage>
  );
}
