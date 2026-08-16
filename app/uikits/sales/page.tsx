import { KitPage, KitSection, KitTable, Note, Spec, SpecGrid } from "@/components/uikits/kit";
import { assertDevOnly } from "@/components/uikits/dev-only";

/*
 * The .sp system. Everything on this page renders inside a
 * data-surface="sales" .sp wrapper (supplied by Spec), because these class
 * names only mean anything in that scope. sales.css is imported once in the
 * kit layout so the styles are present here.
 */

const SP_TOKENS = [
  ["--sp-bg", "#07080b", "Page ground. Darker than the site canvas."],
  ["--sp-panel", "#0f1118", "Card ground."],
  ["--sp-panel-2", "#161a24", "Raised card ground."],
  ["--sp-line", "rgba(255,255,255,.08)", "Hairline. Alpha white, not a hex."],
  ["--sp-line-strong", "rgba(255,255,255,.15)", "Emphasis edge."],
  ["--sp-text", "#f4f6fb", "Text."],
  ["--sp-muted", "#9aa2b6", "Secondary text."],
  ["--sp-dim", "#6b7286", "Tertiary text."],
  ["--sp-gold", "#fcc000", "Same gold as the brand core."],
  ["--sp-green", "#00cc00", "Same green."],
  ["--sp-grad", "linear-gradient(100deg,...)", "The signature, restated."],
  ["--sp-radius", "20px", "The big difference: soft, where the site is 4px."],
  ["--sp-radius-sm", "12px", "Controls."],
  ["--sp-max", "1140px", "Container."],
  ["--sp-narrow", "800px", "Reading column."],
  ["--sp-pad", "clamp(3.5rem, 8vw, 7rem)", "Section rhythm."],
];

const GROUPS = [
  ["Layout", "sp-wrap, sp-narrow, sp-section, sp-section--band, sp-section--offer, sp-section--tight, sp-hr, sp-grid-cards"],
  ["Type", "sp-display, sp-h1, sp-h2, sp-h3, sp-lede, sp-muted, sp-eyebrow, sp-grad-text, sp-strike"],
  ["Buttons", "sp-btn, sp-btn--primary, sp-btn--ghost, sp-btn--sm, sp-btn--wide"],
  ["Cards", "sp-card, sp-card--hover, sp-panel-cta, sp-featured, sp-offer, sp-offer-tag"],
  ["Pricing", "sp-tiers, sp-tier, sp-tier--featured, sp-tier-badge, sp-tier-price, sp-tier-list, sp-tier-delivery, sp-plans, sp-price"],
  ["Bundles", "sp-bundles, sp-bundle, sp-bundle--featured, sp-bundle-count, sp-bundle-pick"],
  ["Video cards", "sp-vcard, sp-vcard-title, sp-vcard-code, sp-vcard-feat, sp-vcard-buy, sp-vcard-buy--soon, sp-video, sp-play"],
  ["Services", "sp-svc-grid, sp-svc-card, sp-svc-card--gold, --blue, --green, sp-svc-icon, sp-svc-cta, sp-svcnav"],
  ["Proof", "sp-trust, sp-trust-item, sp-trust-num, sp-review, sp-stars, sp-marquee, sp-guarantees, sp-guarantee"],
  ["Steps", "sp-steps, sp-step, sp-step-n, sp-loop, sp-loop-step, sp-loop-arrow, sp-pillars, sp-pillar"],
  ["Audience", "sp-who, sp-who-item, sp-who-check, sp-who-list, sp-niche, sp-niche-list, sp-niche-tip"],
  ["Partner", "sp-partner, sp-partner-photo, sp-partner-initials, sp-mpl-topbar, sp-mpl-logo, sp-chip, sp-chip-mark"],
  ["FAQ", "sp-faq, sp-faq-item, sp-faq-q, sp-faq-a, sp-faq-chevron"],
  ["Misc", "sp-badge, sp-pill, sp-glow, sp-codebox, sp-seg, sp-jumplink, sp-ba (before/after), sp-cformat, sp-footer"],
];

export default function SalesSystemPage() {
  assertDevOnly();
  return (
    <KitPage
      title="Sales system"
      lede="The fourth surface, and the one that shares nothing structural with the other three. Roughly 150 classes under .sp, with their own palette, their own 20px radius and their own rhythm. On brand, different job: conversion-first campaign landing pages."
    >
      <KitSection
        title="Why it is separate"
        note="The main site is a blueprint: 4px corners, hairline mesh, restrained. The landing pages are soft-cornered, bold, glow-heavy and built to convert cold traffic. Trying to serve both from one set of tokens would have compromised each. The only thing they share is the brand hues."
      >
        <KitTable head={["Token", "Value", "Note"]} rows={SP_TOKENS} />
      </KitSection>

      <KitSection title="Buttons" count="5 classes">
        <Spec label="SP BUTTONS" surface="sales" code='<a className="sp-btn sp-btn--primary">Order Now</a>'>
          <a href="#" className="sp-btn sp-btn--primary">Order Now</a>
          <a href="#" className="sp-btn sp-btn--ghost">Book a Call</a>
          <a href="#" className="sp-btn sp-btn--ghost sp-btn--sm">Small ghost</a>
        </Spec>
      </KitSection>

      <KitSection title="Type" count="9 classes">
        <Spec label="SP TYPE SCALE" surface="sales">
          <div className="w-full">
            <div className="sp-eyebrow">EYEBROW</div>
            <h2 className="sp-h2">
              Headline with a <span className="sp-grad-text">gradient phrase</span>
            </h2>
            <p className="sp-lede">
              The lede voice, wider and softer than the main site runs.
            </p>
            <p className="sp-muted">Muted supporting line.</p>
          </div>
        </Spec>
      </KitSection>

      <KitSection title="Cards and badges">
        <SpecGrid cols={2}>
          <Spec label="SP CARD" surface="sales">
            <div className="sp-card w-full" style={{ padding: "1.5rem" }}>
              <div className="sp-badge">Most popular</div>
              <h3 className="sp-h3">Growth bundle</h3>
              <p className="sp-muted">Nine videos, one brief, five days.</p>
            </div>
          </Spec>
          <Spec label="SP PILL AND STARS" surface="sales">
            <span className="sp-pill">HighLevel only</span>
            <span className="sp-stars">★★★★★</span>
          </Spec>
        </SpecGrid>
      </KitSection>

      <KitSection
        title="Full class inventory"
        count="~150"
        note="Grouped by job. All of them live in app/(sales)/sales.css and are scoped under .sp, so they cannot leak into the main site and the site's classes cannot leak in."
      >
        <KitTable head={["Group", "Classes"]} rows={GROUPS} />
      </KitSection>

      <Note tone="warn">
        --sp-grad restates the gold-to-green gradient as its own literal
        instead of referencing --brand-gradient. Change the signature
        gradient in globals.css and the landing pages keep the old one.
      </Note>
    </KitPage>
  );
}
