# GHL Video: SEO and AI-Search Guideline (2026)

Working document. We execute against this page by page. Facts, pricing, and voice follow the company profile (the master reference); where live reality contradicts it, the conflict is flagged in section 11, never silently overwritten.

Everything here was researched live on 2026-07-20: five research tracks with adversarial fact-checking, audits of ghlvideo.com (live), the Vercel preview, and the local build, plus a full teardown of ghlsaasvideo.com and a 7-query SERP map. Sources in section 12.

---

## 0. Where we stand (read this first)

**The good news, and it is significant:** ghlvideo.com currently holds the #1 organic position on 4 to 5 of the 7 core commercial queries in this niche, including "gohighlevel explainer video" (homepage), "gohighlevel demo video" (/highlevel-demo-video/), and "highlevel video bundle" (/highlevel-video-bundle/). The domain has real authority. We are not starting from zero; we are defending a lead.

**The emergency:** the production cutover is half-done and broken. www.ghlvideo.com serves the NEW homepage, but every route it links to (/premade/, /custom/, /editing/, /about/, /contact/, /quote/, /work/) returns a 404 in production. Every other path still serves the OLD WordPress site, which sells retired offers at prices that contradict the locked spec (custom from $1,250 instead of $1,500; editing Scale at $1,995 instead of $1,795; retired bundles at $995 to $2,995). A visitor lands on the new homepage and cannot click through to anything except the old blog. This is bleeding conversions today and will start bleeding rankings the moment Google recrawls the 404s.

**The redirect gap:** public/_redirects covers only legal URLs. The two old pages that hold #1 rankings have no plan. Eight old routes will 404 at full cutover. Fixing this is not an SEO nicety; it decides whether we keep the #1 positions that took years to earn.

---

## 1. The 2026 operating model: classic SEO, AEO, GEO

Direction, not theory. Every claim below survived adversarial fact-checking against independent sources.

### What changed, in numbers

- 68% of Google searches now end without a click to the open web (SparkToro/Similarweb, Jan to Apr 2026). When an AI Overview appears, clicks on traditional results drop from 15% to 8% of visits (Pew, behavioral panel).
- Being cited INSIDE the AI Overview recovers about half the lost clicks: +120% more clicks per impression vs not being cited (Seer Interactive, 53 brands, 5.47M queries, Feb 2026).
- Rankings still open the door but no longer guarantee entry: 97% of AI Overviews cite at least one top-20 result (seoClarity), but only 38% of AIO citations come from the top 10, down from 76% in mid-2025, because Google fans a query out into sub-queries and cites pages that answer those (Ahrefs, March 2026). Covering the main query plus its adjacent questions makes a page 161% more likely to be cited (Surfer SEO).
- Brand mentions beat backlinks for AI visibility: across 75,000 brands, branded web mentions correlate with AI visibility at 0.66 to 0.71 and YouTube mentions at 0.74, while backlinks sit at 0.10 to 0.33 (Ahrefs, Dec 2025).
- AI referrals are small in volume but roughly 4.4x more valuable per visitor than classic organic (Semrush), and 94% of B2B buyers now use AI during purchase research, ranking AI answer engines their #1 research source (Forrester 2026, 18,000 buyers).

### What this means for GHL Video

1. **Classic SEO is still the foundation.** Google AIO citations remain anchored to rankings; our #1 positions are the moat. Defend them through the cutover, then extend them. Nothing in AEO or GEO substitutes for a ranking commercial page.
2. **AEO (answer engine optimization) is a content-shape discipline.** Every page answers its query directly in the first two sentences under each heading, in extractable plain HTML. Question-form H2s, visible FAQ blocks, tables for prices. We write for the extractor as well as the reader.
3. **GEO (generative engine optimization) is mostly an OFF-SITE game.** Being NAMED in ChatGPT, Perplexity, and Gemini answers correlates with brand mentions across the web (YouTube above all, then communities, directories, LinkedIn), not with on-page tricks. The single highest-leverage GEO asset for a video studio is a YouTube channel with chaptered, transcript-clean samples: YouTube is the #1 cited domain in Google AI Overviews (29.5% citation share) and gets roughly 200x more AI citations than every other video platform combined. View counts show near-zero correlation with citation odds, so a small channel wins on structure.
4. **AI traffic is a conversion play, not a volume play.** Citations in AI answers are seen far more than clicked (only 1% of visits click a link inside an AI summary). The goal is to be the named vendor in the answer, so the buyer arrives pre-sold or searches the brand directly.

