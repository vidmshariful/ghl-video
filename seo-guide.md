# GHL Video: SEO and AI-Search Guideline (2026), v2

Working document for the page-by-page content and SEO pass. Facts, pricing, and voice follow the company profile (the master reference); conflicts are flagged in section 11, never silently overwritten.

v2 changes: URL policy corrected after live SERP verification (/custom-video/ holds a #1 and will be reused, not redirected), the launch sequence reordered around the fact that the new build is not ready to go live, the SEO Kit v2 reconciled (its per-page title and meta work adopted, three of its recommendations rejected on evidence), and five kit claims verified against the build.

Research base: 15-agent run on 2026-07-20 (five research tracks, each adversarially fact-checked; live audits of ghlvideo.com, the Vercel preview, and the local build; ghlsaasvideo.com teardown; 7-query SERP map), plus follow-up live SERP checks for the custom and editing clusters. Sources in section 12.

---

## 0. Where we stand

**Production (ghlvideo.com) serves the OLD WordPress site, in full, and stays in service until the new build is ready.** During the 2026-07-20 audit the domain briefly served a hybrid (new homepage, old everything else, all new routes 404ing); within the hour it reverted to fully old. Whoever manages the Vercel domain config flipped something that day. Before cutover we must know exactly what routes traffic on that domain, because an accidental partial cutover is the worst state: a new homepage whose every nav link 404s.

**The new build is not launch-ready.** Missing before it can go live: the page-by-page content and SEO pass (this document), the HighLevel connections (LeadConnector booking calendar on /contact/, quote form, GetStarted embeds), and live checkout links per SKU. Until those land, the old site earns the traffic.

**What the old site is worth protecting:** it holds #1 organic positions on at least 5 core commercial queries, verified live on 2026-07-20:

| Query | Ranking page |
|---|---|
| gohighlevel explainer video | / (homepage) |
| gohighlevel demo video | /highlevel-demo-video/ |
| gohighlevel custom video production | /custom-video/ |
| highlevel video bundle | /highlevel-video-bundle/ |
| gohighlevel video service, gohighlevel videos white label | / (homepage) |

These rankings are the inheritance. The whole URL policy in section 4 exists to hand them to the new site intact.

**What the old site costs us meanwhile:** it sells retired offers at prices that contradict the locked spec (custom from $1,250 vs the $1,500 floor, editing Scale $1,995 vs $1,795, retired bundles), has zero H1 tags on its money pages, says "since 2019" in metas and copy (see conflict 1), and its sitemap lists stale seasonal promos. We do not fix the old site; we replace it. But nothing we publish anywhere else may repeat its numbers.

---

## 1. The 2026 operating model: classic SEO, AEO, GEO

Direction, not theory. Every claim survived adversarial fact-checking against independent sources.

### What changed, in numbers

- 68% of Google searches end without a click to the open web (SparkToro, Jan to Apr 2026). When an AI Overview appears, clicks on traditional results drop from 15% to 8% of visits (Pew, behavioral panel).
- Being cited INSIDE the AI Overview recovers about half the lost clicks: +120% more clicks per impression vs not being cited (Seer Interactive, Feb 2026).
- Rankings open the door but no longer guarantee entry: 97% of AI Overviews cite at least one top-20 result (seoClarity), but only 38% of AIO citations come from the top 10, down from 76% in mid-2025, because Google fans queries out into sub-queries (Ahrefs, March 2026). Covering the main query plus its adjacent questions makes a page 161% more likely to be cited (Surfer SEO).
- Brand mentions beat backlinks for AI visibility: branded web mentions correlate at 0.66 to 0.71 and YouTube mentions at 0.74, while backlinks sit at 0.10 to 0.33 (Ahrefs, 75,000 brands, Dec 2025).
- AI referrals are low-volume but roughly 4.4x more valuable per visitor (Semrush), and 94% of B2B buyers use AI during purchase research, ranking AI answer engines their #1 research source (Forrester 2026).

### What this means for GHL Video

1. **Classic SEO is the foundation.** AIO citations remain anchored to rankings; the five #1s are the moat. The URL policy protects them; the per-page pass extends them.
2. **AEO is a content-shape discipline.** Every page answers its query directly in the first two sentences under each heading, in extractable server-rendered HTML. Question-form H2s, visible FAQ blocks, tables for prices.
3. **GEO is mostly an off-site game.** Being NAMED in ChatGPT, Perplexity, and Gemini answers correlates with brand mentions (YouTube above all, then communities, directories, LinkedIn), not on-page tricks. The highest-leverage GEO asset for a video studio is a YouTube channel with chaptered, transcript-clean samples: YouTube is the #1 cited domain in Google AI Overviews (29.5% share) and gets ~200x more AI citations than every other video platform combined. View counts show near-zero correlation with citation odds; structure wins.
4. **AI visibility is a conversion play, not a volume play.** Only 1% of visits click a link inside an AI summary. The goal is to be the named vendor in the answer so the buyer arrives pre-sold.

### Dead advice we will not spend on

- **llms.txt as a visibility lever.** Google states no AI system uses it; 97% of llms.txt files received zero requests (Ahrefs server logs, May 2026). Ship a minimal one post-launch as a free lottery ticket; budget zero ongoing effort.
- **FAQ rich results.** Deprecated for ALL sites on May 7, 2026. FAQ CONTENT on the page still matters for AI extraction; the markup is optional hygiene.
- **AggregateRating / Review markup for our own Google reviews.** Rejected from the kit: marking up reviews of your own business on your own site is self-serving review markup, excluded from rich results since 2019 and a documented manual-action risk. The reviews stay as visible on-page text, which is the form AI extraction actually reads.
- **Backlink-first campaigns.** Mentions out-correlate links. Digital PR that produces named mentions beats guest-post link building.

---

## 2. The entity definition

The sentence set AI systems should repeat. Use the same phrasing, verbatim where possible, on the site, LinkedIn, Crunchbase, YouTube channel description, directory listings, and every guest appearance.

**Short (under 160 characters):**
GHL Video is the original HighLevel-only video studio: white-label videos for GoHighLevel SaaS businesses and agencies, produced fully in-house.

**Standard:**
GHL Video is the original video studio built only for the HighLevel ecosystem, creating white-label videos for GoHighLevel SaaS businesses and agencies. A brand of Vidiosa LLC with a full-time in-house team, it has served 800+ clients across the US, Canada, UK, and Australia. Services: premade white-label videos priced by type from $97 to $995 (Explainer $495, Demo $995, plus bundles and the Classic Library), custom production with published starting prices from $1,500, and a monthly video editing subscription for HighLevel creators from $595. GHL Video is not affiliated with or endorsed by GoHighLevel Inc.

**Attribute list (for structured contexts):**
- Category: white-label video production studio for the HighLevel ecosystem
- Parent: Vidiosa LLC
- Years: none published anywhere (RULED 2026-07-20: no year numbers in any customer-facing copy)
- Clients: 800+ (the one canonical figure, everywhere)
- Rating: 5.0 on Google (17 reviews)
- Named clients: Dominic Bavaro (CEO, Emma.io), Ryan Maule (CEO, AI Clinic Assist), David Allen Neron (CEO, NeoLuxLabs)
- Markets: US, CA, UK, AU
- Founder: Shariful Islam
- Disclaimer: not affiliated with or endorsed by GoHighLevel Inc.

**Entity infrastructure (off-site, priority order):** YouTube channel treated as documentation, LinkedIn company page, Crunchbase, Wikidata once two independent citable sources exist, all wired into Organization sameAs (currently only YouTube, Facebook, Instagram; LinkedIn is a "#" placeholder).

---

## 3. URL policy (corrected in v2)

One rule, applied consistently, verified against live SERPs:

1. **Old URL ranks: the new page LIVES at that exact URL.** Same URL = zero redirect risk, full inheritance. A 301 passes most equity but triggers re-evaluation; never gamble a held #1 on one.
2. **Old URL has no rankings: clean new slug + 301.** Verified case: /highlevel-video-editing-service/ ranks for nothing (checked 2026-07-20), so /editing/ stays and the old URL 301s.
3. **New page with no old equivalent: keyword slug, free choice.** The new routes have never been live on the domain, so renaming them now costs nothing. After launch it costs a redirect. Lock all slugs BEFORE launch.

Explicitly rejected: moving ranking pages to "more SEO-friendly" new slugs (e.g. /highlevel-custom-video/). A new URL forfeits the zero-redirect benefit and still needs a 301 from the old one; the keyword weight lives in the title, H1, and content, proven by /custom-video/ ranking #1 with the keyword only in its title. Slug keywords are a minor factor in 2026; a held #1 is not.

### The final URL map

| URL | Action | Basis |
|---|---|---|
| / | Homepage | Holds #1 on 3 queries via the old title; see page card |
| /custom-video/ | RENAME the build's /custom/ to this | Holds #1 for "gohighlevel custom video production" (verified live) |
| /highlevel-demo-video/ | BUILD as a real page in the new design | Holds #1 for "gohighlevel demo video" |
| /highlevel-video-bundle/ | BUILD as a real page | Holds #1 for "highlevel video bundle" |
| /highlevel-explainer-video/ | BUILD new | No old equivalent; our #1 rests on the homepage (fragile); the only purpose-built page in the SERP is the competitor's |
| /premade/ | Keep | Never live on domain; no equity at stake |
| /editing/ | Keep; 301 /highlevel-video-editing-service/ here | Old URL verified ranking for nothing |
| /work/, /about/, /contact/, /quote/, /blog/, /resources/ | Keep | No old equivalents with equity |
| /custom-video/ gets NO redirect | | The page lives there |
| /contact-us/, /schedule-a-call/ | 301 to /contact/ | No keyword value |
| /onboarding-process/ | 301 to /custom-video/ | Process content lives there |
| /highlevel-feature-animation/, /highlevel-marketing-videos/ | 301 to /premade/ | Formats live in the library; revisit as future per-format pages |
| Old blog posts, seasonal promo URLs | Crawl old sitemap for full inventory; 301 posts to /blog/ or equivalents, promos to /premade/ | Pre-cutover task |

---

## 4. Launch sequence (reordered in v2: build is not launch-ready)

1. **Lock the URLs now.** DONE 2026-07-20: /custom/ renamed to /custom-video/ (route, sitemap, Service schema url, all internal links, preview-safety redirect).
2. **Page-by-page content + SEO pass** (the cards in section 5), including the three pages to build (demo, bundle, explainer).
3. **Wire the HighLevel layer:** LeadConnector calendar on /contact/, quote form, GetStarted embeds, per-SKU checkout links verified against order.ghlvideo.com.
4. **Cutover package, shipped as one unit:** full deploy to the domain, ONE host (apex vs www: everything shipped says apex; the domain currently 308s apex to www; pick one and align), the 301 map above, regenerated sitemap (add /blog/, real lastmod), canonicals + OG layer, old WP origin retired.
5. **Post-launch:** Knowledge Hub build-out, YouTube channel, entity layer, llms.txt, IndexNow, measurement baseline.

Cutover acceptance test, non-negotiable: every URL in the section 0 rankings table returns 200 with the intended page on the production domain; every 301 in the map resolves in one hop; zero nav links 404.

---

## 5. Per-page execution cards

The working checklist for the pass. Kit v2's title and meta work is adopted where it was right, adjusted where SERP evidence says otherwise (ranking titles in this niche lead with "GoHighLevel" spelled out; our old ranking pages prove the pattern: "GoHighLevel [keyword phrase] | [qualifier] | GHL Video"). Prices in metas follow the profile; blocked items reference section 11 conflicts.

**Global fixes first (verified in the build):**
- /resources/ and /blog/ duplicate the homepage meta description word for word. Give each a unique meta now, and noindex both until they carry real content (they are already out of the sitemap but are linked in the nav and indexable).
- OG/Twitter/canonical layer is absent sitewide (section 6).
- "since day one" on the homepage STAYS: it is year-free, so it complies with the no-year ruling. The kit's change to "since 2020" is dead.

### / (Homepage)
- Focus: gohighlevel video service, gohighlevel videos white label
- Title: GoHighLevel White-Label Video Infrastructure for HL SaaS | GHL Video (the old title minus its "#1" self-claim; it holds three #1s, change as little as possible)
- Meta: broaden beyond the AI-first pack to all three services: "White-label GoHighLevel videos for SaaS resellers and agencies. Premade by type, custom production from $1,500, and monthly editing from $595. 800+ served, rated 5.0 on Google."
- H1: keep "Video built for HighLevel SaaS."
- Schema: Organization + WebSite (shipped)
- Content: fix "since day one"; FAQ section already strong

### /custom-video/ (renamed from /custom/)
- Focus: gohighlevel custom video production (holds #1; defend)
- Title: GoHighLevel Custom Video Production | Built From Scratch | GHL Video (the old ranking title, verbatim)
- Meta: keep the current build meta (kit agrees it is strong)
- H1: keep. Work "custom video production" into the intro copy near the top
- Schema: Service + FAQPage (shipped); BreadcrumbList later
- Content: page is strong post-rebuild; sample-work section still shows premade AI-pack videos flagged as placeholder

### /premade/
- Focus: gohighlevel white label videos
- Title: GoHighLevel White-Label Videos and Video Packs | GHL Video
- Meta: BLOCKED on conflict 3 (pricing range wording). Shape: "Premade GoHighLevel videos branded to your SaaS: explainers, demos, ads, and the Classic Library. Priced by type, delivered in days."
- Schema: Service + FAQPage (shipped); add per-SKU Product + Offer with real order URLs (still a live Google rich result, and we become the niche's only machine-readable price source)
- Content: "premade can't do" heading pending conflict 4 (contractions); "coming soon" FAQ answer is temporal, keep out of evergreen copy

### /editing/
- Focus: gohighlevel video editing service (cluster verified uncontested: no HighLevel-specific service ranks)
- Title: GoHighLevel Video Editing Subscription | GHL Video
- Meta: keep, append "Plans from $595."
- Schema: Service + FAQPage (shipped); add per-plan Offer nodes
- Content: strong; before/after sample pair still a flagged placeholder (two unrelated clips)

### /highlevel-demo-video/ (to build)
- Focus: gohighlevel demo video (holds #1; defend)
- Title: GoHighLevel White-Label Demo Video | Branded Walkthrough | GHL Video (old ranking title, verbatim)
- Content: Demo $995 hero product per the locked spec (the old page's $495-versions-with-strikethrough framing is retired); white-label proof (logo, dashboard, voiceover); a "demo video vs Loom walkthrough" block to intercept the informational half of this SERP
- Schema: Service or Product + Offer, FAQPage

### /highlevel-video-bundle/ (to build)
- Focus: highlevel video bundle, gohighlevel video bundle (holds #1; defend; competitor holds 3 slots on this SERP)
- Title: GoHighLevel Video Bundle | White-Label Packages | GHL Video (old ranking title, verbatim)
- Content: the current three bundle categories from lib/site.ts; the old page's meta carries "since 20.." and an em dash, do not reuse it
- Schema: Product + Offer per bundle, FAQPage

### /highlevel-explainer-video/ (to build)
- Focus: gohighlevel explainer video (we rank #1 via the homepage; make it durable)
- Title: GoHighLevel White-Label Explainer Videos | GHL Video
- Content: the $495 hero product, samples, transparent pricing table, FAQ; out-execute the competitor's discount-heavy template with a premium video-first page
- Schema: Product + Offer, FAQPage

### /about/
- Focus: entity (brand queries)
- Title: About GHL Video | The HighLevel-Only Video Studio
- Meta: keep (no year, per ruling)
- Schema: add AboutPage + Person (founder); this page anchors the entity, every fact must match the Organization schema and section 2 verbatim
- Content: add 2 to 3 entity FAQs (who is behind it, affiliation, why HighLevel only; no year); verify section chip numbering during the pass (kit reports a 02-to-04 jump; unconfirmed)

### /work/
- Focus: gohighlevel video examples
- Title: GoHighLevel Video Examples and Portfolio | GHL Video
- Content: thin at ~227 words; add per-piece titles, purposes, and client/format context in visible text
- Schema: honest note: VideoObject only earns video features on pages where the video is the MAIN content; the hover-play grid does not qualify. Plan per-sample watch sections or pages with collapsed-in-DOM transcripts, VideoObject, and a video sitemap; until then this page carries CollectionPage at most

### /contact/ and /quote/
- Titles: Book a GoHighLevel Video Call | GHL Video; Request a Quote | GHL Video
- Schema: ContactPage on /contact/
- Blocker: real LeadConnector embeds replace the placeholders before launch

### /blog/ (Knowledge Hub) and /resources/
- Fix duplicate metas immediately; noindex until real content ships
- Post-launch: this is the uncontested informational layer (competitor's blog links literally point at "#"). First three posts by SERP evidence: the SaaS explainer cost guide (rankers anchor ~$3,050 for 60s; our by-type pricing undercuts the cited market), the best-GoHighLevel-video-services comparison (no independent comparison exists; the citation slot is unclaimed), and free-vs-paid onboarding videos (free libraries contest that SERP; win on the churn angle)
- Each post: Article schema, direct-answer intro, embedded video with transcript, internal link to exactly one service page with descriptive anchor text

### The 15 questions to own (FAQ blocks and Knowledge Hub answers)

1. How do I get white label videos for my GoHighLevel SaaS?
2. What is the best explainer video service for GoHighLevel?
3. How much does a SaaS explainer video cost?
4. How much does a white label demo video cost?
5. Where do I get onboarding videos for my HighLevel SaaS clients?
6. Are free white label HighLevel onboarding videos worth it?
7. What videos do I need to launch a GoHighLevel SaaS?
8. What is a white label demo video?
9. Demo video vs Loom walkthrough: which closes more deals?
10. How long does a custom SaaS explainer take?
11. Can I put my own branding on premade HighLevel videos?
12. What should I charge sub-accounts for video?
13. Who edits videos for HighLevel coaches and creators?
14. How do HighLevel agencies reduce churn with onboarding videos?
15. Is there a video subscription for HighLevel content creators?

Intent traps, verified, do not chase: "gohighlevel video templates" (platform-feature intent) and bare "gohighlevel promo video" (polluted by GoHighLevel discount promos; fold promo intent into custom's Ads/Promo section).

---

## 6. Technical checklist

- [x] Server-rendered HTML sitewide (static export). Mandatory: no major AI crawler executes JavaScript (confirmed through June 2026). No visible fact may ever depend on client-side rendering.
- [ ] Route rename /custom/ to /custom-video/ (step 1 of the launch sequence).
- [ ] Canonical tags: absent on every page. Add metadataBase + per-page canonicals (also neutralizes the fully-indexable Vercel preview, which currently has no canonical and no noindex).
- [ ] OG + Twitter cards: absent sitewide. Add og:title, og:description, og:image (1200x630), twitter:card. Produce a raster logo for Organization schema (currently logo.svg).
- [ ] Unique meta on /resources/ and /blog/ plus noindex until real content (verified duplicates today).
- [ ] Schema per the page cards. Standing rules: facts always ALSO visible on page (schema-only facts are never extracted, proven in controlled tests); no aggregateRating anywhere (self-serving); FAQPage optional hygiene.
- [ ] Video layer, honest version: VideoObject + video sitemap + collapsed-in-DOM transcripts on pages where video is the main content; the hero loop and hover-grid are UX only and earn nothing.
- [ ] robots.txt stays open (allow all + sitemap). Do NOT add AI-crawler disallows: blocking search-tier bots (OAI-SearchBot, PerplexityBot, Claude-SearchBot) removes citation eligibility. Explicit per-bot Allow blocks (as in the kit) are harmless but redundant.
- [ ] CDN bot settings: the silent killer. Cloudflare blocks many AI crawlers by default and tightens again 2026-09-15; if we deploy there, AI Crawl Control must be set to allow. On Vercel, confirm no bot-protection challenge hits AI user-agents. After launch, prove access via server logs (OAI-SearchBot, PerplexityBot hits).
- [ ] One host: apex vs www decided and aligned across redirects, sitemap, canonicals, schema url fields.
- [ ] Sitemap regenerated at cutover: add /blog/, the three built pages, real lastmod values; retire the old 29-URL sitemap.
- [ ] IndexNow + Bing Webmaster Tools (Microsoft is the only platform with first-party confirmation that schema feeds its LLMs; ChatGPT search has leaned on Bing's index).
- [ ] Core Web Vitals: LCP stays on the poster image, never the video; remove the ~611MB placeholder clip before cutover.
- [ ] llms.txt: post-launch, 20 minutes, zero expectations (nothing reads it; Google confirms).

---

## 7. Competitor: ghlsaasvideo.com, and exactly how we beat them

Visible on all 7 core queries, per-format page architecture, ranking YouTube channel and Facebook group, undercuts at $395 entry. The openings are structural:

| # | Their gap (verified 2026-07-20) | Our move |
|---|---|---|
| 1 | Zero JSON-LD despite public prices, FAQs, videos | Full schema layer; we become the only machine-readable pricing source, so AI price answers extract OUR numbers |
| 2 | No blog, no about; footer content links are dead "#" | Knowledge Hub owns every informational query uncontested |
| 3 | Anonymous: no founder, no client count, generic stats | Entity stack they cannot copy: the original in the niche, 800+, 5.0, three named CEO clients, public founder, Vidiosa family |
| 4 | Three expired countdowns live at once; prices contradict between their own pages | One price everywhere, from one typed source; zero fake urgency, stated as a trust feature |
| 5 | "Buy Now" opens a Tally form | Real per-SKU checkout at order.ghlvideo.com; say it in copy |
| 6 | No editing service at all | /editing/ owns the whole cluster; zero competition from them |
| 7 | Portfolio is 7 YouTube thumbnails | Video-first portfolio, machine-readable once the video layer ships |
| 8 | Near-duplicate keyword-stuffed H1s; a meta implying GoHighLevel affiliation | Distinct intent-matched title/H1 per page; disclaimer everywhere; claims that survive fact-checking |
| 9 | $395 entry-price undercut | Do not race down: by-type range starts at $97 (below their anchor), named proof, instant checkout; sell what a bad demo costs in churn |

Their one strength worth copying: per-format pages win format queries. Our preserved and new pages (demo, bundle, explainer) are that architecture, done with our authority.

---

## 8. Content rules for AI citation

1. Direct answer first: the opening one or two sentences under any H2 answer the heading completely; elaboration follows. Extractors quote spans.
2. Question-form H2s matching real queries (the 15).
3. Specific verifiable numbers near every claim: $495, 5 to 7 days, 800+, 17 reviews at 5.0. Vague copy is unquotable.
4. Facts in visible HTML text, never schema-only, never image-only, never behind JavaScript.
5. FAQ blocks stay on service pages (extraction value survives the dead rich result). Answers under 50 words, standalone.
6. Tables for prices and comparisons.
7. One entity phrasing everywhere (section 2, verbatim).
8. Knowledge Hub posts carry citable statistics and named quotes (the GEO paper's proven tactics: citations, quotations, statistics).
9. Claims survive fact-checking: 94% of AI users verify. Nothing may contradict the profile, the site, or the Google reviews.
10. Voice rules in every asset including YouTube descriptions and directory blurbs: founder to founder, no hype, no em dashes, CTAs name the action, disclaimer wherever the brand is described.

---

## 9. Off-site entity program (the GEO engine)

1. YouTube channel treated as documentation: long-form (94% of AI-cited videos are long-form, not Shorts), chapters, clean transcripts, question-based titles, front-loaded descriptions with the entity phrasing and a link to the matching page. Perplexity and Google AIO drive 75%+ of YouTube citations; view counts barely matter.
2. LinkedIn company page + founder posting (top-cited domain class).
3. Directory layer: Crunchbase, Clutch, HighLevel-ecosystem directories, same description verbatim.
4. Community presence with care: HighLevel Facebook groups, Reddit where genuinely helpful (the #1 citation source across engines, and allergic to promotion).
5. Digital PR for named mentions (unlinked mentions still correlate 0.66+ with AI visibility).
6. Wikidata once two independent citable sources exist.

---

## 10. Measurement: share of answer, not just rankings

Monthly, one sheet:

1. Share-of-answer panel: fixed 20 prompts (the 15 questions + 5 head terms as questions) across ChatGPT, Perplexity, Gemini, Google AIO (US). Score: brand NAMED / site CITED / site LINKED / absent; is ghlsaasvideo named? Primary AI KPI.
2. GSC positions for the 7 head queries. Non-negotiable: zero lost #1s through cutover.
3. AI referral segment (chatgpt.com, perplexity.ai, gemini.google.com, copilot.microsoft.com referrers): sessions and conversion rate separately.
4. Crawler access proof: monthly log check for OAI-SearchBot, PerplexityBot, Claude-SearchBot, GPTBot. Zero search-tier hits means a gate is closed.
5. Brand mention count (Google, YouTube search, Reddit search).
6. Bing Webmaster Tools impressions.
7. Quarterly re-run of the 7-query SERP map.

---

## 11. Conflicts and open questions (flagged, not overwritten)

1. **RESOLVED (ruled 2026-07-20): no year numbers at all.** No "since 2020", no "since 2019", anywhere in customer-facing copy. Authority frames as "the original HighLevel-only video studio". This retires the profile's "since 2020" phrasing, the old site's "2019", and the kit's year recommendations in one stroke; CLAUDE.md's original no-year rule stands.
2. **RESOLVED by the same ruling.**
3. **PARTIALLY RESOLVED.** Ruled: the $1,295 price is not right. The SKU is the Feature Animation Pack, 23 (slug feature-animations-23) in the Classic Library. Correct price still needed from Shariful (pricing is never invented). Once given: fix the SKU, then the /premade/ meta wording, the Service schema lowPrice (495 to 97), and the stale "Order for $495" CTA string (profile vocabulary: Order Now).
4. **OPEN, deprioritized (ruled "not sure").** Current copy stays as-is, including "premade can't do". Revisit before launch.
5. **areaServed**: schema says Worldwide; profile says US, CA, UK, AU. Queued.
6. **LinkedIn URL** is a "#" placeholder; excluded from sameAs until real.
7. **Old blog post inventory** not yet crawled; needed to finish the 301 map. Host choice (apex vs www) also DEFERRED by ruling to the cutover package.
8. **Live-site pricing contradictions** (custom from $1,250, Scale $1,995, retired bundles): resolved by cutover, listed so nobody quotes the old numbers meanwhile.
9. **Kit recommendations rejected on evidence** (for the record): AggregateRating/Review self-serving markup; llms.txt as a priority; FAQ schema as a rich-result play; the kit's "keep /custom/, changing slugs costs redirects" note (true after launch, not before; slugs are free until the routes go live).

---

## 12. Sources (2026-relevant claims)

- Google I/O 2026 (AIO 2B+, AI Mode 1B+): blog.google/products-and-platforms/products/search/search-io-2026/
- Pew Research, AI summaries and click behavior (2025-07-22): pewresearch.org/short-reads/2025/07/22/
- SparkToro zero-click 2026 (2026-06): sparktoro.com/blog/in-2026-less-than-one-third-of-google-searches-still-send-a-click/
- Seer Interactive, AIO CTR + citation lift (2026-04-24): seerinteractive.com/insights/aio-impact-on-google-ctr-2026-update
- Ahrefs, AIO citations vs top-10, fan-out (2026-03-02): ahrefs.com/blog/ai-overview-citations-top-10/
- seoClarity, AIO and top-20 overlap (2025-10): seoclarity.net/research/aio-rankings-overlap
- Surfer SEO fan-out study (2025-12-18): searchengineland.com/ai-overview-fan-out-rankings-boost-citation-odds-study-466426
- Ahrefs, 75k-brand mention correlations (2025-12-12): ahrefs.com/blog/ai-brand-visibility-correlations/
- Semrush AI referral value (2025): semrush.com/blog/chatgpt-search-insights/
- Forrester 2026 Buyers' Journey + TrustRadius 2026: prnewswire.com/news-releases/trustradius-2026-b2b-buying-disconnect-report
- GEO paper, KDD 2024: arxiv.org/abs/2311.09735
- llms.txt zero-request logs (2026-07-02): ppc.land/llms-txt-adoption-rises-8-8x-but-97-of-files-get-zero-ai-requests/
- Google on llms.txt (Mueller, Illyes): seroundtable.com/google-ai-llms-txt-39607.html
- OpenAI / Anthropic / Perplexity bot docs: developers.openai.com/api/docs/bots, support.claude.com/en/articles/8896518, docs.perplexity.ai/guides/bots
- Google-Extended docs: developers.google.com/search/docs/crawling-indexing/google-common-crawlers
- AI crawlers do not execute JS (Vercel, reconfirmed 2026-06): vercel.com/blog/the-rise-of-the-ai-crawler
- Cloudflare AI crawler defaults: blog.cloudflare.com/content-independence-day-ai-options/
- FAQ rich results deprecated for all (2026-05-08): searchengineland.com/google-to-no-longer-support-faq-rich-results-476957
- Google: no special schema for AI features (2025-12-10): developers.google.com/search/docs/appearance/ai-features
- Self-serving review markup excluded (2019, still current): developers.google.com/search/docs/appearance/structured-data/review-snippet
- Microsoft: schema feeds Bing/Copilot LLMs (2025-03): searchengineland.com/microsoft-bing-copilot-use-schema-for-its-llms-453455
- OtterlyAI controlled schema experiment (2026-03-23): otterly.ai/blog/schema-markup-real-impact-ai-search/
- BrightEdge, YouTube #1 cited in AIO (2025-10-01): searchengineland.com/youtube-ai-search-citations-data-462830
- Otterly YouTube citation study (2026-03): otterly.ai/blog/the-youtube-citation-study-2026/
- Google VideoObject / video sitemaps / video-as-main-content docs: developers.google.com/search/docs/appearance/structured-data/video, /crawling-indexing/sitemaps/video-sitemaps, /search/blog/2023/12/video-is-the-main-content
- SERP observations: live searches and fetches, 2026-07-20, including the follow-up checks that verified /custom-video/ holds #1 for "gohighlevel custom video production" and /highlevel-video-editing-service/ holds nothing.
