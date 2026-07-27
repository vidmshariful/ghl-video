import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { CtaBand } from "@/components/CtaBand";
import { DrawnBorder } from "@/components/DrawnBorder";
import { MediaFrame } from "@/components/MediaFrame";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionGlow } from "@/components/SectionGlow";
import { SectionHead } from "@/components/SectionHead";
import { PageHero } from "@/components/pages/PageHero";
import { LaunchCountdown } from "@/components/pages/LaunchCountdown";
import { ReviewCard } from "@/components/ReviewCard";
import {
  checkoutHref,
  cta,
  home,
  pages,
  premadeBySlugTitle,
  premadePacks,
} from "@/lib/site";

/*
 * The 72-hour existing-customer launch page for the AI First SaaS Pack.
 * Unlisted on purpose: noindex, kept out of the sitemap (lib/pages-list
 * note + app/sitemap.ts EXCLUDE), never linked from the site chrome.
 * Only the campaign email carries the URL. The real offer gate is the
 * AIFIRST30 coupon row: when it expires or is switched off, checkout
 * stops honoring it no matter who still has the link.
 */
export const metadata: Metadata = {
  title: "AI First SaaS Pack, Client Launch",
  description:
    "The 72-hour early window on the AI First SaaS Pack for existing GHL Video clients.",
  robots: { index: false, follow: false },
};

type LaunchState = {
  kind: "ready" | "draft" | "scheduled";
  date?: string;
  src?: string | null;
};

/* deterministic date rendering (server + client agree) */
function fmtDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const usd = (cents: number) =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });

