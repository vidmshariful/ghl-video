/* ------------------------------------------------------------------ */
/* Inner-page content                                                   */
/* ------------------------------------------------------------------ */

export const pages = {
  premade: {
    hero: {
      chip: "Premade Videos",
      headline: "Branded HighLevel videos,",
      accent: "ready when you are.",
      lede: "Browse the full library. Order any video on its own, or take a pack and save. Every one is white-labeled to your SaaS.",
      priceSignal: "Videos $495 to $995",
    },
    grid: {
      chip: "The library",
      headline: "Every video",
      accent: "and pack, in one place.",
      intro:
        "800+ HighLevel teams order from this library. Filter it on the left, open a pack to browse it as a playlist, and preview anything before you order.",
    },
    included: {
      chip: "What is included",
      headline: "Every video ships",
      accent: "white-label.",
      items: [
        "Your logo and brand colors on every frame",
        "Your dashboard theme and platform screens",
        "Professional voiceover in your choice of accent",
        "Brand-agnostic scripts, no competitor named",
        "Full commercial rights, no attribution",
      ],
    },
    how: {
      chip: "How it works",
      headline: "Order today,",
      accent: "publish this week.",
      steps: [
        {
          title: "Order",
          line: "Pick a single video or a full pack and check out. No call required.",
        },
        {
          title: "Send your brand kit",
          line: "Logo, colors, dashboard screens, and voiceover preference through the intake form.",
        },
        {
          title: "Receive and publish",
          line: "We white-label every video to your SaaS and deliver after a full review round.",
        },
      ],
    },
    faq: {
      chip: "FAQ",
      headline: "Asked before",
      accent: "every order.",
      items: [
        {
          q: "Is the video really mine to use anywhere?",
          a: "Yes. Every premade ships with full commercial rights. Run it as an ad, embed it on your site, use it in onboarding. No attribution, no license tiers.",
        },
        {
          q: "How custom does each video get?",
          a: "Your logo, your brand colors, your dashboard screens, and your voiceover. The scripts are brand-agnostic by design, so nothing names a competitor and the pack white-labels cleanly for your SaaS.",
        },
        {
          q: "Some videos say coming soon. What does that mean?",
          a: "It means the video is in production. Anything with a visible preview ships today, and coming-soon titles unlock for pack buyers as they release, at no extra cost.",
        },
        {
          q: "What if I need a different script or format?",
          a: "That is custom production. Starting prices are published on the custom page, and a quote takes one short form.",
        },
        {
          q: "How do I send my branding?",
          a: "After you order you get a short intake form: logo, colors, dashboard screens, and voiceover preference. Five minutes, then we take over.",
        },
      ],
    },
  },

  custom: {
    hero: {
      chip: "Custom Production",
      /* two lines like every other hero: the chip already says "Custom
         Production", so "Custom video" was paying for a third line twice */
      headline: "Built from scratch for",
      accent: "your platform and your ICP.",
      lede: "Custom video production by an in-house team that already knows HighLevel: scripted, voiced, and animated for your ICP. You explain your positioning once; we handle everything from script to final cut.",
    },
    /* 3. what every custom video has to do, before any craft talk */
    craft: {
      chip: "The craft",
      headline: "What goes into",
      accent: "every video.",
      intro:
        "Three jobs every custom video has to do. Everything else is craft in service of these.",
      items: [
        {
          title: "Hook",
          line: "The first seconds decide whether the rest gets watched. We open on the problem your buyer already has, not on your logo.",
        },
        {
          title: "Story",
          line: "One argument, start to finish. Every scene earns the next one, so the viewer is still there when the ask arrives.",
        },
        {
          title: "Conversion",
          line: "Every cut ends on one action. No menu of options, no soft close, no hoping they figure out the next step.",
        },
      ],
    },
    formats: {
      chip: "The formats",
      headline: "Four formats,",
      accent: "published starting prices.",
      intro:
        "Every project is quoted exactly before production starts. These are the floors, not estimates.",
      items: [
        {
          name: "Ads / Promo",
          from: 1500,
          line: "Short, punchy, conversion-first. Built to stop the scroll and sell the click.",
          mediaKey: "sampleC",
          includes: [
            "Script and hook written for the scroll",
            "Custom voiceover",
            "Motion graphics, captions, and sound",
            "Cut for every aspect ratio",
          ],
        },
        {
          name: "Explainer",
          from: 2500,
          line: "Your positioning in 60 to 90 seconds. The video that does the first sales call for you.",
          mediaKey: "featured",
          includes: [
            "Script and storyboard, approved by you",
            "Voiceover in your language and accent",
            "Full animation, 60 to 90 seconds",
            "Built to run your first sales call",
          ],
        },
        {
          name: "Demo",
          from: 3500,
          line: "Your actual platform, captured and narrated so prospects see the product win.",
          mediaKey: "sampleA",
          includes: [
            "Your live platform captured on screen",
            "Narrated feature by feature",
            "On-screen callouts and your branding",
            "Chaptered for sales and onboarding",
          ],
        },
        {
          name: "Onboarding Series",
          from: 5000,
          line: "A full walkthrough series that cuts support tickets and activates new users.",
          mediaKey: "sampleB",
          includes: [
            "A full multi-video walkthrough set",
            "Consistent branding across episodes",
            "Voiceover and captions throughout",
            "Built to cut your support tickets",
          ],
        },
      ],
    },
    pricing: {
      chip: "How pricing works",
      headline: "No estimates.",
      accent: "A fixed quote before we start.",
      points: [
        {
          title: "Published floors",
          line: "The starting prices above are real. No call required to learn the number.",
        },
        {
          title: "Exact quote in 24 hours",
          line: "Send the short quote form and we reply with a fixed price within a day.",
        },
        {
          title: "Locked before production",
          line: "The quote you approve is the price you pay. Scope changes are priced before work continues, never after.",
        },
      ],
    },
    process: {
      chip: "The process",
      headline: "Six steps,",
      accent: "no surprises.",
      steps: [
        {
          title: "Scope",
          line: "Quote form or a call. We map the goal, the audience, and the format.",
        },
        {
          title: "Script",
          line: "We write it in your voice. You approve every word before anything moves.",
        },
        {
          title: "Voice and style",
          line: "Voiceover casting in any language or accent, plus the visual direction.",
        },
        {
          title: "Production",
          line: "The in-house team builds the video. No handoffs to strangers.",
        },
        {
          title: "Review",
          line: "You give notes, we revise. The video ships when you say it ships.",
        },
        {
          title: "Delivery",
          line: "Final cuts in every format you need, with full commercial rights.",
        },
      ],
    },
    capabilities: [
      {
        title: "Any language, any accent",
        line: "Voiceover casting across markets, so your video sells wherever your SaaS does.",
      },
      {
        title: "In-house studio",
        line: "Script, design, animation, and edit under one roof. Nothing is outsourced.",
      },
      {
        title: "HighLevel fluency",
        line: "You never explain what a snapshot or a subaccount is. We already know.",
      },
    ],
    /* 6. real recent builds, not placeholders */
    samples: {
      chip: "Sample work",
      headline: "Custom work,",
      accent: "in action.",
      intro:
        "Recent builds for HighLevel SaaS. Scripted, voiced, and animated in house.",
    },
    /* 7. the difference: capabilities got a heading of its own */
    difference: {
      chip: "The difference",
      headline: "Made for",
      accent: "HighLevel brands.",
      intro: "A team that already knows the platform and the buyer.",
    },
    /* 8. two ways in. PLACEHOLDER embeds until the HighLevel snippets land. */
    getStarted: {
      chip: "Your next step",
      headline: "Send the brief",
      accent: "or talk it through.",
      intro:
        "Both land in the same place: a fixed quote and a real timeline. Pick whichever you prefer.",
      tabs: [
        {
          key: "quote",
          label: "Request a Quote",
          embedLabel: "Quote form",
          note: "The quote form drops in here. A human reads it and replies with a fixed price and a timeline within 24 hours.",
        },
        {
          key: "call",
          label: "Schedule a Discovery Call",
          embedLabel: "Booking calendar",
          note: "Thirty minutes. You talk through what you sell and what you need, and you leave with the right format and the real price.",
        },
      ],
    },
    /* 9. proof: real Google reviews, reused from the homepage set */
    proof: {
      chip: "Proof",
      headline: "Founders who",
      accent: "trust the work.",
      intro: "Every review below is a real one, pulled from Google.",
    },
    /* 10 */
    faq: {
      chip: "Questions",
      headline: "Your questions,",
      accent: "answered.",
      items: [
        {
          q: "How much does custom cost?",
          a: "Ads start at $1,500, explainers at $2,500, demos at $3,500, and onboarding series at $5,000. Those are floors, not estimates. You get an exact number in writing before anything goes into production.",
        },
        {
          q: "How long does it take?",
          a: "Most single videos ship in two to four weeks, depending on format and how many revision rounds you use. Onboarding series run longer. The timeline comes with the quote, so you know before you commit.",
        },
        {
          q: "Can you match my brand exactly?",
          a: "Colors, fonts, dashboard screens, and voice. You approve the script and the visual direction before production starts, so there is no reveal at the end that you did not see coming.",
        },
        {
          q: "What if I just need a simple video?",
          a: "Then custom is the wrong spend. The premade library is $495 a video, branded to you, and it ships in days. We will tell you that on the call rather than sell you a build you do not need.",
        },
      ],
    },
    /* 11 */
    closing: {
      headline: "Ready for video",
      accent: "built for you?",
      points: [
        "Custom scope and quote",
        "Built around your brand",
        "Made for HighLevel",
      ],
    },
    fit: {
      chip: "Fit",
      headline: "Built for some teams,",
      accent: "not for all.",
      intro: "Custom earns its cost when you have something specific to say.",
      cards: [
        {
          icon: "building",
          title: "SaaS resellers",
          line: "HighLevel SaaS resellers with real positioning to communicate.",
        },
        {
          icon: "crosshair",
          title: "Niche agencies",
          line: "Agencies packaging HighLevel for a specific niche.",
        },
        {
          icon: "layout",
          title: "Platform teams",
          line: "Platforms that need demo and onboarding coverage.",
        },
      ],
      cta: { label: "Request a Quote", href: "/quote/" },
      /* the "not for" disqualifier used to sit beside the "built for"
         list. Kept here, unused, so the copy is not lost if we want it
         back as a line under the cards. */
      notItems: [
        "One-off personal projects outside the HighLevel ecosystem",
        "Same-week turnarounds. Custom takes the time it takes",
        "Teams shopping on price alone. Premade exists for that",
      ],
    },
  },

  quote: {
    chip: "Quote request",
    headline: "Tell us about",
    accent: "your project.",
    lede: "Five fields, no budget sliders. A human reads it and replies with a fixed quote within 24 hours.",
    /* LeadConnector form replaces this at launch; the interim form
     * opens a prefilled email to hi@ghlvideo.com so nothing dead-ends */
    fields: {
      name: "Your name",
      email: "Email",
      company: "Company or SaaS",
      type: "Video type",
      details: "What are we making?",
    },
    types: ["Ads / Promo", "Explainer", "Demo", "Onboarding Series", "Not sure yet"],
    confirmation: "Request sent. We reply within 24 hours.",
    fallback: "Prefer to talk it through?",
  },

  editing: {
    hero: {
      chip: "Video Editing",
      headline: "Your in-house HighLevel editor,",
      accent: "on a monthly plan.",
      lede: "For creators who publish every week. Send raw footage, get back edits from a team that knows the ecosystem, and never miss a publishing schedule again.",
    },
    plans: {
      chip: "The plans",
      headline: "Pick your",
      accent: "monthly capacity.",
      featuredLabel: "Most chosen",
    },
    /* 3. name the pain before the price. A subscription buyer needs the
       argument before the number. */
    bottleneck: {
      chip: "The bottleneck",
      headline: "Editing is eating",
      accent: "your week.",
      intro:
        "You record fast. Then the timeline swallows the day, and the content that was going to grow the business sits in a folder.",
      items: [
        {
          title: "You are the bottleneck",
          line: "Every hour in the timeline is an hour not spent selling, building, or filming the next one.",
        },
        {
          title: "Explaining it twice",
          line: "A generic editor does not know what a snapshot or a subaccount is, so every brief turns into a lesson.",
        },
        {
          title: "The output swings",
          line: "Quality changes with whoever picked up the file, so the channel never looks like one thing.",
        },
      ],
    },
    /* 6. the objection-killers, promoted out of a single line of body
       copy under the plans. These are what actually unblock a monthly
       commitment, so they get a section. */
    allPlans: {
      chip: "Every plan includes",
      headline: "The same team,",
      accent: "whatever you spend.",
      intro:
        "Nothing below is a tier. Every plan gets all of it.",
      stats: [
        { v: "2 to 3", l: "day turnaround" },
        { v: "Unlimited", l: "revisions" },
        { v: "Zero", l: "contracts" },
      ],
      items: [
        {
          title: "HighLevel fluency",
          line: "Editors who already know the platform, the audience, and what a good HighLevel video sounds like.",
        },
        {
          title: "Unlimited revisions",
          line: "We cut until it is right. There is no revision counter and no per-change invoice.",
        },
        {
          title: "Fast turnaround",
          line: "Edits back in two to three business days, so a publishing schedule stays a schedule.",
        },
        {
          title: "No contracts",
          line: "Month to month. Pause when you stop filming, cancel when it stops paying. No exit call.",
        },
      ],
    },
    /* 8. real Google reviews, the same set the homepage quotes */
    proof: {
      chip: "Proof",
      headline: "Creators who",
      accent: "stopped editing.",
      intro: "Every review below is a real one, pulled from Google.",
    },
    /* 10 */
    closing: {
      headline: "Stop editing.",
      accent: "Start publishing.",
      points: ["No contracts", "Unlimited revisions", "Edits back in days"],
    },
    samples: {
      chip: "The difference",
      headline: "Raw in,",
      accent: "publish-ready out.",
      intro:
        "Raw talking-head footage in, publish-ready content out. Hooks, cuts, captions, and pacing handled.",
      before: { label: "Before", sub: "Raw footage" },
      after: { label: "After", sub: "Published edit" },
    },
    fit: {
      chip: "Fit",
      headline: "Made for people",
      accent: "who publish.",
      intro: "HighLevel video editing on a monthly plan, for people who ship on a schedule.",
      cards: [
        {
          icon: "calendar-check",
          title: "Weekly publishers",
          line: "HighLevel creators publishing every week.",
        },
        {
          icon: "mic",
          title: "Coaches and educators",
          line: "Turning calls and lessons into content.",
        },
        {
          icon: "building",
          title: "Agencies at volume",
          line: "Producing client content at scale.",
        },
      ],
      cta: { label: "Start editing", href: "#plans" },
      /* the "not for" disqualifier, kept unused so the copy survives if
         we want it back as a line under the cards. */
      notItems: [
        "One-off edits. The plans are monthly capacity",
        "Same-day turnarounds on every video",
        "Full production from scratch. That is custom",
      ],
    },
    how: {
      chip: "How it works",
      headline: "Send footage,",
      accent: "get content.",
      steps: [
        {
          title: "Send",
          line: "Drop raw footage in your shared folder with a note on what you want.",
        },
        {
          title: "We edit",
          line: "Hooks, cuts, captions, b-roll, and pacing by a HighLevel-fluent editor.",
        },
        {
          title: "You publish",
          line: "Review, request unlimited revisions, publish on schedule.",
        },
      ],
    },
    faq: {
      chip: "FAQ",
      headline: "Asked before",
      accent: "every subscription.",
      items: [
        {
          q: "What counts as long-form and short-form?",
          a: "Long-form is up to 15 minutes: YouTube videos, trainings, webinar cuts. Short-form is under 60 seconds: Reels, Shorts, TikTok. Your plan sets the monthly count of each.",
        },
        {
          q: "How fast do edits come back?",
          a: "Standard turnaround is 2 to 3 business days per video. Scale subscribers sit in the priority queue and go first.",
        },
        {
          q: "What does unlimited revisions actually mean?",
          a: "You ask, we revise, until you approve it. Every plan, every video, no revision caps and no upcharges.",
        },
        {
          q: "Can I cancel anytime?",
          a: "Yes. No contracts on any plan. You keep everything already delivered.",
        },
        {
          q: "Do you know HighLevel content or just editing?",
          a: "Both. The team edits HighLevel content daily, so funnels, snapshots, and dashboards get captioned correctly without you writing a glossary.",
        },
      ],
    },
  },

  /* /highlevel-demo-video/ : preserved ranking URL, rebuilt as a page */
  demo: {
    hero: {
      chip: "Demo Videos",
      headline: "Your platform, demoed",
      accent: "under your brand.",
      lede: "A white-label walkthrough of your SaaS: your dashboard theme, your logo, your voiceover. Prospects watch the platform win before they ever book the call.",
    },
    versions: {
      chip: "The versions",
      headline: "Three demos,",
      accent: "one job.",
      intro: "Every version shows the platform working under your brand. Pick the delivery style that fits your positioning.",
    },
    vsLoom: {
      chip: "Demo vs Loom",
      headline: "Retire the",
      accent: "Loom walkthrough.",
      rows: [
        {
          title: "Positioning",
          line: "A Loom says you record screencasts. A branded demo says you run a platform.",
        },
        {
          title: "Consistency",
          line: "The demo delivers the same pitch on every watch: on your site, in ads, and inside onboarding.",
        },
        {
          title: "Close rate",
          line: "Prospects arrive at the call pre-sold by a walkthrough that never skips the strong parts.",
        },
      ],
    },
    faq: {
      chip: "FAQ",
      headline: "Asked before",
      accent: "every demo order.",
      items: [
        {
          q: "What is a white label demo video?",
          a: "A walkthrough of the HighLevel platform branded as yours: your logo, your dashboard theme, and your voiceover, with full commercial rights. Nothing in it points back to us.",
        },
        {
          q: "Which demo version should I pick?",
          a: "V1 is spokesperson led, V2 is a motion graphic cut, and V3 covers the AI capabilities. Most resellers lead with V3 for AI-first positioning and add V1 when they want a human face.",
        },
        {
          q: "How custom is a premade demo?",
          a: "Your branding, dashboard theme, and voiceover are applied to a proven script. If you need a walkthrough built around your own flows and positioning, that is custom production.",
        },
      ],
    },
  },

  /* /highlevel-video-bundle/ : preserved ranking URL, rebuilt as a page */
  bundles: {
    hero: {
      chip: "Video Bundles",
      headline: "Every funnel stage,",
      accent: "one order.",
      lede: "Explainers, demos, and feature videos in one white-label order. Pick the new releases, the Classic Library, or a mix, and save against single-video pricing.",
    },
    picker: {
      chip: "The bundles",
      headline: "Three ways",
      accent: "to bundle.",
      intro: "Every bundle fixes the format counts; you pick the titles inside each format. Every video ships white-labeled to your SaaS.",
    },
    included: [
      { line: "Every video white-labeled: your logo, your colors, your voiceover" },
      { line: "Full commercial rights across the whole bundle" },
      { line: "One intake form covers the entire order" },
      { line: "Delivery timeline shown on every bundle before you order" },
    ],
    faq: {
      chip: "FAQ",
      headline: "Asked before",
      accent: "every bundle order.",
      items: [
        {
          q: "Can I choose which videos go in the bundle?",
          a: "Yes, within the format counts. A bundle fixes how many explainers, feature videos, or demos you get, and you pick the titles inside each format.",
        },
        {
          q: "Are bundle videos different from single orders?",
          a: "No. Same videos, same white-label pass, same commercial rights. The bundle exists so a full funnel costs less than ordering one video at a time.",
        },
        {
          q: "Which bundle should I start with?",
          a: "New Video Bundle Essential covers a launch. The Classic bundles carry the proven catalog at reduced pricing. Mix bundles cover both libraries in one order.",
        },
      ],
    },
  },

  about: {
    hero: {
      chip: "About",
      headline: "The original",
      accent: "HighLevel-only video studio.",
      lede: "One niche, one stack, 800+ HighLevel teams served. This page is the why.",
    },
    story: {
      chip: "The category",
      headline: "Why HighLevel-only",
      accent: "is the moat.",
      paragraphs: [
        "A generalist studio learns your product on your budget. Every hour they spend understanding what a snapshot is, you pay for. We made the opposite bet: one ecosystem, learned once, compounding across every project since.",
        "That bet changed the economics. Premade videos exist because the platform is the same under every brand, so the production can be shared and the price can drop. Custom work starts at the interesting part, your positioning, instead of the basics. Editing gets captions right the first time.",
        "The result is a studio where the client never teaches the vendor. You talk about your market and your angle. We already speak the rest.",
      ],
    },
    founder: {
      chip: "Founder",
      /* DRAFT: same standing note as the homepage founder line */
      quote:
        "Video is not marketing decoration. For a SaaS reseller it is sales infrastructure: the demo that runs while you sleep, the onboarding that scales without headcount. That is the standard we build to.",
    },
    clients: {
      chip: "Clients",
      headline: "Trusted by the founders",
      accent: "building on HighLevel.",
    },
    entity: {
      chip: "The company",
      headline: "One studio,",
      accent: "openly built.",
      lines: [
        "GHL Video is a brand of Vidiosa LLC, alongside growX and socialX.",
        "GHL Video is not affiliated with or endorsed by GoHighLevel Inc. We build for the ecosystem as an independent studio.",
      ],
    },
    /* entity questions AI engines get asked; answered in our words */
    faq: {
      chip: "FAQ",
      headline: "The questions",
      accent: "buyers verify.",
      items: [
        {
          q: "Who is behind GHL Video?",
          a: "GHL Video is a brand of Vidiosa LLC, founded and led by Shariful Islam, with a full-time in-house team covering scripting, voiceover, animation, and editing. Nothing is outsourced.",
        },
        {
          q: "Is GHL Video affiliated with GoHighLevel?",
          a: "No. GHL Video is not affiliated with or endorsed by GoHighLevel Inc. We are an independent studio that builds exclusively for the HighLevel ecosystem.",
        },
        {
          q: "Why work only in the HighLevel ecosystem?",
          a: "One platform, learned once, compounding across 800+ clients. You never brief us on what a snapshot or a subaccount is, so every project starts at your positioning instead of the basics.",
        },
      ],
    },
  },

  contact: {
    hero: {
      chip: "Contact",
      headline: "Book the call.",
      accent: "Leave with a plan.",
      lede: "Thirty minutes. You talk through what you sell and what you need; you leave with the right format and the real price.",
    },
    booking: {
      /* the four LeadConnector calendars, embedded individually so the
         booking screen stays on-brand (the HL group page is white and
         carries no theme settings; the calendars themselves are dark) */
      calendars: [
        {
          name: "Custom Video Strategy Call",
          line: "Scope a fully custom video for your brand and offer.",
          slug: "quick-questionsm04owt",
          mins: 30,
        },
        {
          name: "Premade Video Consultation",
          line: "Confirm fit and customization for premade videos.",
          slug: "quick-questions",
          mins: 30,
        },
        {
          name: "Video Editing Discovery Call",
          line: "Pick the right monthly editing plan for your volume.",
          slug: "quick-questionsrhuy1u",
          mins: 30,
        },
        {
          name: "Agency Partnership / White-Label Call",
          line: "Offer our videos to your clients under your own brand.",
          slug: "quick-questionsrhuy1u844j7q",
          mins: 30,
        },
      ],
    },
    fallback: {
      headline: "Not a call person?",
      line: "Email works. A human replies within 24 hours.",
    },
  },

  work: {
    hero: {
      chip: "Our work",
      headline: "Made for platforms",
      accent: "like yours.",
      lede: "A slice of recent work across premade, custom, and editing. Every piece below plays; click any frame for the full cut.",
    },
    /* PLACEHOLDER set: the same five CDN clips as the homepage. The
     * full portfolio drops in here when Shariful sends the final list. */
    note: "The full portfolio is being migrated. These pieces are the current sample set.",
  },
} as const;
