/*
 * The team handbook: how this platform works and what to do at each stage.
 *
 * The rule that keeps it true
 * ---------------------------
 * Anything the system already knows is NOT written here. Statuses, the
 * revision policy, roles, the stages, which emails exist: those are read from
 * the code and database that implement them, at the moment the page is opened.
 * They cannot go stale because there is only one copy.
 *
 * What IS written here is judgement: what a thing is for, and what a person
 * should do about it. That cannot be derived, so it lives beside the code and
 * changes in the same commit. `npm run check:handbook` fails when a page talks
 * about something that no longer exists, which is the honest version of
 * "updates automatically".
 *
 * Proof this matters: the customer help page described handing over a single
 * delivery link months after we replaced that with per-video approval. Written
 * once, never revisited, quietly wrong.
 */

export type HandbookBlock =
  | { kind: "text"; body: string }
  | { kind: "steps"; steps: { title: string; body: string }[] }
  /* pulled live at read time; see the api route for what each id resolves to */
  | { kind: "facts"; id: FactId; intro?: string };

export type FactId =
  | "video-statuses"
  | "order-stages"
  | "revision-policy"
  | "roles"
  | "emails"
  | "catalog-counts";

export type HandbookPage = {
  slug: string;
  title: string;
  /* one line, shown in the index */
  summary: string;
  /* who most needs this */
  who: "Everyone" | "Studio" | "Sales" | "Owner";
  blocks: HandbookBlock[];
};

