/*
 * The editing landing page: every word on it, in one file.
 *
 * A campaign page that sells the editing plans and nothing else, for paid ad
 * traffic and for the link we send when somebody replies to a cold email.
 * Ten sections, each with one job, in the order approved on 25 August 2026.
 *
 * WHY IT IS NOT THE /editing PAGE
 * -------------------------------
 * /editing is a site page: it sits in the marketing chrome, links out to
 * premade and custom, and is written for somebody browsing the whole studio.
 * This one has no nav, no exits and one decision on it. Two audiences land
 * here and they want different things, so the running order serves both: the
 * work is on screen by the third section for the cold click, and the price by
 * the fifth for the warm reply.
 *
 * Prices, plans and credit costs are NOT written here. They come from
 * lib/site.ts, which is the price authority, so this page cannot drift from
 * what checkout charges.
 */
import { studioSince } from "./core";

/* ------------------------------------------------------------------ */
/* Placeholder media                                                    */
/* ------------------------------------------------------------------ */

/*
 * Real clips from the library, standing in until the campaign footage is cut.
 *
 * Deliberately real files rather than empty frames: a page reviewed against
 * grey boxes is a page nobody can judge. Every one of these is replaced
 * before the first ad runs, and PLACEHOLDER is the string to grep for.
 */
const PLACEHOLDER = "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media";

