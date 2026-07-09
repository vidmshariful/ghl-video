import type { Metadata } from "next";
import { CellGrid } from "@/components/CellGrid";
import { EmbedSlot } from "@/components/EmbedSlot";
import { Reveal, RevealItem } from "@/components/Reveal";
import { PageHero } from "@/components/pages/PageHero";
import { ProofStrip } from "@/components/pages/ProofStrip";
import { cta, pages, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact and Book a Call",
  description:
    "Book a 15-minute call with the HighLevel-only video studio. You leave with the right format and the real price. Or email hi@ghlvideo.com.",
};

const callIcons = ["calendar-check", "crosshair", "badge-check"] as const;

export default function ContactPage() {
  const p = pages.contact;
  return (
    <>
      <PageHero
        chip={p.hero.chip}
        headline={p.hero.headline}
        accent={p.hero.accent}
        accentColor="green"
        lede={p.hero.lede}
      />

      {/* light zone: what happens on the call, then the calendar */}
      <div className="theme-light">
        <section data-bp-idx="2" className="relative py-16 md:py-20">
          <div className="shell">
            <CellGrid
              items={p.callPoints.map((s, i) => ({ ...s, icon: callIcons[i] }))}
              accent="green"
              numbered
            />
          </div>
        </section>

        <section data-bp-idx="3" className="relative pb-16 md:pb-20">
          <div className="shell">
            <div className="grid items-start gap-8 lg:grid-cols-[1.4fr_1fr]">
              {/* LeadConnector calendar slot (PLACEHOLDER until the embed
                  snippet arrives) */}
              <Reveal>
                <RevealItem>
                  <EmbedSlot
                    label="Booking calendar"
                    note={p.booking.note}
                    minH="min-h-[32rem]"
                  />
                </RevealItem>
              </Reveal>

              <Reveal className="grid gap-px self-start overflow-hidden border border-hair bg-hair">
                <RevealItem className="h-full">
                  <div
                    data-cell
                    className="h-full bg-canvas p-7 transition-colors duration-300 hover:bg-surface md:p-8"
                  >
                    <p className="font-mono text-label uppercase text-green">
                      [ Email us ]
                    </p>
                    <p className="mt-4 max-w-[38ch] font-display text-h3 text-ink">
                      {p.fallback.headline}
                    </p>
                    <p className="mt-3 text-[0.9375rem] text-muted">
                      {p.fallback.line}
                    </p>
                    <a
                      href={`mailto:${site.email}`}
                      className="mt-6 inline-flex items-center gap-2 font-mono text-[0.9375rem] font-semibold text-blue underline-offset-4 hover:underline"
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
                    <p className="mt-4 max-w-[38ch] text-[0.9375rem] text-muted">
                      Skip the call and send the short form instead. A fixed
                      quote comes back within 24 hours.
                    </p>
                    <a
                      href={cta.requestQuote.href}
                      className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-green"
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
      </div>

      {/* light proof, back on the dark ground before the footer */}
      <section data-bp-idx="4" className="relative py-16">
        <div className="shell">
          <ProofStrip quote='"Great quality and quick turnaround! Will definitely work with again!" Ryan Maule, Google review' />
        </div>
      </section>
    </>
  );
}