export const HANDBOOK: HandbookPage[] = [
  {
    slug: "how-an-order-flows",
    title: "How an order flows, start to finish",
    summary: "What happens between a client paying and the order finishing.",
    who: "Everyone",
    blocks: [
      {
        kind: "text",
        body: "Every paid order becomes a list of videos. A single video order becomes one, a pack becomes its contents, and a bundle becomes empty slots the client names on their brief. That list is the work: the studio board, the client's My Videos tab and the order page all read it.",
      },
      {
        kind: "steps",
        steps: [
          {
            title: "They pay",
            body: "The order is created, the videos it owes are worked out automatically, and the client gets a confirmation. Nobody needs to do anything.",
          },
          {
            title: "They send the brief",
            body: "Logo, colours, how the brand name is said, screens. On a bundle this is also where they choose which videos they want, and those choices fill the empty slots by themselves.",
          },
          {
            title: "We build",
            body: "Set each video to In production as you start it. The order's own stage follows the videos, so you never set it separately.",
          },
          {
            title: "We send each video",
            body: "Paste the HighLevel link and set it to Ready to review. That is the moment the client can watch it, and the moment they are emailed about it.",
          },
          {
            title: "They review each video",
            body: "They watch, leave notes at the exact second, then approve it or ask for changes.",
          },
          {
            title: "It finishes itself",
            body: "When the client approves the last video the order closes on its own and they get a wrap-up email with everything in it. There is no deliver button to press.",
          },
        ],
      },
      { kind: "facts", id: "order-stages", intro: "The stages an order moves through:" },
      {
        kind: "text",
        body: "The stage is calculated from the videos, not typed. If somebody sets it by hand it holds until the next time a video changes, and the job page will tell you when the videos disagree with it.",
      },
    ],
  },

  {
    slug: "the-studio-day",
    title: "Running the studio day",
    summary: "Where to start each morning and what each thing means.",
    who: "Studio",
    blocks: [
      {
        kind: "text",
        body: "Open Production. It starts on What needs us, which is every video across every order that is waiting on the studio, not a list of orders. Work down it. When it is empty, nothing is waiting on us.",
      },
      {
        kind: "steps",
        steps: [
          {
            title: "Answer the client",
            body: "Somebody left a note and nobody has replied or ticked it off. Do these first: there is a person on the other end wondering if we read it. Replying or marking it done takes it off the list.",
          },
          {
            title: "Changes to make",
            body: "They asked for changes and we have not sent a new cut. Paste the new link when it is ready; the old cut is kept automatically.",
          },
          {
            title: "Ready to start",
            body: "Paid, brief in, nothing built. Use Set all to on a pack rather than changing nine dropdowns.",
          },
          {
            title: "With the client",
            body: "Sent and waiting on them. Not our work, but the oldest ones are worth chasing. If they never come back you can approve it yourself to close the order.",
          },
        ],
      },
      {
        kind: "text",
        body: "The board is the second tab if you want the columns view. It has a search over client, invoice and product, and an only-my-jobs filter.",
      },
    ],
  },

  {
    slug: "video-statuses",
    title: "What each video status means",
    summary: "The five states, and what the client sees for each.",
    who: "Studio",
    blocks: [
      {
        kind: "text",
        body: "Setting a status is not just bookkeeping. It decides what the client can see and what they are told, so treat it as an action rather than a label.",
      },
      { kind: "facts", id: "video-statuses" },
      {
        kind: "text",
        body: "The client is never given the video link until it reaches Ready. Pasting a link early is safe: nothing is released until you set the status.",
      },
    ],
  },

  {
    slug: "reviews-and-revisions",
    title: "Reviews and revisions",
    summary: "How client feedback works and what we promise.",
    who: "Everyone",
    blocks: [
      {
        kind: "text",
        body: "A client watches a video in their portal and leaves notes pinned to the exact second. Each note can be replied to on its own, and both sides see the same thread. Their notes and our replies are the record of what was asked.",
      },
      { kind: "facts", id: "revision-policy" },
      {
        kind: "steps",
        steps: [
          {
            title: "A note arrives",
            body: "The person who owns the job gets a bell and an email. It also appears at the top of What needs us.",
          },
          {
            title: "Answer it",
            body: "Reply on the note itself so it is clear what you are answering, then tick it off once it is done.",
          },
          {
            title: "Send the new cut",
            body: "Paste the new link on the same video. The previous cut is kept and their old notes stay attached to it, so nothing loses its meaning.",
          },
          {
            title: "They approve",
            body: "The video turns green and its open notes close. Nothing else is needed from you.",
          },
        ],
      },
      {
        kind: "text",
        body: "Once a client approves a video their review screen closes for it. If they need something after that they message us and we re-open it from the job page.",
      },
    ],
  },

  {
    slug: "what-the-client-sees",
    title: "What the client actually sees",
    summary: "So you can answer them without guessing.",
    who: "Everyone",
    blocks: [
      {
        kind: "text",
        body: "Their portal has My Videos, which lists every video they own whether it came alone or inside a pack, with a still and a play button. A pack also gets its own tab with a progress bar. Anything waiting on them is pulled to the top and counted.",
      },
      {
        kind: "text",
        body: "Opening a video gives them the player large, with download, approve, request changes and the notes thread. An approved video shows the player and download only, with a line telling them to message us if they need anything else.",
      },
      {
        kind: "text",
        body: "Every video they are still waiting on carries a date. The clock starts when their brief arrives, not when they pay, because we cannot begin without their logo and notes, so a video with no brief in says so instead of showing a date. If we pass the date, the card says the date we had promised rather than going quiet. That is deliberate: a card that stops mentioning it once we are late is what makes somebody open a chat window to ask.",
      },
      {
        kind: "text",
        body: "They never see an unfinished cut. The link is withheld until the video is Ready, no matter what has been pasted in.",
      },
    ],
  },

  {
    slug: "products-and-prices",
    title: "Products, packs and prices",
    summary: "Where prices live and the one step people forget.",
    who: "Owner",
    blocks: [
      {
        kind: "text",
        body: "Everything sellable lives in one place: Products & Packs. A video is sold on its own or inside a pack. A pack has contents we choose. A bundle sells a count per category and the client picks the actual titles on their brief.",
      },
      { kind: "facts", id: "catalog-counts" },
      {
        kind: "text",
        body: "The step people forget: after changing a price or adding something, press Sync from catalog on the Products screen. Until you do, checkout is still charging the old price. The site and the checkout are two different tables and that button is the bridge.",
      },
      {
        kind: "text",
        body: "A video can be marked as not sold on its own. That is what feature animations are: they belong in a pack and never get their own buy button.",
      },
    ],
  },

  {
    slug: "emails",
    title: "What the system emails, and when",
    summary: "Every automatic email, so nothing surprises you.",
    who: "Everyone",
    blocks: [
      {
        kind: "text",
        body: "All of these are editable under Settings, Emails. They send through Brevo and fail quietly: if mail is down the action still works, it simply is not announced.",
      },
      { kind: "facts", id: "emails" },
    ],
  },

  {
    slug: "getting-on-the-site",
    title: "Getting on the site from a blocked country",
    summary: "Why the site refuses some visitors, and how the team gets past it.",
    who: "Everyone",
    blocks: [
      {
        kind: "text",
        body: "The public site turns away visitors from a short list of countries, and anyone on a VPN or proxy. That is deliberate and it is not about you: it exists because of the traffic those routes were bringing. If you are in one of those places, or working on a VPN, the site will simply say it is not available in your region.",
      },
      {
        kind: "steps",
        steps: [
          {
            title: "Get your key from Shariful",
            body: "Each person can have their own. Do not share yours around: keys are handed out and taken back one at a time, so a key that leaks only costs the person holding it.",
          },
          {
            title: "Open the unlock link once",
            body: "Visit /unlock/?key=YOUR-KEY on the real site. It checks the key and sends you to the homepage.",
          },
          {
            title: "That is it, for a year",
            body: "Your browser is remembered for a year, and that pass also lets you work on a VPN. You only repeat this on a new browser, a new device, or after clearing your cookies.",
          },
        ],
      },
      {
        kind: "text",
        body: "If it refuses your key, it is nearly always the key itself rather than you: copied with a space on the end, or one that has since been taken back. Ask for a fresh one rather than retrying the same one.",
      },
      {
        kind: "text",
        body: "This is only the public site. The admin, the client portal and the partner portal are behind their own logins and are not affected by any of this.",
      },
    ],
  },

  {
    slug: "who-can-see-what",
    title: "Roles and who can see what",
    summary: "What each role gets, and how to change it per person.",
    who: "Owner",
    blocks: [
      { kind: "facts", id: "roles" },
      {
        kind: "text",
        body: "A role is a starting point, not a cage. Under Settings, Team you can add or remove individual menu items for one person on top of their role. Only an Admin can manage the team.",
      },
    ],
  },

  {
    slug: "when-something-breaks",
    title: "When something breaks",
    summary: "What the Health screen tells you, and what to do about each thing on it.",
    who: "Owner",
    blocks: [
      {
        kind: "text",
        body: "Most faults on the payment path fix themselves. When Stripe cannot tell us about a payment, it tries again, and the second or third attempt almost always works. That is the system behaving correctly, and you are deliberately not told about it. The Health screen is for what did not fix itself.",
      },
      {
        kind: "text",
        body: "You find out two ways. A bell appears in the top bar of the admin, and for anything serious you also get an email. Nothing is sent more than once every thirty minutes for the same problem, so a bad afternoon cannot fill your inbox.",
      },
      {
        kind: "steps",
        steps: [
          {
            title: "A payment came in that we could not turn into an order",
            body: "Money was taken and there is nothing to attach it to. Nothing will fix this on its own. Open Stripe, find the payment, and either refund it or tell us what it was for so the order can be created by hand. This is the most serious thing on the screen.",
          },
          {
            title: "An order was paid but its videos were not created",
            body: "The client paid and is happy, but the order has no work list, so it will not appear on the studio board or in their video list. Nothing retries this. It is fixed by running the deliverables backfill, which rebuilds the list from what they bought.",
          },
          {
            title: "An order was charged a different amount than it should have been",
            body: "The price is worked out on our server and locked before the client pays, so this should be impossible. It means either a real bug or somebody interfering. Worth looking at the same day.",
          },
          {
            title: "A paid order did not reach HighLevel",
            body: "The payment is safe and recorded. What did not happen is the contact and opportunity being created, so the studio has no record of work that is already sold. This one does retry, so it only reaches you if it kept failing.",
          },
          {
            title: "The site and checkout disagree about a price",
            body: "A price was changed and the change never reached checkout, so the page shows one number and the card is charged another. Fix it by opening Products and pressing Sync from catalog. You do not need to come back and clear the alarm: the check runs again the next morning and closes it once the two agree.",
          },
          {
            title: "The daily price check could not run",
            body: "Not a problem with a price, a problem with the checking. It means nobody is watching for price drift until it is fixed, which looks exactly the same as nothing being wrong. Worth telling whoever maintains the site.",
          },
        ],
      },
      {
        kind: "text",
        body: "One of these you do not have to wait for. Prices are compared every morning, so a price that never reached checkout is caught within a day rather than whenever somebody happens to notice.",
      },
      {
        kind: "text",
        body: "Marking something handled is a claim that you fixed it, not a way to hide it. If the same problem happens again the line comes straight back and you are told again, so there is no way to quietly lose one.",
      },
    ],
  },
];

export const handbookPage = (slug: string) => HANDBOOK.find((p) => p.slug === slug);
