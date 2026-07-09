import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { QuoteForm } from "@/components/QuoteForm";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionChip } from "@/components/SectionChip";
import { SectionGlow } from "@/components/SectionGlow";
import { cta, pages } from "@/lib/site";

export const metadata: Metadata = {
  title: "Request a Quote",
  description:
    "Tell us about your custom video project. Five fields, a human reads it, and you get a fixed quote within 24 hours.",
};

export default function QuotePage() {
  const q = pages.quote;
  return (
    <section
      data-bp-idx="1"
      className="relative overflow-x-clip pt-28 pb-24 md:pt-32"
    >
      <SectionGlow accent="green" position="left" />
      <div className="shell relative">
        <div className="mx-auto max-w-3xl">
          <Reveal className="text-center">
            <RevealItem>
              <SectionChip index={1} label={q.chip} />
              <h1 className="mt-7 font-display text-hero text-ink">
                {q.headline} <span className="text-green">{q.accent}</span>
              </h1>
              <p className="mx-auto mt-5 max-w-[52ch] text-lede text-muted">{q.lede}</p>
            </RevealItem>
          </Reveal>

          <Reveal className="mt-12">
            <RevealItem>
              <div className="rounded-card border border-hair bg-canvas p-7 md:p-10">
                <QuoteForm />
              </div>
            </RevealItem>
          </Reveal>

          <Reveal className="mt-12">
            <RevealItem>
              <div className="flex flex-wrap items-center justify-between gap-5 border-t border-hair pt-8">
                <p className="text-lede text-muted">{q.fallback}</p>
                <Button href={cta.bookACall.href} variant="ghost">
                  {cta.bookACall.label}
                </Button>
              </div>
            </RevealItem>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
