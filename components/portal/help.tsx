"use client";

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

const CUSTOMER_STEPS: { title: string; line: string }[] = [
  {
    title: "Complete your branding brief",
    line: "Every order starts with it: your logo, colors, dashboard screens, and how your brand name is said. Production starts the moment it lands.",
  },
  {
    title: "Watch each video in My Videos",
    line: "Every video you have ordered lives there, on its own or inside a pack. We email you the moment one is ready, and anything waiting on you sits at the top.",
  },
  {
    title: "Leave notes at the exact second",
    line: "Press play, pause where you see something, and write. Your note remembers the moment, so there is no describing roughly where it was.",
  },
  {
    title: "Approve it, or ask for changes",
    line: "One round of changes is included on each video, so gather all your notes before you send them. Approving tells us it is finished.",
  },
  {
    title: "The order closes itself",
    line: "When you have approved every video the order is complete and we send you one email with all of them together.",
  },
];

const CUSTOMER_FAQ: Section[] = [
  {
    title: "Where are my invoices?",
    lines: ["On each order. Open it and the invoice number sits with the order details."],
  },
  {
    title: "How do revisions work?",
    lines: [
      "Open the video in My Videos, leave your notes, then press Request changes. One round is included on each video, so put every note in before you send them.",
      "Once you approve a video it is finished. If you need something after that, message us and we will re-open it for you.",
    ],
  },
  {
    title: "How do I manage my editing plan?",
    lines: [
      "Subscriptions shows your plan, renewal date, and billing. You can cancel or resume there; you keep access to the end of the period.",
    ],
  },
  {
    title: "How do I change my details, photo, or password?",
    lines: ["Settings, at the bottom of the menu. Name, company, phone, photo, and password all live there."],
  },
  {
    title: "Need another video?",
    lines: ["Browse the premade library at /premade/, or book a call and we will scope it with you."],
  },
];

export function PortalHelp() {
  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-h2 text-ink">Help &amp; guide</h1>
      <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
        How your portal works, from ordering to approving.
      </p>

      <>
          <h2 className="mt-8 font-display text-h4 text-ink">From order to delivery</h2>
          <ol className="mt-4 grid gap-3">
            {CUSTOMER_STEPS.map((st, i) => (
              <li key={st.title} className="flex gap-4 rounded-[12px] border border-hair bg-surface p-5">
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