function Check() {
  return (
    <svg
      viewBox="0 0 14 14"
      className="mt-[5px] h-3.5 w-3.5 shrink-0"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2.5 7.5l3 3 6-7"
        stroke="var(--gold)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* numbered category header: the display-type name under its mono
   index, the one-line pitch below, and the video count on the rail */
function CatHead({
  index,
  name,
  line,
  count,
}: {
  index: number;
  name: string;
  line: string;
  count: number;
}) {
  return (
    <Reveal className="border-b border-hair pb-5">
      <RevealItem className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="min-w-0">
          <p className="font-mono text-label uppercase tracking-[0.14em] text-gold">
            [ 0{index} ]
          </p>
          <h3 className="mt-2.5 font-display text-h3 text-ink">{name}</h3>
          <p className="mt-2.5 max-w-[var(--measure-body)] text-body text-muted">
            {line}
          </p>
        </div>
        <p className="shrink-0 font-mono text-label uppercase text-dim">
          [ {count} {count === 1 ? "video" : "videos"} ]
        </p>
      </RevealItem>
    </Reveal>
  );
}

export default function AiFirstLaunchPage() {
  const p = pages.launch;
  const pack = premadePacks[0];
  /* the catalog's categories, in the campaign's presentation order */
  const CATEGORY_ORDER = ["Master Explainer", "Platform Demo", "Feature Explainers"];
  const categories = CATEGORY_ORDER.flatMap((name) => {
    const c = pack.categories.find((x) => x.name === name);
    return c ? [c] : [];
  });
  const states = p.videos.states as Record<string, LaunchState>;
  /* single-video categories pair up side by side; multi-video ones get
     their own full-width block */
  const singles = categories.filter((c) => c.videos.length === 1);
  const multis = categories.filter((c) => c.videos.length > 1);
  const catIndex = (name: string) =>
    categories.findIndex((c) => c.name === name) + 1;

  const orderHref = `${checkoutHref(pack.slug)}?code=${p.code}`;
  const regularCents = (pack.price ?? 0) * 100;
  const discountCents = Math.round((regularCents * p.percent) / 100);
  const launchCents = regularCents - discountCents;
  /* the bought-one-by-one value, summed from the same per-video prices
     the cards above show, so the math always adds up on the page */
  const valueCents = categories
    .flatMap((c) => c.videos)
    .reduce((s, v) => s + (premadeBySlugTitle[v.title]?.price ?? 495) * 100, 0);

  /* one library-style card for every video: a clean player (or the
     gradient date panel while in production), then the numbered title
     with the publish date highlighted above it, and the price. Corner
     tags: published cuts wear Ready, supplied drafts wear Draft
     preview. No single-buy controls; the pack is the offer. */
  const videoCard = (
    v: (typeof pack.categories)[number]["videos"][number],
    num: number,
  ) => {
    const state = states[v.title];
    const price = premadeBySlugTitle[v.title]?.price ?? 495;
    const src = v.src ?? state?.src;
    const dateLine =
      !v.src && state?.date
        ? `${p.videos.datePrefix} ${fmtDate(state.date)}`
        : null;
    const cornerTag = v.src ? p.videos.readyTag : src ? p.videos.draftTag : null;
    return (
      <div className="flex h-full flex-col">
        {src ? (
          <div className="relative">
            <MediaFrame
              src={src}
              poster={v.poster}
              label={v.title}
              tint
              rounded="rounded-none"
            />
            {cornerTag && (
              <span className="absolute left-2 top-2 z-20 border border-hair bg-canvas/85 px-2.5 py-1 font-mono text-label uppercase tracking-[0.08em] text-gold">
                {cornerTag}
              </span>
            )}
          </div>
        ) : (
          /* in production: the date panel stands in for the preview */
          <div className="flex aspect-video flex-col items-center justify-center border border-hair bg-[linear-gradient(135deg,rgba(0,144,252,0.16)_0%,rgba(0,144,252,0.05)_38%,rgba(0,0,0,0)_68%),#000]">
            {state?.date && (
              <p className="font-mono text-stat-lg font-bold leading-none text-gold [font-variant-numeric:tabular-nums]">
                {fmtDate(state.date)}
              </p>
            )}
            <p className="mt-2.5 font-mono text-label uppercase tracking-[0.14em] text-muted">
              {p.videos.datePrefix}
            </p>
          </div>
        )}
        <div className="flex-1 border-b border-hair px-1 pb-4 pt-3.5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {dateLine && src && (
                <p className="font-mono text-label uppercase tracking-[0.1em] text-gold">
                  {dateLine}
                </p>
              )}
              <h3
                className={`min-w-0 font-display text-h4 font-semibold leading-snug tracking-[-0.01em] text-ink ${
                  dateLine && src ? "mt-1" : ""
                }`}
              >
                <span className="[font-variant-numeric:tabular-nums]">
                  {String(num).padStart(2, "0")}:
                </span>{" "}
                {v.title}
              </h3>
            </div>
            <span className="shrink-0 font-mono text-body font-bold text-gold [font-variant-numeric:tabular-nums]">
              ${price.toLocaleString("en-US")}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* 1. hero: the offer, the clock, the code, the one button */}
      <PageHero
        chip={p.hero.chip}
        headline={p.hero.headline}
        accent={p.hero.accent}
        lede={p.hero.lede}
        signal={`Code ${p.code}, 30% off`}
      >
        <LaunchCountdown
          deadlineIso={p.deadlineIso}
          deadlineLabel={p.deadlineLabel}
          endsPrefix={p.countdown.endsPrefix}
          orderHref={orderHref}
          orderLabel={cta.orderPremade}
          videosLabel={p.countdown.videosLabel}
          closedLine={p.countdown.closedLine}
          closedCtaLabel={p.countdown.closedCtaLabel}
          closedHref={p.countdown.closedHref}
        />
      </PageHero>

      {/* 2. the nine videos: single-video categories side by side and
          big, then the features two-up, then the release schedule */}
      <section id="videos" data-bp-idx="2" className="relative scroll-mt-28 section-pad">
        <DrawnBorder />
        <div className="shell">
          <SectionHead
            index={2}
            chip={p.videos.chip}
            headline={p.videos.headline}
            accent={p.videos.accent}
            intro={p.videos.intro}
            center
          />

          {/* each single-video category is its own block on a 50/50
              grid, the card holding the left column; the features fill
              a two-up grid below. Videos number 01..09 in page order. */}
          {singles.map((cat, i) => (
            <div key={cat.name} className="mt-14">
              <CatHead
                index={catIndex(cat.name)}
                name={cat.name}
                line={cat.line}
                count={cat.videos.length}
              />
              <div className="mt-7 grid gap-8 lg:grid-cols-2">
                <Reveal>
                  <RevealItem>{videoCard(cat.videos[0], i + 1)}</RevealItem>
                </Reveal>
              </div>
            </div>
          ))}

          {multis.map((cat) => (
            <div key={cat.name} className="mt-16">
              <CatHead
                index={catIndex(cat.name)}
                name={cat.name}
                line={cat.line}
                count={cat.videos.length}
              />
              <Reveal className="mt-7 grid items-stretch gap-x-8 gap-y-10 sm:grid-cols-2">
                {cat.videos.map((v, vi) => (
                  <RevealItem key={v.title} className="h-full">
                    {videoCard(v, singles.length + vi + 1)}
                  </RevealItem>
                ))}
              </Reveal>
            </div>
          ))}
        </div>
      </section>

      {/* 3. the price story: the three delivery numbers, then the card */}
      <section data-bp-idx="3" className="relative overflow-x-clip section-pad">
        <SectionGlow position="right" />
        <div className="shell relative">
          <SectionHead
            index={3}
            chip={p.price.chip}
            headline={p.price.headline}
            accent={p.price.accent}
            center
          />

          <Reveal className="mx-auto mt-12 max-w-4xl">
            <RevealItem>
              <div className="relative border border-dashed border-hair bg-[linear-gradient(180deg,rgba(252,192,0,0.13),rgba(252,192,0,0.01)_70%)]">
                <span className="absolute -top-[13px] left-1/2 -translate-x-1/2 whitespace-nowrap border border-dashed border-gold/60 bg-canvas px-3 py-1 font-mono text-label uppercase text-gold">
                  {p.price.tag}
                </span>

                <div className="grid md:grid-cols-2">
                  {/* left: the math, as ruled rows that add up against
                      the per-video prices shown above */}
                  <div className="min-w-0 p-5 md:p-9">
                    <h3 className="font-display text-h3 text-ink">{pack.name}</h3>
                    <div className="mt-7">
                      <div className="flex items-baseline justify-between gap-4 py-3">
                        <span className="text-body text-muted">{p.price.valueNote}</span>
                        <s className="font-mono text-body text-dim [font-variant-numeric:tabular-nums]">
                          {usd(valueCents)}
                        </s>
                      </div>
                      <div className="flex items-baseline justify-between gap-4 border-t border-dashed border-hair py-3">
                        <span className="text-body text-muted">{p.price.regularNote}</span>
                        <s className="font-mono text-body text-dim [font-variant-numeric:tabular-nums]">
                          {usd(regularCents)}
                        </s>
                      </div>
                      <div className="flex items-baseline justify-between gap-4 border-t border-dashed border-hair py-4">
                        <span className="text-body font-medium text-ink">
                          {p.price.yourNote}
                        </span>
                        <span className="flex flex-col items-end">
                          <span className="font-mono text-[1.75rem] font-bold leading-none text-gold [font-variant-numeric:tabular-nums] md:text-stat-lg">
                            {usd(launchCents)}
                          </span>
                          <span className="mt-1 font-mono text-label uppercase text-dim">
                            {p.price.priceNote}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-4 border-t border-dashed border-hair py-3">
                        <span className="text-body text-muted">{p.price.saveNote}</span>
                        <span className="font-mono text-body font-semibold text-gold [font-variant-numeric:tabular-nums]">
                          {usd(discountCents)}, {p.percent}% off
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* right: what the order covers */}
                  <div className="min-w-0 border-t border-dashed border-hair p-5 md:border-l md:border-t-0 md:p-9">
                    <p className="font-mono text-label uppercase tracking-[0.12em] text-dim">
                      {p.price.includedLabel}
                    </p>
                    <ul className="mt-5 space-y-3.5">
                      {p.price.cardFeatures.map((f) => (
                        <li key={f} className="flex items-start gap-3">
                          <Check />
                          <span className="text-body leading-relaxed text-muted">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="border-t border-dashed border-hair p-5 md:px-9 md:py-7">
                  <Button href={orderHref} variant="gradient" size="md" className="w-full">
                    {cta.orderPremade}
                  </Button>
                  <p className="mt-4 text-center font-mono text-label uppercase text-dim">
                    {p.price.autoNote}
                  </p>
                </div>
              </div>
            </RevealItem>
          </Reveal>
        </div>
      </section>

      {/* 4. proof: the same real Google reviews the homepage quotes */}
      <section data-bp-idx="4" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <SectionHead
            index={4}
            chip={p.proof.chip}
            headline={p.proof.headline}
            accent={p.proof.accent}
            intro={p.proof.intro}
            center
          />
          <Reveal className="mt-12 grid items-start gap-5 md:grid-cols-2 lg:grid-cols-3">
            {home.reviews.items.slice(0, 6).map((r) => (
              <RevealItem key={r.name} className="h-full">
                <ReviewCard quote={r.quote} name={r.name} className="h-full" />
              </RevealItem>
            ))}
          </Reveal>
        </div>
      </section>

      {/* 5. closing */}
      <CtaBand
        bpIdx={5}
        headline={p.closing.headline}
        accent={p.closing.accent}
        sub={p.closing.sub}
        cta={{ label: cta.orderPremade, href: orderHref }}
      />
    </>
  );
}
