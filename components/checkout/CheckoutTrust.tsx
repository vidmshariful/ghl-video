import Link from "next/link";
import { Button } from "@/components/Button";
import { Marquee } from "@/components/Marquee";
import { RuledBox } from "@/components/RuledBox";
import { SectionChip } from "@/components/SectionChip";
import { home, trustLogos } from "@/lib/site";

/*
 * The proof section under checkout, drawn in the site's blueprint grid: one
 * hairline mesh, solid canvas cells, no floating cards or gradient strips. A
 * centered label cell, then a bento: a tall left cell of two real reviews, a
 * logo-wall cell top-right, and a 2x2 grid of buy-with-confidence points. The
 * secure-payment strip lives up in the checkout box, not here.
 */

function LogoMark({ src }: { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- local asset
    <img
      src={src}
      alt=""
      loading="lazy"
      className="h-6 w-auto max-w-[8rem] shrink-0 object-contain opacity-50 [filter:brightness(0)_invert(1)] transition duration-300 hover:opacity-100 hover:[filter:none]"
    />
  );
}

function Stars() {
  return (
    <span className="inline-flex gap-0.5 text-gold" aria-label="Five stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 15l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
        </svg>
      ))}
    </span>
  );
}

function VerifiedTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 font-mono text-label uppercase text-gold">
      <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" aria-hidden="true">
        <path d="M2.5 7.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Verified
    </span>
  );
}

const CONFIDENCE: {
  title: string;
  body: string;
  link?: { label: string; href: string };
  icon: React.ReactNode;
}[] = [
  {
    title: "800+ SaaS clients",
    body: "The HighLevel businesses that brand their platform with us.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 6.5a3 3 0 0 1 0 6M17 19a5.5 5.5 0 0 0-2.3-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Full commercial rights",
    body: "Every video is yours to use across your whole funnel, forever.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path d="M12 3l7 3v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M8.8 12l2.2 2.2 4.2-4.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "HighLevel-fluent team",
    body: "Made by a team that never has to be taught the platform.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path d="M12 3l2.1 5.4L19.5 10l-5.4 1.6L12 17l-2.1-5.4L4.5 10l5.4-1.6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Clear refund policy",
    body: "Not the right fit?",
    link: { label: "Read our Refund Policy", href: "/legal/refund/" },
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M9 8h6M9 12h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function CheckoutTrust() {
  const lead = home.reviews.items[0]; // Ben Gallagher, the flagship
  const second = home.reviews.items[3]; // Kiwanna Clark, concise

  return (
    <section className="relative overflow-x-clip section-pad">
      <div className="shell">
        <RuledBox>
          {/* label cell: a small section chip, no oversized headline */}
          <div className="border-b border-hair px-6 py-9 text-center md:py-10">
            <SectionChip index={1} label="Buy with confidence" />
            <p className="mx-auto mt-5 max-w-[48ch] text-body leading-relaxed text-muted">
              Every order is the original HighLevel-only video team, behind the
              videos and behind you.
            </p>
          </div>

          {/* the bento mesh: left = two reviews (tall), right = logos over a 2x2,
              then one full-width closing CTA cell along the bottom */}
          <div className="grid gap-px bg-hair lg:grid-cols-2 lg:grid-rows-[auto_1fr_auto]">
            {/* left tall cell: the rating and two real reviews */}
            <div className="flex flex-col bg-canvas p-7 md:p-8 lg:row-span-2">
              <div className="flex flex-wrap items-center gap-3">
                <Stars />
                <span className="font-mono text-label uppercase tracking-[0.1em] text-muted">
                  5.0 on Google
                </span>
              </div>

              <div className="mt-8 flex flex-1 flex-col justify-center gap-7">
                <figure>
                  <blockquote className="text-lede leading-relaxed text-ink">
                    &ldquo;{lead.quote}&rdquo;
                  </blockquote>
                  <figcaption className="mt-4 flex flex-wrap items-center gap-2.5 text-body-sm">
                    <span className="font-semibold text-ink">{lead.name}</span>
                    <VerifiedTag />
                  </figcaption>
                </figure>

                <div aria-hidden="true" className="border-t border-hair" />

                <figure>
                  <blockquote className="text-body leading-relaxed text-muted">
                    &ldquo;{second.quote}&rdquo;
                  </blockquote>
                  <figcaption className="mt-3 flex flex-wrap items-center gap-2.5 text-body-sm">
                    <span className="font-semibold text-ink">{second.name}</span>
                    <VerifiedTag />
                  </figcaption>
                </figure>
              </div>
            </div>

            {/* right top: the logo wall */}
            <div className="bg-canvas p-7 md:p-8">
              <p className="font-mono text-label uppercase tracking-[0.12em] text-dim">
                [ <span className="text-muted">Trusted by</span> ]
              </p>
              <div className="mt-5">
                <Marquee>
                  {trustLogos.map((src) => (
                    <LogoMark key={src} src={src} />
                  ))}
                </Marquee>
              </div>
            </div>

            {/* right bottom: 2x2 grid of guarantees, cells joined by hairlines */}
            <div className="grid gap-px bg-hair sm:grid-cols-2">
              {CONFIDENCE.map((it) => (
                <div key={it.title} className="flex flex-col bg-canvas p-6 md:p-7">
                  <span className="text-gold">{it.icon}</span>
                  <p className="mt-4 font-display text-body font-semibold text-ink">
                    {it.title}
                  </p>
                  <p className="mt-1.5 text-body-sm leading-relaxed text-muted">
                    {it.body}
                    {it.link ? (
                      <>
                        {" "}
                        <Link
                          href={it.link.href}
                          className="font-medium text-gold underline-offset-2 hover:underline"
                        >
                          {it.link.label}
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
              ))}
            </div>

            {/* closing CTA: the last box, full width, a final nudge to finish */}
            <div className="flex flex-col items-center gap-6 bg-canvas px-6 py-10 text-center md:px-8 md:py-12 lg:col-span-2">
              <p className="mx-auto max-w-[58ch] font-display text-[1.5rem] font-semibold leading-snug tracking-[-0.01em] text-ink md:text-[1.75rem]">
                You have seen the reviews, the reach, and the rights you keep
                for good, so give your SaaS the white-label video your prospects
                remember and your funnel converts on.
              </p>
              <Button href="#checkout-box" size="lg">
                Complete your order
              </Button>
            </div>
          </div>
        </RuledBox>
      </div>
    </section>
  );
}
