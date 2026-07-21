import type { Metadata } from "next";
import { BookingCalendars } from "@/components/BookingCalendars";
import { Reveal, RevealItem } from "@/components/Reveal";
import { PageHero } from "@/components/pages/PageHero";
import { ProofStrip } from "@/components/pages/ProofStrip";
import { cta, pages, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Book a HighLevel Video Call",
  description:
    "Book a 15-minute call with the HighLevel-only video studio. You leave with the right format and the real price. Or email hi@ghlvideo.com.",
  alternates: { canonical: "/contact/" },
};

export default function ContactPage() {
  const p = pages.contact;
  return (
    <>
      <PageHero
        chip={p.hero.chip}
        headline={p.hero.headline}
        accent={p.hero.accent}
        lede={p.hero.lede}
      />

      {/* the calendar carries the section: full width, fallbacks below */}
      <section data-bp-idx="2" className="relative section-pad-sm">
        <div className="shell">
          <div className="grid gap-8">
            <Reveal>
              <RevealItem>
                <BookingCalendars calendars={p.booking.calendars} />
              </RevealItem>
            </Reveal>

            <Reveal className="grid gap-px overflow-hidden border border-hair bg-hair md:grid-cols-2">
              <RevealItem className="h-full">
                <div
                  data-cell
                  className="h-full bg-canvas p-7 transition-colors duration-300 hover:bg-surface md:p-8"
                >
                  <p className="font-mono text-label uppercase text-gold">
                    [ Email us ]
                  </p>
                  <p className="mt-4 max-w-[38ch] font-display text-h3 text-ink">
                    {p.fallback.headline}
                  </p>
                  <p className="mt-3 text-body text-muted">
                    {p.fallback.line}
                  </p>
                  <a
                    href={`mailto:${site.email}`}
                    className="mt-6 inline-flex items-center gap-2 font-mono text-body font-semibold text-gold underline-offset-4 hover:underline"
                  >
                    {site.email}
                    <span aria-hidden="true">&rarr;</span>
                  </a>
                </div>
              </RevealItem>
              <RevealItem className="h-full">
                <div
                  data-cell
                  className="h-full bg-canvas p-7 transition-colors duration-300 hover:bg-surface md:p-8"
                >
                  <p className="font-mono text-label uppercase text-muted">
                    [ Custom project? ]
                  </p>
                  <p className="mt-4 max-w-[var(--measure-body)] text-body text-muted">
                    Skip the call and send the short form instead. A fixed
                    quote comes back within 24 hours.
                  </p>
                  <a
                    href={cta.requestQuote.href}
                    className="mt-5 inline-flex items-center gap-2 text-body font-semibold text-gold"
                  >
                    {cta.requestQuote.label}
                    <span aria-hidden="true">&rarr;</span>
                  </a>
                </div>
              </RevealItem>
            </Reveal>
          </div>
        </div>
      </section>

      {/* light proof, back on the dark ground before the footer */}
      <section data-bp-idx="3" className="relative section-pad-sm">
        <div className="shell">
          <ProofStrip quote='"Great quality and quick turnaround! Will definitely work with again!" Ryan Maule, Google review' />
        </div>
      </section>
    </>
  );
}
