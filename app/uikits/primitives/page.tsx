import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Checklist } from "@/components/Checklist";
import { DrawnIcon } from "@/components/DrawnIcon";
import { Eyebrow } from "@/components/Eyebrow";
import { GhlMark } from "@/components/GhlMark";
import { Logo } from "@/components/Logo";
import { RuleList } from "@/components/RuleList";
import { SectionChip } from "@/components/SectionChip";
import { Stat } from "@/components/Stat";
import { KitPage, KitSection, Note, Spec, SpecGrid } from "@/components/uikits/kit";
import { assertDevOnly } from "@/components/uikits/dev-only";

/* Real components, real props. Nothing here is a mock-up of a button. */

const ICONS = [
  "building",
  "clapperboard",
  "clock",
  "crosshair",
  "globe",
  "layout",
  "lock",
  "message",
  "mic",
  "palette",
  "scissors",
  "send",
  "tags",
  "upload",
  "zap",
] as const;

const TONES = ["gold", "ink", "muted", "dim"] as const;

export default function PrimitivesPage() {
  assertDevOnly();
  return (
    <KitPage
      title="Primitives"
      lede="The small, reusable pieces. Every specimen below is the production component imported directly, so what you see is what ships."
    >
      <KitSection
        title="Button"
        count="4 variants, 2 sizes"
        note="One button system. gradient is the signature and is reserved for the page's money moments, the hero CTA and the closing CTA. primary (aliased hero) is the deep body button, ghost is the quiet secondary. Every button carries the arrow, and buttons on bright fills use near-black text."
      >
        <SpecGrid cols={2}>
          <Spec label="GRADIENT, LG" code='<Button href="#" variant="gradient">Order Now</Button>'>
            <Button href="#" variant="gradient">Order Now</Button>
          </Spec>
          <Spec label="PRIMARY, LG" code='<Button href="#" variant="primary">Book a Call</Button>'>
            <Button href="#" variant="primary">Book a Call</Button>
          </Spec>
          <Spec label="GHOST, LG" code='<Button href="#" variant="ghost">Request a Quote</Button>'>
            <Button href="#" variant="ghost">Request a Quote</Button>
          </Spec>
          <Spec label="SIZE MD, ALL VARIANTS" code='size="md"'>
            <Button href="#" variant="gradient" size="md">Order Now</Button>
            <Button href="#" variant="primary" size="md">Book a Call</Button>
            <Button href="#" variant="ghost" size="md">Start editing</Button>
          </Spec>
        </SpecGrid>
        <div className="mt-4">
          <Note tone="warn">
            The primary and hero variants paint their fill from four raw hex
            values written into Button.tsx, not from skin tokens. They will
            not follow a restyle. See the Leaks page.
          </Note>
        </div>
      </KitSection>

      <KitSection
        title="Eyebrow"
        count="4 accents"
        note="The wide-tracked label above a headline. One accent leads per section, so pick the accent that section is already leading with."
      >
        <Spec label="ALL ACCENTS" code='<Eyebrow accent="gold">Label</Eyebrow>'>
          <Eyebrow accent="gold">Gold</Eyebrow>
          <Eyebrow accent="green">Green</Eyebrow>
          <Eyebrow accent="blue">Blue</Eyebrow>
          <Eyebrow accent="muted">Muted</Eyebrow>
        </Spec>
      </KitSection>

      <KitSection title="Section chip" note="The numbered marker that opens a section.">
        <Spec label="WITH AND WITHOUT INDEX" code='<SectionChip index={2} label="How it works" />'>
          <SectionChip index={1} label="What you get" />
          <SectionChip index={2} label="How it works" />
          <SectionChip label="No index" />
        </Spec>
      </KitSection>

      <KitSection
        title="Icons"
        count="15 glyphs, 4 tones"
        note="One curated lucide set, no icon dumps. Each glyph is stroke-drawn: every shape carries pathLength=1, so a single dasharray rule animates any of them when the icon enters the viewport or its cell is hovered. Reduced motion renders them complete."
      >
        <Spec label="THE FULL SET, GOLD" code='<DrawnIcon name="clapperboard" size={26} tone="gold" />'>
          {ICONS.map((name) => (
            <span key={name} className="flex flex-col items-center gap-1.5">
              <DrawnIcon name={name} />
              <span className="text-[0.625rem] text-[var(--kit-dim)]">{name}</span>
            </span>
          ))}
        </Spec>
        <div className="mt-4">
          <Spec label="TONES" code='tone="gold" | "ink" | "muted" | "dim"'>
            {TONES.map((tone) => (
              <span key={tone} className="flex flex-col items-center gap-1.5">
                <DrawnIcon name="zap" tone={tone} size={30} />
                <span className="text-[0.625rem] text-[var(--kit-dim)]">{tone}</span>
              </span>
            ))}
          </Spec>
        </div>
      </KitSection>

      <KitSection title="Brand marks" count="2">
        <SpecGrid cols={2}>
          <Spec label="LOGO" code='<Logo className="h-7" />'>
            <Logo className="h-7" />
          </Spec>
          <Spec
            label="GHL MARK"
            code='<GhlMark className="h-12" />'
          >
            <GhlMark className="h-12 w-auto" />
          </Spec>
        </SpecGrid>
        <div className="mt-4">
          <Note>
            The mark breathes a soft brand glow on a 3.4s loop, gated behind
            prefers-reduced-motion. Its three blades use #0098FD, #FFC503 and
            #00D001, which are close to but not the same as the brand tokens.
            That is the logo&apos;s own artwork, so it is correct that it does not
            follow the skin, but it is worth knowing before matching a colour
            to it by eye.
          </Note>
        </div>
      </KitSection>

      <KitSection title="Avatar" count="2 sizes">
        <Spec label="PHOTO AND INITIALS FALLBACK" code='<Avatar name="Shariful Islam" photo={null} size="lg" />'>
          <Avatar name="Shariful Islam" photo={null} size="md" />
          <Avatar name="Shariful Islam" photo={null} size="lg" />
          <Avatar name="Chase" photo={null} size="lg" />
        </Spec>
      </KitSection>

      <KitSection
        title="Stat"
        note="Counts up from 85 percent of the value when it enters the viewport, and renders the final number immediately under reduced motion."
      >
        <Spec label="COUNTER" code='<Stat value={1000} suffix="+" />'>
          <span className="text-stat-lg text-ink">
            <Stat value={1000} suffix="+" />
          </span>
          <span className="text-stat-lg text-gold">
            <Stat value={2020} />
          </span>
        </Spec>
      </KitSection>

      <KitSection title="Lists" count="2">
        <SpecGrid cols={2}>
          <Spec
            label="CHECKLIST"
            code='<Checklist items={["...", "..."]} />'
          >
            <div className="w-full">
              <Checklist
                items={[
                  "Script written for your product",
                  "Voiceover and music",
                  "Two rounds of revisions",
                ]}
              />
            </div>
          </Spec>
          <Spec label="RULE LIST" code="<RuleList items={[{ title, line }]} columns={1} />">
            <div className="w-full">
              <RuleList
                items={[
                  { title: "Turnaround", line: "Five working days from the brief." },
                  { title: "Revisions", line: "Two rounds, included." },
                ]}
                columns={1}
              />
            </div>
          </Spec>
        </SpecGrid>
      </KitSection>

      <KitSection
        title="Focus and selection"
        note="Global, not per component. Focus is a 2px green outline at 3px offset with a 4px radius, on every focusable thing. Selection is gold at 30 percent with near-black text. Tab through this page to see it."
      >
        <Spec label="TAB THROUGH THESE" code=":focus-visible { outline: 2px solid var(--green) }">
          <Button href="#" variant="ghost" size="md">Focusable button</Button>
          <a href="#" className="text-gold underline">Focusable link</a>
          <input
            className="rounded-[3px] border border-hair bg-surface px-3 py-2 text-body text-ink"
            placeholder="Focusable input"
          />
        </Spec>
      </KitSection>
    </KitPage>
  );
}