### Dead advice we will not spend on

- **llms.txt as a visibility lever.** Google states no AI system uses it (Mueller: comparable to the keywords meta tag; Illyes: not supported, not planned). Ahrefs server logs across 137,000 domains: 97% of llms.txt files received zero requests in May 2026. See section 6 for the 20-minute hedge position.
- **FAQ rich results.** Google deprecated them for ALL sites on May 7, 2026. FAQ CONTENT on the page still matters for AI extraction; the markup is now optional hygiene.
- **Backlink-first campaigns.** Mentions out-correlate links for AI visibility. Digital PR that produces named mentions beats guest-post link building.
- **One keyword, one page, thin.** Query fan-out rewards pages that answer the cluster of adjacent questions in one place.

---

## 2. The entity definition

This is the sentence set we want AI systems to repeat. Use the same phrasing, verbatim where possible, on the site, LinkedIn, Crunchbase, YouTube channel description, directory listings, and every guest appearance. Consistency of phrasing is the mechanism: LLMs learn entities from repeated co-occurrence.

**Short (under 160 characters):**
GHL Video is the original HighLevel-only video studio: white-label videos for GoHighLevel SaaS businesses and agencies, in-house since 2020.

**Standard:**
GHL Video is the original video studio built only for the HighLevel ecosystem, creating white-label videos for GoHighLevel SaaS businesses and agencies since 2020. A brand of Vidiosa LLC with a full-time in-house team, it has served 800+ clients across the US, Canada, UK, and Australia. Services: premade white-label videos priced by type from $97 to $995 (Explainer $495, Demo $995, plus bundles and the Classic Library), custom production with published starting prices from $1,500, and a monthly video editing subscription for HighLevel creators from $595. GHL Video is not affiliated with or endorsed by GoHighLevel Inc.

**Attribute list (for structured contexts):**
- Category: white-label video production studio for the HighLevel ecosystem
- Parent: Vidiosa LLC
- Founded into the niche: 2020 (see conflict flag, section 11)
- Clients: 800+ (the one canonical figure, everywhere)
- Rating: 5.0 on Google (17 reviews)
- Named clients: Dominic Bavaro (CEO, Emma.io), Ryan Maule (CEO, AI Clinic Assist), David Allen Neron (CEO, NeoLuxLabs)
- Markets: US, CA, UK, AU
- Founder: Shariful Islam
- Disclaimer: not affiliated with or endorsed by GoHighLevel Inc.