export const editingLp = {
  /* -------------------------------------------------- 01. hero */
  hero: {
    /* the eyebrow asks the qualifying question rather than describing the
       product, so the right reader knows in three words that this is them */
    eyebrow: "Creating content around HighLevel?",
    headline: "Stop editing.",
    accent: "Start publishing.",
    lede: `Send us the raw file, get back a finished cut from a team that already knows the platform. No hiring, no per video quotes, no explaining HighLevel to anybody.`,
    videoSrc: `${PLACEHOLDER}/6a8d90e067ecc8731d23eac3.mp4`,
    videoPoster: null as string | null,
    priceNote: "Plans from",
    cta: { label: "Start editing", href: "#plans" },
    secondary: { label: "Book a Call", href: "/contact/" },
  },

  /* -------------------------------------------------- 02. the bottleneck */
  bottleneck: {
    eyebrow: "The bottleneck",
    headline: "You did not run out of ideas.",
    accent: "You ran out of edit time.",
    body: "The recording is the easy part. What stops the schedule is the four hours afterwards: the cuts, the captions, the b roll, the third export because the aspect was wrong. So the file sits on the desktop, the week goes by, and nothing goes out.",
    /* Three named bottlenecks, said flatly. Each is a real thing the reader
       has tried, and each is a different reason the schedule stopped, so the
       section is a diagnosis rather than three lines of agitation. */
    points: [
      {
        n: "01",
        title: "Editing it yourself",
        line: "Four hours a video that you are not getting back, on the one task nobody hired you to do. It is the first thing to slip the week anything else goes wrong.",
      },
      {
        n: "02",
        title: "A freelancer who went quiet",
        line: "Good for two months, then slower replies, then a week of silence with your footage on their drive. Now you are hiring again instead of publishing.",
      },
      {
        n: "03",
        title: "Hiring an editor in house",
        line: "Worth it at real volume, and a salary you cannot justify before that. So the footage waits for a hire that keeps getting postponed.",
      },
    ],
  },

  /* -------------------------------------------------- 03. the work */
  work: {
    eyebrow: "The work",
    headline: "Raw in,",
    accent: "published out.",
    intro:
      "The same recording, before and after. No commentary on this section, because the cut is the argument.",
    /* One pair. The raw file is not in yet, so that side renders SpVideo's
       placeholder rather than a stand-in: a stand-in on the BEFORE side would
       be a lie about what the AFTER side came from. */
    before: {
      label: "What you send us",
      src: null as string | null,
      poster: null as string | null,
      placeholder: "Raw file coming",
    },
    after: {
      label: "What you get back",
      src: `${PLACEHOLDER}/6a897e9167bb7ac3517e67e4.mp4`,
      poster: null as string | null,
    },
  },

  /* -------------------------------------------------- 04. how it works */
  how: {
    eyebrow: "How it works",
    headline: "Three steps,",
    accent: "and two of them are ours.",
    steps: [
      {
        n: "01",
        title: "Send the link",
        line: "Drive, Dropbox, Frame.io, wherever the footage already lives. Say what you want in a sentence, or say nothing and we cut it to your style guide.",
      },
      {
        n: "02",
        title: "We cut it, and check it",
        line: "An editor who knows HighLevel makes the cut, then it goes through the same six point check every time before you ever see it.",
      },
      {
        n: "03",
        title: "You watch it and approve",
        line: "Leave a note on the exact second if something is off. We change it. When you approve, it is finished and yours to download.",
      },
    ],
    promise:
      "Two to three business days per video, counted from when your footage reaches us.",
  },

  /* -------------------------------------------------- 05. the plans */
  plans: {
    eyebrow: "The plans",
    headline: "Pick the volume.",
    accent: "Change it whenever.",
    intro:
      "Every plan is the same team, the same turnaround and the same unlimited revisions. The only difference is how much you get through in a month.",
    /* the row under the three cards: the objections, answered once */
    includes: [
      {
        title: "Unlimited revisions",
        line: "We keep refining until you approve it. No revision caps, no per change fees.",
      },
      {
        title: "No contract",
        line: "Month to month. Change plan, pause or cancel from your portal.",
      },
      {
        title: "A HighLevel fluent team",
        line: `You never explain the platform. We have been making HighLevel videos since ${studioSince}.`,
      },
      {
        title: "Yours to run anywhere",
        line: "Every edit is yours outright, across ads, funnels, onboarding, socials.",
      },
    ],
  },

  /* -------------------------------------------------- 06. credits */
  credits: {
    eyebrow: "How credits work",
    headline: "One balance,",
    accent: "spent however the month goes.",
    intro:
      "You are not buying a number of videos. You are buying a balance, and you decide what it turns into. A month of shorts one month, two long form and a podcast the next.",
    note: "Credits reset every month and do not carry over. If you run out, top up and those extra credits stay until you use them.",
  },

  /* -------------------------------------------------- 07. who it is for */
  fit: {
    eyebrow: "Fit",
    headline: "Worth saying",
    accent: "who this is not for.",
    forYou: {
      title: "This is for you if",
      items: [
        "You publish every week, or you want to and editing is what stops you.",
        "You are a HighLevel agency, a SaaS founder, or you sell to that world.",
        "You already have the footage. Webinars, demos, talking head, podcasts.",
        "You want the output of an in house editor without the payroll.",
      ],
    },
    notForYou: {
      title: "This is not for you if",
      items: [
        "You need one video a quarter. Buy it as a one off instead.",
        "You need us to film it. We edit, we do not shoot.",
        "You need it back in four hours. We work in two to three business days.",
        "You want the cheapest editor on the internet. That is not us.",
      ],
    },
  },

  /* -------------------------------------------------- 08. proof */
  proof: {
    eyebrow: "Proof",
    headline: "People who publish weekly,",
    accent: "and one from inside HighLevel.",
    /*
     * REAL, NAMED PEOPLE. Their words go in `quote` when they send them and
     * their photo in `photo`. Both are null until then and the card renders a
     * pending state on purpose: putting a sentence somebody did not say next
     * to their name and face is not a placeholder, it is a fabricated
     * endorsement, and these three are known in this industry.
     */
    clients: [
      {
        name: "Beant Singh",
        company: "Extendly",
        photo: null as string | null,
        quote: null as string | null,
      },
      {
        name: "Jonah Cockshaw",
        company: "HighLevel creator",
        photo: null as string | null,
        quote: null as string | null,
      },
      {
        name: "Jenna Leadinghum",
        company: "HighLevel creator",
        photo: null as string | null,
        quote: null as string | null,
      },
    ],
    pending: "Their words are on the way.",
  },

  /* -------------------------------------------------- 09. faq */
  faq: {
    eyebrow: "Before you start",
    headline: "The questions",
    accent: "that come up.",
    items: [
      {
        q: "What if I do not like the edit?",
        a: "You leave a note on the second it goes wrong and we change it. There is no cap on that, and nothing counts as finished until you press approve. That is what unlimited revisions means here.",
      },
      {
        q: "What happens to credits I do not use?",
        a: "Plan credits reset when the month does and do not carry over, so the plan should match what you actually publish. Start lower and move up. Credits you top up with are different: those stay until you spend them.",
      },
      {
        q: "Do you only work on HighLevel videos?",
        a: "That is what we are known for and it is why briefing is short. But it is video editing, and plenty of what we cut for HighLevel founders is not about the platform at all: podcasts, ads, talking head, customer stories.",
      },
      {
        q: "How fast is it really?",
        a: "Two to three business days per video, counted from when your footage reaches us rather than from when you asked. If we cannot open your link, that clock has not started, and we tell you the same day.",
      },
      {
        q: "Can I cancel?",
        a: "From your portal, in a couple of clicks, whenever you want. There is no contract and no cancellation call to sit through. You keep everything we made you.",
      },
      {
        q: "Who actually does the editing?",
        a: `The same team every time, in one studio, working to a style guide we build for you before the first cut. Not a marketplace, not whoever is free. We have been making HighLevel videos since ${studioSince}.`,
      },
    ],
  },

  /* -------------------------------------------------- 10. close */
  closing: {
    headline: "Your next video",
    accent: "is three days out.",
    sub: "Pick a plan and send your first file today, or book a call and ask anything first.",
  },
} as const;
