"use client";

/*
 * The Help & guide view for the admin and customer portals. Static on
 * purpose: this is the platform explaining itself in plain language, one
 * audience at a time. The partner portal's equivalent is its Resources
 * view, which already carries the program guide.
 */

type Section = { title: string; lines: string[] };

const CUSTOMER_STEPS: { title: string; line: string }[] = [
  {
    title: "Complete your branding brief",
    line: "Every order starts with it: your logo, colors, dashboard screens, and how your brand name is said. Production starts the moment it lands.",
  },
  {
    title: "Follow progress on the order",
    line: "Each project moves Paid, Intake, In production, Review, Delivered. Open the order to see where it stands and read producer updates.",
  },
  {
    title: "Message the studio anytime",
    line: "Messages go straight to your producer. Revisions, questions, files: it all lives in one thread per project.",
  },
  {
    title: "Delivery lands on the order",
    line: "When your videos are ready you get an email, a notification here, and a delivery link on the order itself.",
  },
];

const CUSTOMER_FAQ: Section[] = [
  {
    title: "Where are my invoices?",
    lines: ["On each order. Open it and the invoice number sits with the order details."],
  },
  {
    title: "How do revisions work?",
    lines: ["Message the studio on the project thread. Your producer picks it up from there."],
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

const ADMIN_SECTIONS: Section[] = [
  {
    title: "The daily loop",
    lines: [
      "Dashboard is the pulse: revenue, paid orders, pending money, and the latest orders.",
      "Orders is where fulfillment happens: stages, delivery links, and client updates that email the customer and ring their bell.",
      "Messages is client chat. The badge on the menu is your unread count.",
    ],
  },
  {
    title: "How the money settles",
    lines: [
      "Checkout charges the price on the product row; Stripe confirms; the webhook flips the order paid exactly once and syncs it to HighLevel.",
      "Refunds and disputes made in Stripe flow back on their own. You never edit money by hand here.",
    ],
  },
  {
    title: "Catalog and pricing truth",
    lines: [
      "The website's catalog file is the price authority. After any price or product change is deployed, run Sync from catalog in Products & Pricing so checkout charges the new numbers.",
      "The Active switch on a product is the kill switch; the sync never touches it.",
    ],
  },
  {
    title: "Partners",
    lines: [
      "Applications arrive in Partners. Approve and set up the partner, then Invite: the invite button SENDS their access email, so press it when you mean it.",
      "Partner coupons live in Coupons under the Partner tab; pages with dedicated landing pages apply the code automatically.",
    ],
  },
  {
    title: "The Journal",
    lines: [
      "The build log, the decision register, and the idea inbox. Drop ideas there anytime; they get picked up at the start of every build session.",
    ],
  },
  {
    title: "Settings",
    lines: [
      "Your profile (name, photo, password) is yours; Team and Integrations need the Admin role. Integrations shows what is connected without exposing any keys.",
    ],
  },
];

export function PortalHelp({ audience }: { audience: "admin" | "customer" }) {
  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-h2 text-ink">Help &amp; guide</h1>
      <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
        {audience === "customer"
          ? "How your portal works, start to delivery."
          : "How the platform fits together, screen by screen."}
      </p>

      {audience === "customer" ? (
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
      ) : (
        <div className="mt-8 grid gap-3">
          {ADMIN_SECTIONS.map((s) => (
            <div key={s.title} className="rounded-[12px] border border-hair bg-surface p-5">
              <p className="text-body font-semibold text-ink">{s.title}</p>
              {s.lines.map((l) => (
                <p key={l} className="mt-1.5 text-body-sm leading-relaxed text-muted">
                  {l}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="mt-10 rounded-[12px] border border-gold/30 bg-gold/[0.04] p-6">
        <p className="font-mono text-label uppercase text-gold">Still stuck</p>
        <p className="mt-2 text-body text-muted">
          {audience === "customer"
            ? "Write to us or grab a call. A real person answers."
            : "Anything unclear, drop it in the Journal as an idea and it gets addressed next session."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="mailto:hi@ghlvideo.com"
            className="tap rounded-[8px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
          >
            hi@ghlvideo.com
          </a>
          {audience === "customer" ? (
            <a
              href="/contact/"
              className="tap rounded-[8px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
            >
              Book a Call
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