**Entity infrastructure to build (off-site, in priority order):**
1. YouTube channel, actively used (section 8). The strongest single correlate of AI visibility.
2. LinkedIn company page with the standard description verbatim.
3. Crunchbase profile for Vidiosa LLC and GHL Video.
4. Wikidata item once at least two independent citable sources exist (feeds Google's Knowledge Graph directly; highest-impact sameAs target).
5. All of the above wired into the Organization schema sameAs array (currently only YouTube, Facebook, Instagram).

---

## 3. Keyword map

Phrasing rule, verified against live SERPs: **"GoHighLevel" spelled out wins ranking titles.** Google folds "ghl X" and "gohighlevel X" into near-identical SERPs. "HighLevel" alone is official-docs voice. So: titles lead with GoHighLevel, body copy uses HighLevel per brand voice, slugs keep the existing "highlevel-" family that already ranks.

Intent traps, verified, do not chase: "gohighlevel video templates" (platform-feature intent, help-doc SERP) and bare "gohighlevel promo video" (polluted by GoHighLevel discount promos; fold promo intent into the custom Ads/Promo section instead).

### Existing pages

| Page | Focus keyword | Supporting | Status |
|---|---|---|---|
| / | gohighlevel video service | gohighlevel videos white label, white label video for highlevel saas | Ranks #1 on 3 queries today. Keep umbrella framing: premade + custom + editing in one view. |
| /premade/ | gohighlevel white label videos | premade highlevel videos, gohighlevel video library, buy gohighlevel videos | Add per-SKU Product+Offer schema, FAQ stays. |
| /custom/ | gohighlevel custom video production | custom saas explainer, promo video for gohighlevel saas, saas onboarding video series | Fold promo/ads intent here. |
| /editing/ | gohighlevel video editing service | video editing for highlevel creators, monthly video editing for agencies, video editing subscription for coaches | UNCONTESTED: no HighLevel-specific editing service ranks anywhere. Fastest new-cluster win on the board. |
| /work/ | gohighlevel video examples | white label saas video examples | Thin (227 words). Needs titles, purposes, transcripts, VideoObject (section 6). |
| /about/ | highlevel video studio (brand) | the original highlevel video studio | The entity anchor. Carries founder, 800+, named clients, Vidiosa family, markets. |
| /blog/ (Knowledge Hub) | question-form queries (section below) | | Exists in build, missing from sitemap. The uncontested informational layer. |
| /contact/, /quote/ | none (transactional) | | No keyword targets. |

### Pages to create or preserve (the money moves)

| Page | Focus keyword | Why |
|---|---|---|
| /highlevel-demo-video/ (PRESERVE the URL as a real page, rebuilt in the new design) | gohighlevel demo video | Holds #1 today. A 301 to /premade/ would gamble the ranking; a rebuilt page at the same URL keeps it. Demo $995 hero product, versions, white-label proof. |
| /highlevel-video-bundle/ (PRESERVE as a real page) | highlevel video bundle, gohighlevel video bundle | Holds #1 today. Rebuild with the current three bundle categories. ghlsaasvideo holds 3 slots on this SERP; do not hand them #1. |
| /highlevel-explainer-video/ (NEW) | gohighlevel explainer video | We rank #1 with the HOMEPAGE, which is fragile; the only purpose-built page in the SERP is the competitor's. A dedicated page for the $495 hero product with samples, pricing table, FAQ makes the position durable and doubles our SERP surface. |
| Knowledge Hub: cost guide post | saas explainer video cost, white label demo video cost | SERP owned by 2026-dated agency pricing guides anchoring $3,050 average for 60s. Our $495 to $995 premade pricing undercuts the cited market; publish our own transparent cost breakdown and become the price source AI quotes. |
| Knowledge Hub: comparison post | best explainer video service for gohighlevel | No independent comparison exists; the SERP returns the vendors themselves. The listicle/answer-page slot AI engines cite is unclaimed. First mover owns the framing. |
| Knowledge Hub: onboarding angle post | highlevel onboarding videos white label | Free libraries contest this SERP. Win with the churn/quality angle (what free videos cost you in churn), not on price. |

### The 15 questions to own (FAQ blocks + Knowledge Hub answers)

Each gets a direct, extractable answer on the most relevant page. These came from live SERP question mining and the HighLevel ideas board (an unmet-demand signal inside HighLevel itself).

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

---

## 4. Site architecture and the cutover plan

Order of operations. Do not reorder: each step protects the one after it.

1. **Deploy the full new build to production.** Every 404 behind the live homepage nav becomes a real page. This is the P0.
2. **Pick one host and align everything.** Today the apex 308-redirects to www, while every canonical-facing artifact we ship (sitemap URLs, JSON-LD url fields, site.url) says apex. Decide: serve on https://ghlvideo.com and redirect www to apex (matches everything already shipped; recommended), or flip site.url to www. One host, one story, everywhere.
3. **Ship the redirect + preservation map before or with cutover:**

| Old URL | Action |
|---|---|
| /highlevel-demo-video/ | KEEP: rebuild as a real page (holds #1) |
| /highlevel-video-bundle/ | KEEP: rebuild as a real page (holds #1) |
| /highlevel-explainer-video/ | CREATE new (no old equivalent) |
| /custom-video/ | 301 to /custom/ |
| /highlevel-video-editing-service/ | 301 to /editing/ |
| /highlevel-feature-animation/ | 301 to /premade/ |
| /highlevel-marketing-videos/ | 301 to /premade/ |
| /onboarding-process/ | 301 to /custom/ |
| /schedule-a-call/ | 301 to /contact/ |
| /contact-us/ | 301 to /contact/ |
| /blog/ | resolves (Knowledge Hub); add to sitemap |
| Old blog posts + seasonal promo pages | crawl the old sitemap for the full inventory; 301 posts to their new equivalents or /blog/, promos to /premade/ |

4. **Regenerate the sitemap at cutover** on the chosen host, including /blog/ and the preserved money pages; kill the stale 29-URL old-IA sitemap. Real lastmod values, not one identical date.
5. **Neutralize the preview domain.** ghl-video.vercel.app is fully indexable with no canonicals: a duplicate-content risk the day production serves the same build. Add per-page canonicals pointing at the production host (fixes preview and production in one move), and prefer Vercel deployment protection on the preview alias.
6. **Retire the old WordPress origin** after redirects are verified, so the contradictory prices ($1,250 custom, $1,995 Scale, retired bundles) stop being crawlable anywhere.

Internal linking rules after cutover:
- Homepage links to all three service pages plus the two preserved money pages within the first screen's nav.
- Every Knowledge Hub post links to exactly one primary service page with descriptive anchor text (not "learn more").
- The preserved /highlevel-demo-video/ and /highlevel-video-bundle/ pages cross-link to /premade/ as the library hub.
- Footer carries the service map sitewide (already true).

---

## 5. Technical checklist

Rendering is already right and must stay right. Everything else below is a gap.

- [x] **Server-rendered HTML.** Static export; every page's full copy, prices, and FAQ text are in the raw HTML. This is mandatory: none of the major AI crawlers (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, ChatGPT-User) execute JavaScript, confirmed through June 2026. Rule going forward: no visible fact may ever depend on client-side rendering.
- [ ] **Canonical tags: missing on every page.** Add metadataBase + alternates.canonical per page. Fixes the preview-domain duplication and hardens the host decision.
- [ ] **Open Graph + Twitter cards: zero anywhere.** Every share on LinkedIn/Facebook/Slack renders bare. Add og:title, og:description, og:image (1200x630), twitter:card sitewide. Also produce a real raster logo (Google prefers a raster for Organization logo; we currently point schema at logo.svg).
- [ ] **Schema per page** (JSON-LD, server-rendered; facts always ALSO visible on-page, never schema-only: controlled testing shows schema-only facts are never extracted):
  - Sitewide: Organization (+ sameAs grown per section 2) + WebSite. Shipped.
  - Service pages: Service + offers. Shipped. Extend premade with per-SKU Product+Offer for fixed-price SKUs (still a live Google rich result: price in the SERP; and we become the only machine-readable price source in the niche).
  - FAQPage where FAQs exist: keep (harmless, comprehension signal), but know the rich result is dead (May 2026). The visible FAQ text is what matters now.
  - /about/: AboutPage + Person (founder).
  - /contact/: ContactPage.
  - Knowledge Hub posts: Article + author Person.
  - Video pages: VideoObject, but ONLY where video is the main content (Google enforces this); see next item.
  - No aggregateRating until tied to genuine on-page reviews (already our policy).
- [ ] **Video layer** (the product is video; the site must be machine-readable about it):
  - Per-sample watch context: title, purpose, price, and a collapsed transcript present in the initial HTML (collapsed-but-in-DOM is indexed; loaded-after-click is invisible).
  - VideoObject (name, thumbnailUrl, uploadDate required; contentUrl, duration recommended) on pages where the video is the main content.
  - One video sitemap for self-hosted previews (still officially recommended, doc updated May 2026).
  - The hero showreel and hover-play grid are UX only: no schema, poster-first, lazy, reduced-motion-aware (already true). No SEO weight there.
- [ ] **robots.txt: stay open.** Current file (allow all + sitemap) is correct. Do NOT add AI-crawler disallows: blocking search-tier bots (OAI-SearchBot, PerplexityBot, Claude-SearchBot) removes citation eligibility; blocking training bots removes the brand from what future models know, with no benefit for a marketing site. Google-Extended stays unblocked (blocking it does not affect Search or AIO anyway, but there is no reason).
- [ ] **CDN bot settings: verify, this is the silent killer.** Cloudflare blocks many AI crawlers by default for new zones and tightens defaults again on September 15, 2026. If we move to Cloudflare Pages per the original plan, AI Crawl Control must be explicitly set to allow. On Vercel, confirm no bot-protection rule challenges AI user-agents. Check server logs for OAI-SearchBot and PerplexityBot hits after cutover to prove access.
- [ ] **llms.txt: the honest position.** Confirmed non-lever (Google: nothing reads it; 97% of files get zero requests). Ship a minimal one in 20 minutes AFTER everything above is done, as a free lottery ticket for fringe agent traffic. Budget zero ongoing effort. If any tool flags its absence as an "issue", ignore the tool.
- [ ] **IndexNow + Bing Webmaster Tools.** Microsoft is the only platform with first-party confirmation that schema feeds its LLMs, and ChatGPT search has leaned on Bing's index. IndexNow is cheap freshness signaling to that pipeline.
- [ ] **Core Web Vitals.** Static export is inherently fast; keep LCP on the poster image, never the video. Remove the ~611MB placeholder clip before cutover. Recheck CWV after the video layer ships.
- [ ] **Copy rules enforced sitewide** (from the profile): no em dashes, en dashes, middle dots, ellipsis characters; 800+ as the one client figure; CTAs name the action; disclaimer in every footer.

---

## 6. Competitor: ghlsaasvideo.com, and exactly how we beat them

They are visible on all 7 core queries with a per-format page architecture, a ranking YouTube channel, and a Facebook group. They undercut on entry price ($395 demo tier). Respect that. Then take the openings, which are structural, not cosmetic:

| # | Their gap (verified 2026-07-20) | Our move |
|---|---|---|
| 1 | Zero JSON-LD anywhere despite public prices, FAQs on every page, and a video portfolio | Ship the full schema layer (section 5). We become the only machine-readable pricing source in the niche, so AI answers to "how much does a white label GoHighLevel demo video cost" extract OUR numbers. |
| 2 | No informational layer at all: no blog, no about page; footer Blog/About/FAQ links are literally dead # placeholders | The Knowledge Hub owns every TOFU question in section 3 uncontested. Every AI citation for a HighLevel-video question defaults to the only site answering them. |
| 3 | Anonymous operation: no founder, no company story, no client count, generic industry stats as proof | Entity stack they cannot copy: since 2020, 800+ clients, 5.0 rating, three named CEO clients, a public founder, Vidiosa LLC brand family. On /about/ with Person schema, echoed sitewide. "Best/most trusted" queries and AI comparisons resolve on named, verifiable facts. |
| 4 | Three expired countdown sales running simultaneously (an EID deal from May, a February 48-hour sale, a Christmas countdown, all visible in July) and bundle prices that contradict each other between /deals and /bundle | Zero fake urgency, one price everywhere, driven from the single typed pricing source in lib/site.ts. Make transparent flat pricing an explicit trust feature in copy. Cross-shoppers see their stale countdowns next to our clean numbers. |
| 5 | "Buy Now" opens a Tally form, not a purchase; their /custom lead page has no meta description and no booking option | Every premade SKU and editing plan links to real per-SKU checkout at order.ghlvideo.com; /quote/ promises a 24-hour reply; /contact/ books a call. Say it in copy: order in minutes, no inquiry form. |
| 6 | No editing service, nothing for HighLevel content creators | /editing/ owns the entire cluster ("gohighlevel video editing", "video editing for highlevel creators") with zero competition from them. Their architecture cannot answer a whole buyer segment. |
| 7 | Portfolio is 7 YouTube thumbnails with boilerplate meta text; no on-page players, no VideoObject | Our portfolio plays on the page, and with section 5's video layer it becomes machine-readable: transcripts, VideoObject, video sitemap. A video studio whose site IS video, for buyers and machines. |
| 8 | Keyword-stuffed near-duplicate H1s (the same "skippable Loom" hook on two pages) and a meta description reading "explainer videos from GoHighLevel", flirting with implied affiliation | One distinct, intent-matched title/H1 pair per page; the non-affiliation disclaimer everywhere. We take the same queries with cleaner phrasing and claims that survive fact-checking (94% of AI users verify answers). |
| 9 | Entry-price undercut: $395 essential demo vs our by-type pricing | Do not race down. Counter with the $97 to $995 by-type range (our floor is LOWER than their $395 anchor), plus named proof and instant checkout. Value framing: what a bad demo costs in churn, not who is $100 cheaper. |

Their strength worth copying: the per-format page architecture. SERP evidence says dedicated per-format pages beat homepages on format queries. Section 3's page plan (preserved demo + bundle pages, new explainer page) is exactly that, done with our authority.

---

## 7. Content rules for AI citation

These apply to every page and every Knowledge Hub post. They come from the GEO literature (citations, quotations, statistics measurably lift generative visibility) and the 2026 extraction studies.

1. **Direct answer first.** The first one or two sentences under any H2 answer the heading's question completely, in plain declarative prose. The elaboration follows. AI extractors quote spans; give them a span worth quoting.
2. **Question-form H2s** matching real queries (section 3's list), one question per block.
3. **Specific, verifiable numbers near every claim.** $495, 5 to 7 days, 800+ clients, 17 reviews at 5.0, since 2020. Vague copy ("fast", "many clients") is invisible to extractors and unquotable.
4. **Facts live in visible HTML text.** Never schema-only (proven never extracted), never image-only, never behind JavaScript.
5. **FAQ blocks stay on service pages.** The Google rich result is dead; the extraction value is not. Answers under 50 words, standalone, no "as mentioned above".
6. **Tables for prices and comparisons.** Machines parse tables cleanly; so do skimming founders.
7. **One entity phrasing everywhere** (section 2). Every page that mentions the company describes it the same way.
8. **Citable stats in Knowledge Hub posts.** Cite named sources, quote named people (founder quotes count), and publish our own numbers (client-count milestones, delivery-time medians). Content with statistics and quotations wins generative visibility; it also earns the mentions that drive being named.
9. **Claims must survive fact-checking.** 94% of AI users verify at least sometimes. Nothing we publish should contradict the profile, the site, or Google reviews.
10. **Voice rules hold in every asset**, including YouTube descriptions and directory blurbs: founder to founder, no hype, no em dashes, no generic CTAs, disclaimer where the brand is described.

---

## 8. Off-site entity program (the GEO engine)

In priority order, because mentions, not markup, get brands named in AI answers:

1. **YouTube channel, treated as documentation.** Upload the best samples and short walkthroughs as long-form (not Shorts: 94% of AI-cited videos are long-form), with chapters, clean transcripts, question-based titles ("What does a white label GoHighLevel demo video look like?"), front-loaded descriptions carrying the entity phrasing and a link to the matching page. Perplexity and Google AIO drive 75%+ of YouTube citations; view counts barely matter; structure does.
2. **LinkedIn**: company page plus founder posting. LinkedIn is a top-cited domain across engines.
3. **Directory and profile layer**: Crunchbase, Clutch, G2 where applicable, HighLevel-ecosystem directories. Same description verbatim.
4. **Community presence with care**: the HighLevel Facebook groups, Reddit where genuinely helpful (Reddit is the #1 citation source across engines; it is also allergic to promotion; contribute, do not pitch).
5. **Digital PR for mentions**: podcast appearances in the HighLevel/agency space, guest posts that NAME the brand and its numbers even without links (unlinked mentions still correlate 0.66+ with AI visibility).
6. **Wikidata** once two or more independent sources exist to cite.

---

## 9. Measurement: share of answer, not just rankings

Track monthly, in one sheet. Rankings alone now measure a shrinking fraction of the outcome.

1. **Share-of-answer panel.** Run a fixed 20-prompt panel monthly (the 15 questions from section 3 plus the 5 head terms phrased as questions) across ChatGPT, Perplexity, Gemini, and Google AI Overviews (US). Score each: brand NAMED / site CITED / site LINKED / absent, and whether ghlsaasvideo is named. Share of answer = named percentage per engine. This is the primary AI-visibility KPI.
2. **Classic positions.** GSC positions, impressions, clicks for the 7 head queries. Non-negotiable target: zero lost #1 positions through cutover.
3. **AI referral segment.** Referrers chatgpt.com, perplexity.ai, gemini.google.com, copilot.microsoft.com. Track sessions AND conversion rate separately (expect low volume, multiple-x conversion premium; judge on conversions).
4. **Crawler access proof.** Server/CDN logs: OAI-SearchBot, PerplexityBot, Claude-SearchBot, GPTBot request counts monthly. Zero hits from search-tier bots means a gate is closed somewhere (see the CDN check in section 5).
5. **Brand mention count.** Monthly search for new unlinked mentions (Google, YouTube search, Reddit search for "GHL Video"). The leading indicator of being named in answers.
6. **Bing Webmaster Tools** impressions (the Copilot/ChatGPT-adjacent index).
7. **Quarterly SERP re-map** of the 7 core queries (the section 0 table refreshed), watching ghlsaasvideo's surface area.

---

## 10. Execution order (page by page, after the cutover P0s)

1. Cutover package: full deploy, host decision, redirect map, sitemap, canonicals, OG layer. (Sections 4 and 5.)
2. /highlevel-demo-video/ and /highlevel-video-bundle/ rebuilt at their URLs. Defend the #1s.
3. /highlevel-explainer-video/ new. Make the fragile #1 durable.
4. /editing/ content pass targeting the uncontested cluster.
5. Premade per-SKU Product+Offer schema plus the video layer on /work/ and sample pages.
6. /about/ entity stack + AboutPage/Person schema.
7. Knowledge Hub: cost guide, comparison post, onboarding-churn post, then the remaining questions.
8. YouTube channel setup and first six uploads.
9. Directory/profile layer and sameAs expansion.
10. llms.txt, IndexNow, measurement sheet baseline.

---

## 11. Conflicts and open questions (flagged, not overwritten)

1. **2019 vs 2020.** The company profile (source of truth) says "since 2020" throughout. But the live old site's bundle meta description and a blog teaser say "since 2019", and the internal auditor skill insists on 2019 ("never 2020"). One of these is wrong. The guide uses 2020 per the profile. **Shariful must confirm the true year before we publish the entity definition anywhere off-site.**
2. **"No year in customer copy" (CLAUDE.md) vs "since 2020" as the authority frame (profile).** The profile is newer and explicitly frames authority with the year. Treating the profile as superseding. Flagged because CLAUDE.md still says otherwise.
3. **Live-site pricing contradicts the locked spec** (custom from $1,250, Scale $1,995, retired bundles, strike-through discount framing). Resolved automatically by completing the cutover; listed here because until then, crawlers see two conflicting price sets under one domain.
4. **Premade JSON-LD floor**: currently lowPrice 495; profile says premade runs $97 to $995 (Classic Library floor is $97). Queued fix.
5. **"Order for $495" CTA string** in lib/site.ts: stale now that premade is priced by type. Profile's CTA vocabulary: Order Now. Queued fix.
6. **areaServed**: schema says Worldwide; profile says US, CA, UK, AU. Queued fix.
7. **LinkedIn URL** in socials is a "#" placeholder: excluded from sameAs automatically, needs the real URL.
8. **Old blog posts**: content and URL inventory not yet crawled; needed for the full redirect map.

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
- Semrush AI referral value / ChatGPT clickstream (2025): semrush.com/blog/chatgpt-search-insights/
- Forrester 2026 Buyers' Journey + TrustRadius 2026 (94% AI use in B2B buying): prnewswire.com/news-releases/trustradius-2026-b2b-buying-disconnect-report
- GEO paper, KDD 2024 (citations/quotes/stats +40% visibility): arxiv.org/abs/2311.09735
- llms.txt zero-request server logs (2026-07-02): ppc.land/llms-txt-adoption-rises-8-8x-but-97-of-files-get-zero-ai-requests/
- Google on llms.txt (Mueller, Illyes, 2025): seroundtable.com/google-ai-llms-txt-39607.html and searchenginejournal.com/google-says-llms-txt-comparable-to-keywords-meta-tag/544804/
- OpenAI bot docs (GPTBot / OAI-SearchBot / ChatGPT-User): developers.openai.com/api/docs/bots
- Anthropic crawler docs: support.claude.com/en/articles/8896518
- Perplexity bot docs: docs.perplexity.ai/guides/bots
- Google-Extended token docs: developers.google.com/search/docs/crawling-indexing/google-common-crawlers
- AI crawlers do not execute JS (Vercel 2024-12, reconfirmed 2026-06): vercel.com/blog/the-rise-of-the-ai-crawler
- Cloudflare AI crawler defaults (2025-07-01, tightening 2026-09-15): blog.cloudflare.com/content-independence-day-ai-options/
- FAQ rich results deprecated for all (2026-05-08): searchengineland.com/google-to-no-longer-support-faq-rich-results-476957
- Google: no special schema for AI features (2025-12-10): developers.google.com/search/docs/appearance/ai-features
- Microsoft: schema feeds Bing/Copilot LLMs (2025-03): searchengineland.com/microsoft-bing-copilot-use-schema-for-its-llms-453455
- OtterlyAI controlled schema experiment (2026-03-23): otterly.ai/blog/schema-markup-real-impact-ai-search/
- searchviu, schema in live AI fetches (2025-10-30): searchviu.com/en/schema-markup-and-ai-in-2025
- BrightEdge, YouTube #1 cited domain in AIO (2025-10-01): searchengineland.com/youtube-ai-search-citations-data-462830
- Otterly YouTube citation study (2026-03): otterly.ai/blog/the-youtube-citation-study-2026/
- Google VideoObject docs (2026-02-13): developers.google.com/search/docs/appearance/structured-data/video
- Google video sitemaps (2026-05-20): developers.google.com/search/docs/crawling-indexing/sitemaps/video-sitemaps
- Video-as-main-content rule (2023-12-04): developers.google.com/search/blog/2023/12/video-is-the-main-content
- SERP observations for the keyword map and competitor positions: live searches and page fetches, 2026-07-20.
