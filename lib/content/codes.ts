/* ---------------------------------------------------------------- */
/* Product codes: the permanent identity for every video and pack     */
/* ---------------------------------------------------------------- */

/* A short, frozen, format-prefixed code is each product's true identity
 * (EXP-014, DEMO-003, PACK-002). The display TITLE can repeat or change;
 * the code never does. The code IS the checkout sku and URL, so a product
 * can be renamed with zero broken links or order history. Keyed by the
 * product's descriptive slug. APPEND-ONLY: assign the next number in a
 * prefix's sequence when a video ships; never reuse or renumber. If you
 * ever rename a video (change its slug), move its entry to the new key so
 * the card still shows the code, the sku in the products table is
 * unaffected. Prefixes: EXP explainer, SHORT short/feature explainer, DEMO
 * demo, MKT marketing, FA feature-animation pack, PACK pack/stack/bundle,
 * EDIT editing plan. */
export const productCodes: Record<string, string> = {
  "all-in-one-ai-first-positioning": "EXP-001",
  "ai-receptionist-conversational-ai": "SHORT-001",
  "unified-inbox-conversational-ai": "SHORT-002",
  "reputation-management-reviews-ai": "SHORT-003",
  "highlevel-official-full-platform-pitch": "EXP-002",
  "ai-employee": "SHORT-004",
  "conversational-ai": "SHORT-005",
  "voice-ai": "SHORT-006",
  "content-ai": "SHORT-007",
  "all-in-one-inbox": "SHORT-008",
  "opportunity-pipeline": "SHORT-009",
  "automation-builder": "SHORT-010",
  "reputation-manager": "SHORT-011",
  "email-builder": "SHORT-012",
  "contact-management": "SHORT-013",
  "calender-booking": "SHORT-014",
  "two-way-texting": "SHORT-015",
  "social-media-planner": "SHORT-016",
  "call-tracking-recording": "SHORT-017",
  "payment-invoicing": "SHORT-018",
  "missed-call-text-back": "SHORT-019",
  "mobile-app": "SHORT-020",
  "live-chat-widget": "SHORT-021",
  membership: "SHORT-022",
  "power-dialer": "SHORT-023",
  reporting: "SHORT-024",
  "forms-surveys": "SHORT-025",
  "comparison-video": "SHORT-026",
  "everything-in-one-place": "SHORT-027",
  "all-in-one-platform": "SHORT-028",
  "funnel-website-builder": "SHORT-029",
  "all-in-one-platform-explainer": "EXP-003",
  "ai-employee-explainer": "EXP-004",
  "reputation-management-explainer": "EXP-005",
  "social-media-planner-explainer": "EXP-006",
  "automated-outreach-explainer": "EXP-007",
  "complete-platform-tour-explainer": "EXP-008",
  "spokesperson-platform-demo": "DEMO-001",
  "motion-graphics-platform-demo": "DEMO-002",
  "ai-platform-demo": "DEMO-003",
  "marketing-1": "MKT-001",
  "marketing-2": "MKT-002",
  "marketing-3": "MKT-003",
  "marketing-4": "MKT-004",
  "marketing-5": "MKT-005",
  "marketing-6": "MKT-006",
  "marketing-7": "MKT-007",
  "marketing-8": "MKT-008",
  "marketing-9": "MKT-009",
  "marketing-10": "MKT-010",
  "marketing-11": "MKT-011",
  "marketing-12": "MKT-012",
  "marketing-13": "MKT-013",
  "marketing-14": "MKT-014",
  "marketing-15": "MKT-015",
  "marketing-16": "MKT-016",
  "marketing-17": "MKT-017",
  "marketing-18": "MKT-018",
  "marketing-19": "MKT-019",
  "marketing-20": "MKT-020",
  "marketing-21": "MKT-021",
  "feature-animations-7": "FA-001",
  "feature-animations-15": "FA-002",
  "feature-animations-23": "FA-003",
  "ai-first-saas-pack": "PACK-001",
  "complete-video-stack": "PACK-002",
  "new-essential": "PACK-003",
  "new-growth": "PACK-004",
  "classic-starter": "PACK-005",
  "classic-growth": "PACK-006",
  "classic-pro": "PACK-007",
  "classic-complete": "PACK-008",
  "mix-core": "PACK-009",
  "mix-pro": "PACK-010",
  "editing-starter": "EDIT-01",
  "editing-growth": "EDIT-02",
  "editing-scale": "EDIT-03",
  /* the collab pitch versions sold individually (Complete Brand
     Customization reuses the standalone pitch's code) */
  "hl-pitch-logo-only": "PITCH-001",
  "hl-pitch-uk-accent": "PITCH-002",
  "hl-pitch-dutch": "PITCH-003",
  "hl-pitch-spanish": "PITCH-004",
};

/* The display code for a product's descriptive slug (e.g. "EXP-014"), or
 * null if it has none yet. */
export const codeFor = (slug: string): string | null => productCodes[slug] ?? null;

/* The checkout sku for a descriptive slug: the code, lowercased
 * ("exp-014"), so /checkout/<sku> is the stable, rename-proof URL. Falls
 * back to the slug itself if no code is assigned. Note: subscription plans
 * keep their own sku (tied to a Stripe price) and are handled separately. */
export const skuFor = (slug: string): string =>
  (productCodes[slug] ?? slug).toLowerCase();
