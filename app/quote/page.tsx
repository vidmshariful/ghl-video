import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { QuoteForm } from "@/components/QuoteForm";
import { Reveal, RevealItem } from "@/components/Reveal";
import { PageHero } from "@/components/pages/PageHero";
import { cta, pages } from "@/lib/site";

export const metadata: Metadata = {
  title: "Request a Quote",
  description:
    "Tell us about your custom video project. Five fields, a human reads it, and you get a fixed quote within 24 hours.",
};

export default function QuotePage() {
  const q = pages.quote;
  return (
    <>
      <PageHero
        chip={q.chip}
        headline={q.headline}
        accent={q.accent}
        lede={q.lede}
      />

      {/* light zone: the form */}
      <div className="theme-light">
        <section data-bp-idx="2" className="relative section-pad-sm">
          <div className="shell">
            <div className="mx-auto max-w-3xl">
              <Reveal>
                <RevealItem>
                  <div className="border border-hair bg-surface p-7 md:p-10">
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
      </div>
    </>
  );
}
