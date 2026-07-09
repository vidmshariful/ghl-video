import type { Metadata } from "next";
import { CellGrid } from "@/components/CellGrid";
import { DrawnBorder } from "@/components/DrawnBorder";
import { EmbedSlot } from "@/components/EmbedSlot";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionChip } from "@/components/SectionChip";
import { SectionGlow } from "@/components/SectionGlow";
import { ProofStrip } from "@/components/pages/ProofStrip";
import { cta, pages, site } from "@/lib/site";

const callIcons = ["calendar-check", "crosshair", "badge-check"] as const;

export const metadata: Metadata = {
  title: "Contact and Book a Call",
  description:
    "Book a 15-minute call with the HighLevel-only video studio. You leave with the right format and the real price. Or email hi@ghlvideo.com.",
};

export default function ContactPage() {
  const p = pages.contact;
  return (
    <>
      <section
        data-bp-idx="1"
        className="relative overflow-x-clip pt-28 md:pt-32"
      >
        <SectionGlow accent="green" position="left" />
        <div className="shell relative">
          <Reveal className="text-center">
            <RevealItem>
              <SectionChip index={1} label={p.hero.chip} />
              <h1 className="mx-auto mt-7 max-w-[20ch] font-display text-hero text-ink">
                {p.hero.headline}{" "}
                <span className="text-green">{p.hero.accent}</span>
              </h1>
              <p className="mx-auto mt-6 max-w-[54ch] text-lede text-muted">
                {p.hero.lede}
              </p>
            </RevealItem>
          </Reveal>
          <div className="mt-12">
            <CellGrid
              items={p.callPoints.map((s, i) => ({ ...s, icon: callIcons[i] }))}
              accent="green"
              numbered
            />
          </div>
        </div>
      </section>

      {/* booking */}
      <section data-bp-idx="2" className="relative section-pad">
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

            <Reveal className="grid gap-px self-start overflow-hidden rounded-card border border-hair bg-hair">
              <RevealItem className="h-full">
                <div data-cell className="h-full bg-canvas p-7 transition-colors duration-300 hover:bg-surface md:p-8">
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
                <div data-cell className="h-full bg-canvas p-7 transition-colors duration-300 hover:bg-surface md:p-8">
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

      {/* light proof */}
      <section data-bp-idx="3" className="relative pb-24">
        <DrawnBorder />
        <div className="shell pt-16">
          <ProofStrip quote='"Great quality and quick turnaround! Will definitely work with again!" Ryan Maule, Google review' />
        </div>
      </section>
    </>
  );
}
