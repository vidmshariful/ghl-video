import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";

/*
 * One-time seed of the Journal's decision register + first log entries,
 * written from the build history so admin -> Journal is useful on day one.
 * Idempotent: an entry whose kind + title already exists is skipped.
 */
const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");

const env = {};
const envPath = new URL("../.env.local", import.meta.url);
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}
const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE,
);

const D = (title, body, decided_on = null, status = "active") => ({
  kind: "decision",
  title,
  body,
  status,
  decided_on,
  author: "claude",
});
const L = (title, body, decided_on) => ({
  kind: "log",
  title,
  body,
  status: null,
  decided_on,
  author: "claude",
});

const entries = [
  /* ---- platform foundations ---- */
  D(
    "Checkout is native and on-domain",
    "What: every buy button goes to /checkout/[sku] on ghlvideo.com; the external order site (order.ghlvideo.com) is retired. Why: one domain builds trust, keeps analytics whole, and gives us full control of the buying experience. Prices are always re-derived on the server so a link can never change what is charged.",
    "2026-07-01",
  ),
  D(
    "site.ts is the price truth, the DB is what checkout charges",
    "What: every price and line of copy lives once in code (lib/site.ts); admin -> Products -> Sync from catalog pushes it to the products table that checkout charges. Why: one source of truth, and the npm run check:drift guard fails loudly if code and database ever disagree.",
    "2026-07-01",
  ),
  D(
    "Editing plans are native Stripe subscriptions",
    "What: the three editing plans (Starter, Growth, Scale) are real Stripe subscriptions with separate live and test price ids stored per plan. Why: proper recurring billing with cancel-anytime, and the live/test split exists because Stripe recurring prices are mode-specific (mixing them crashed checkout once; never again).",
    "2026-07-15",
  ),
  D(
    "The operating entity is Vidiosa LLC",
    "What: the legal entity across the site, invoices, Stripe, and SMS registration is Vidiosa LLC (changed from Magic Motion Production LLC in 2026). The footer brand line is: A brand of Vidiosa LLC. Why: owner decision; the entity must match everywhere payments and compliance touch.",
  ),
  D(
    "Brand claims are locked: 1000+ clients, since 2020",
    "What: client count is always 1000+ (never 800+ or 376+), and the authority line is: creating HighLevel videos since 2020. Never print the Google review count; say every review is five stars. Why: consistent claims everywhere, decided July 2026.",
    "2026-07-01",
  ),
  D(
    "Deploys are batched and only on an explicit push",
    "What: work happens on the design-update branch; production (main) only moves when Shariful says push live, often batching several features into one release. Why: he reviews everything first, and one clean release beats many partial ones.",
    "2026-07-01",
  ),
  D(
    "Four surfaces, four skins, one brand core",
    "What: the platform has four visual surfaces (main website, portals, checkout, sales landing pages), each with its own design-token block so restyling one can never leak into another. Shared on purpose: brand colors, the gold-to-green gradient, the two typefaces, the logo. Why: Shariful plans separate UI passes per surface; the lint boundaries plus token split make cross-surface conflicts impossible.",
    "2026-08-15",
  ),
  D(
    "The admin portal is becoming the business's single source of truth",
    "What: products, prices, coupons, partners, promo assets, sales-page registry, email templates, site chrome, and now the Journal are all managed in /admin. Why: Shariful runs the business from one place without deploys for day-to-day changes.",
    "2026-08-15",
  ),

  /* ---- affiliate program ---- */
  D(
    "FirstPromoter stays the commission engine; the site owns everything else",
    "What: FirstPromoter keeps tracking sales (via its Stripe integration) and paying commissions. Our platform owns partner pages, links, assets, the partner portal, and discounts. Why: no reason to rebuild working money plumbing; partners get one branded home while FP does payouts.",
    "2026-08-15",
  ),
  D(
    "FirstPromoter tracks with ?ref=, the same parameter we use",
    "What: this FP account's referral links use ?ref= (Jonah's FP link is ghlvideo.com?ref=jonah), so one link earns FP commission AND our attribution at once. Why: discovered from live data; it means no double-tagging and no per-partner tracking setup.",
    "2026-08-15",
  ),
  D(
    "Partners live in the database, managed from admin",
    "What: the partners table (not code) is the registry: name, email, ref slug, discount terms, coupon, FirstPromoter ids. Admin -> Partners adds and manages them without a deploy. Why: the program must scale without a developer in the loop.",
    "2026-08-15",
  ),
  D(
    "Partner signup is both application and personal invite",
    "What: /partners/apply is the public application (reviewed in admin -> Partners -> Applications); the team can also add and invite anyone directly. Why: Shariful wants inbound applications AND hand-picked outreach.",
    "2026-08-15",
  ),
  D(
    "The partner portal is the partner's one home",
    "What: /partners gives every partner their tracked links, promo assets, swipe copy, program resources, profile, and their real FirstPromoter stats (clicks, referrals, earnings, payouts) without ever logging into FirstPromoter. Why: dedicated partner experience under our brand.",
    "2026-08-15",
  ),
  D(
    "The coupon is the ONE discount rail; the ref is attribution only",
    "What: partner discounts happen only through their coupon code (auto-carried by their page's buy buttons, or typed at checkout). The ?ref= link credits the partner but never changes a price. The old ref-cookie auto-discount on editing plans was retired with this. Why: Shariful's design: visible, simple, one mechanism to reason about, near-zero risk to the money path.",
    "2026-08-15",
  ),
  D(
    "Auto-applied discounts are exclusive to dedicated partner pages",
    "What: only well-known partners get a dedicated landing page (with hand-picked videos and packs); its buy buttons carry ?code= so the discount applies itself. Everyone else's audience types the code manually. Why: makes the page a premium partner perk and keeps the discount always visible at checkout.",
    "2026-08-15",
  ),
  D(
    "The partner coupon standard is 10% off, any product, 3 months on editing",
    "What: generated from admin -> Coupons -> Partner coupons (one click per partner, or Create missing for all). The code lands on the partner row so their portal shows it instantly. Why: one standard offer across the program; exceptions are made per partner when negotiated.",
    "2026-08-15",
  ),
  D(
    "Jonah Cockshaw's terms: 10% for 3 months, code JONAH10",
    "What: the first partner. His editing-only page is /lp/jonah-cockshaw; the multi-service template (partner-template) uses his data as the example. FP promoter id 13353369 is linked. Why: reference case for the whole program.",
    "2026-08-14",
  ),
  D(
    "Existing FirstPromoter promoters were imported, not migrated",
    "What: all 9 real FP promoters became partner rows (their FP ref token = their ref slug, FP profile pre-linked); their old links keep working unchanged. Two FP test accounts were skipped. Logins are created per partner via the admin Invite click, and Shariful sends the announcement email manually when ready. Why: zero disruption for partners; nothing reaches them until he says so.",
    "2026-08-15",
  ),
  D(
    "Dillon is team AND an affiliate partner",
    "What: dillon@ghlvideo.com stays in the partner program (ref dillondirect) like any partner. Why: he does affiliate work as well as team work.",
    "2026-08-15",
  ),
  D(
    "The demo partner account previews with Jonah's real stats",
    "What: the demo partner (Shariful's own admin email as login) temporarily mirrors Jonah's FirstPromoter id so real numbers show while reviewing. Clear the FP promoter id on the demo row to return it to a plain demo. Why: review the real experience without touching Jonah's account or email.",
    "2026-08-15",
  ),

  /* ---- operations ---- */
  D(
    "Quote and intake leads flow to HighLevel",
    "What: quote requests and paid orders sync to HighLevel contacts, tags, pipelines; partner-referred sales get an affiliate:<ref> tag. Why: the CRM stays the operational home for follow-up.",
    "2026-07-01",
  ),
  D(
    "Portal chat polls on purpose",
    "What: the customer portal chat refreshes by polling, not websockets. Why: simple and reliable at this scale; a rebuild was considered and declined.",
    "2026-07-20",
  ),
  D(
    "The region gate exists but sleeps",
    "What: edge blocking for configured countries with a team bypass at /unlock is built into proxy.ts, dormant until ACCESS_BYPASS_KEY is set in Vercel. Why: ready when needed, harmless until then.",
    "2026-08-05",
  ),
  D(
    "The Journal is the shared brain, and keeping it is a standing rule",
    "What: admin -> Journal holds the build log (what changed, when), the decision register (what we decided and why; superseding keeps history), and the idea inbox (Shariful jots thoughts; every Claude session reads open ideas first). The ritual lives in CLAUDE.md so every future session follows it. Why: Shariful iterates fast and chats compact; decisions and context must survive both.",
    "2026-08-15",
  ),

  /* ---- first log entries ---- */
  L(
    "Affiliate system + partner pages went live",
    "Shipped to production: the reusable partner landing-page engine, Jonah's page (/lp/jonah-cockshaw), the multi-service partner template (/lp/partner-template), ref attribution site-wide, checkout hardening (required phone + company, country picker, atomic coupon caps), coupons on editing plans, and the HighLevel Inc legal-name fix.",
    "2026-08-14",
  ),
  L(
    "Partner portal built end to end (not yet deployed)",
    "Built and verified locally: the /partners portal (links, assets, resources, settings, application form) with real FirstPromoter stats (Performance, Referrals, Earnings), admin Partners management (invite, approve, pause, asset library), all 9 real FP promoters imported with logins pending the Invite click, coupon unification (the code is the one discount rail; partner-page buttons auto-apply it), the four-surface design-token split, and this Journal. Ships as one release when Shariful says push live.",
    "2026-08-15",
  ),
];

let added = 0;
let skipped = 0;
for (const e of entries) {
  const { data: existing } = await db
    .from("journal")
    .select("seq")
    .eq("kind", e.kind)
    .eq("title", e.title)
    .maybeSingle();
  if (existing) {
    skipped++;
    continue;
  }
  const { error } = await db.from("journal").insert(e);
  if (error) {
    console.error(`FAILED "${e.title}": ${error.message}`);
    process.exit(1);
  }
  added++;
}
console.log(`journal seed: ${added} added, ${skipped} already present`);
