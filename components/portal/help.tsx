"use client";

import { REVISIONS_INCLUDED } from "@/lib/deliverable-status";

/*
 * The Help & guide view for the customer portal.
 *
 * The team's version of this used to live here too and had gone quietly out
 * of date: it still described handing over a single delivery link months
 * after we replaced that with per-video approval. It is now the Handbook in
 * admin, which reads its facts from the systems that own them so that
 * particular rot cannot happen again. This file is the client's half only.
 */

type Section = { title: string; lines: string[] };

/*
 * Three services, three journeys, one guide.
 *
 * The version this replaces described a portal that no longer existed. It
 * sent people to My Videos, which is now three screens, and it told everybody
 * that one round of changes was included, which is false on every editing
 * plan: those pages sell unlimited revisions. A help page that is wrong is
 * worse than none, because somebody acts on it.
 *
 * The revision counts below come from the same file the screens read, so that
 * particular rot cannot happen again.
 */

type Journey = { line: string; steps: { title: string; line: string }[] };

const REVISION_LINE = `${REVISIONS_INCLUDED === 1 ? "One round" : `${REVISIONS_INCLUDED} rounds`} of changes is included on each video, so gather all your notes before you send them.`;

const JOURNEYS: Journey[] = [
  {
    line: "Pre-made",
    steps: [
      {
        title: "Fill in your Brand Kit once",
        line: "Your logo, colours, dashboard screens and how your brand name is said. Every order after the first one uses the same details, and production starts the moment it lands.",
      },
      {
        title: "Find it under My Videos, Pre-made",
        line: "Everything you ordered from the library lives there, on its own or inside a pack. We email you the moment one is ready, and anything waiting on you sits at the top.",
      },
      {
        title: "Leave notes at the exact second",
        line: "Press play, pause where you see something, and write. Your note remembers the moment, so there is no describing roughly where it was.",
      },
      {
        title: "Approve it, or ask for changes",
        line: `${REVISION_LINE} Approving tells us it is finished.`,
      },
      {
        title: "The order closes itself",
        line: "When you have approved every video the order is complete and we send you one email with all of them together.",
      },
    ],
  },
  {
    line: "Custom",
    steps: [
      {
        title: "We scope it on a call",
        line: "Custom work starts with a conversation, not a form. Book a call and we agree what it is, what it costs and when you get it.",
      },
      {
        title: "Pay the invoice we send",
        line: "It appears at the top of Orders and Invoices with a button that pays it. Once it is paid the project starts.",
      },
      {
        title: "Follow it under My Videos, Custom",
        line: "Your project shows where it is up to, the brief we are working to, every video it owes you, and what has happened so far.",
      },
      {
        title: "Review each video the same way",
        line: `Play, pause, leave a note at the second. ${REVISION_LINE}`,
      },
      {
        title: "Finished projects stay put",
        line: "A project you have signed off stays in the same list marked Done, with its videos still one click away.",
      },
    ],
  },
  {
    line: "Editing",
    steps: [
      {
        title: "Ask for a video from My Videos, Editing",
        line: "Name it, say whether it is long or short form, where it is going, paste the link to your footage and tell us how you want it cut.",
      },
      {
        title: "Send us footage we can actually open",
        line: "Nothing is promised until your files are in. Check the link is shared with us. Turnaround is two to three business days per video, counted from when the footage reaches us, not from when you asked.",
      },
      {
        title: "Want short cuts from a long video?",
        line: "Ask for them on the same request, with a line saying which part each one comes from. Each cut is a video of its own, so each uses one of your short form slots.",
      },
      {
        title: "Watch what your colour tells you",
        line: "Every request carries its stage. Gold means it needs you, blue means an editor has it, green means it is done. Open any of them for the video and everything we know about it.",
      },
      {
        title: "Revisions are unlimited on your plan",
        line: "Put every note in first and we will do them in one pass, which is faster for you than three rounds. Your slots reset on your renewal date and do not carry over.",
      },
    ],
  },
];

const CUSTOMER_FAQ: Section[] = [
  {
    title: "Where do I pay, and where are my invoices?",
    lines: [
      "Billings, then Orders and Invoices. Anything you still owe sits at the top with a button that pays it.",
      "Everything you have already paid is listed underneath, whether you ordered it from the library or paid an invoice for it.",
    ],
  },
  {
    title: "How do revisions work?",
    lines: [
      `Open the video, leave your notes, then press Request changes. ${REVISION_LINE}`,
      "On an editing plan, revisions are unlimited. Put every note in first anyway: one pass is faster than three.",
      "Once you approve a video it is finished. If you need something after that, message us and we will re-open it for you.",
    ],
  },
  {
    title: "Something is waiting on me. Where?",
    lines: [
      "Your Dashboard counts it. Tap any of the three numbers at the top and it lists exactly which videos, whichever service they came from, with a button straight to each one.",
    ],
  },
  {
    title: "How do I manage my editing plan?",
    lines: [
      "My Videos, then Editing, is where you ask for videos and see what is left of your month.",
      "Billings, then Subscriptions, is the money side: your renewal date, what it costs, and cancelling or resuming. You keep access to the end of the period.",
    ],
  },
  {
    title: "How do I change my details, photo, or password?",
    lines: ["Settings, at the bottom of the menu. Name, company, phone, photo, and password all live there."],
  },
  {
    title: "Need another video?",
    lines: ["Browse the library under Get more videos, or book a call and we will scope it with you."],
  },
];

export function PortalHelp() {
  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-h2 text-ink">Help &amp; guide</h1>
      <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
        How your portal works. Three services, and the journey each one takes.
      </p>

      <>
          {/* one journey per service, because the three genuinely differ and
              a single list of steps had to lie about two of them */}
          {JOURNEYS.map((j) => (
            <div key={j.line}>
              <h2 className="mt-8 font-display text-h4 text-ink">{j.line}, start to finish</h2>
              <ol className="mt-4 grid gap-3">
                {j.steps.map((st, i) => (
                  <li
                    key={st.title}
                    className="flex gap-4 rounded-[12px] border border-hair bg-surface p-5"
                  >
                    <span className="font-mono text-h4 font-semibold text-gold">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className="text-body font-semibold text-ink">{st.title}</p>
                      <p className="mt-0.5 text-body-sm text-muted">{st.line}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
          <h2 className="mt-10 font-display text-h4 text-ink">Quick answers</h2>
          <div className="mt-4 grid gap-3">
            {CUSTOMER_FAQ.map((f) => (
              <div key={f.title} className="rounded-[12px] border border-hair bg-surface p-5">
                <p className="text-body font-semibold text-ink">{f.title}</p>
                {f.lines.map((l) => (
                  <p key={l} className="mt-1 text-body-sm text-muted">
                    {l}
                  </p>
                ))}
              </div>
            ))}
          </div>
      </>

      <div className="mt-10 rounded-[12px] border border-gold/30 bg-gold/[0.04] p-6">
        <p className="font-mono text-label uppercase text-gold">Still stuck</p>
        <p className="mt-2 text-body text-muted">
          Write to us or grab a call. A real person answers.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="mailto:hi@ghlvideo.com"
            className="tap rounded-[8px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
          >
            hi@ghlvideo.com
          </a>
          <a
            href="/contact/"
            className="tap rounded-[8px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
          >
            Book a Call
          </a>
        </div>
      </div>
    </div>
  );
}
