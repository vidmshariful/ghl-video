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
import {
  checkoutHref,
  cta,
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

/* numbered category header, shared by both grid blocks */
function CatHead({ index, name, line }: { index: number; name: string; line: string }) {
  return (
    <Reveal className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-hair pb-4">
      <RevealItem>
        <p className="font-mono text-label uppercase tracking-[0.14em] text-gold">
          [ 0{index} ] {name}
        </p>
      </RevealItem>
      <RevealItem className="min-w-0">
        <p className="max-w-[var(--measure-body)] text-body-sm text-muted">{line}</p>
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
  const anchorCents = (pack.anchorPrice ?? 0) * 100;
  const regularCents = (pack.price ?? 0) * 100;
  const discountCents = Math.round((regularCents * p.percent) / 100);
  const launchCents = regularCents - discountCents;

  /* one library-style card for any watchable video (published or
     supplied draft cut): preview, title, price, status. No single-buy
     controls on this page; the pack is the offer. */
  const videoCard = (v: (typeof pack.categories)[number]["videos"][number]) => {
    const state = states[v.title];
    const price = premadeBySlugTitle[v.title]?.price ?? 495;
    const isDraftClip = !v.src && Boolean(state?.src);
    const status = v.src
      ? p.videos.liveNote
      : state?.kind === "ready"
        ? state.date
          ? `${p.videos.statusReady}, ${fmtDate(state.date)}`
          : p.videos.statusReady
        : state?.date
          ? `${p.videos.statusProduction} ${fmtDate(state.date)}`
          : p.videos.scheduleLabel;
    return (
      <div className="flex h-full flex-col">
        <div className="relative">
          <MediaFrame
            src={(v.src ?? state?.src) as string}
            poster={v.poster}
            label={v.title}
            tint
            rounded="rounded-none"
            caption={{ title: v.format, sub: status }}
          />
          {isDraftClip && (
            <span className="absolute left-2 top-2 z-20 border border-hair bg-canvas/85 px-2.5 py-1 font-mono text-label uppercase tracking-[0.08em] text-gold">
              {p.videos.draftTag}
            </span>
          )}
        </div>
        <div className="flex flex-1 items-start justify-between gap-4 border-b border-hair px-1 pb-4 pt-3.5">
          <h3 className="min-w-0 font-display text-h4 font-semibold leading-snug tracking-[-0.01em] text-ink">
            {v.title}
          </h3>
          <span className="shrink-0 font-mono text-body font-bold text-gold [font-variant-numeric:tabular-nums]">
            ${price.toLocaleString("en-US")}
          </span>
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
          />

          <div className="mt-12 grid items-start gap-x-8 gap-y-14 lg:grid-cols-2">
            {singles.map((cat) => (
              <div key={cat.name}>
                <CatHead index={catIndex(cat.name)} name={cat.name} line={cat.line} />
                <Reveal className="mt-7">
                  <RevealItem>{videoCard(cat.videos[0])}</RevealItem>
                </Reveal>
              </div>
            ))}
          </div>

          {multis.map((cat) => {
            const playable = cat.videos.filter(
              (v) => v.src || states[v.title]?.src,
            );
            const scheduled = cat.videos.filter(
              (v) => !v.src && !states[v.title]?.src,
            );
            return (
              <div key={cat.name} className="mt-16">
                <CatHead index={catIndex(cat.name)} name={cat.name} line={cat.line} />
                <Reveal className="mt-7 grid items-stretch gap-x-8 gap-y-10 sm:grid-cols-2">
                  {playable.map((v) => (
                    <RevealItem key={v.title} className="h-full">
                      {videoCard(v)}
                    </RevealItem>
                  ))}
                </Reveal>

                {scheduled.length > 0 && (
                  <Reveal className="mt-12">
                    <RevealItem>
                      <p className="font-mono text-label uppercase tracking-[0.14em] text-dim">
                        [ {p.videos.scheduleLabel} ]
                      </p>
                      <ul className="mt-2 border-b border-hair">
                        {scheduled.map((v) => {
                          const state = states[v.title];
                          const single = premadeBySlugTitle[v.title];
                          const price = single?.price ?? 495;
                          return (
                            <li
                              key={v.title}
                              className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1.5 border-t border-hair py-4"
                            >
                              <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
                                {state?.date && (
                                  <span className="font-mono text-label uppercase text-gold [font-variant-numeric:tabular-nums]">
                                    [ {fmtDate(state.date)} ]
                                  </span>
                                )}
                                <span className="font-display text-h4 font-semibold leading-snug text-ink">
                                  {v.title}
                                </span>
                                <span className="font-mono text-label uppercase text-dim">
                                  {v.format}
                                </span>
                              </div>
                              <span className="shrink-0 font-mono text-label uppercase text-muted [font-variant-numeric:tabular-nums]">
                                ${price.toLocaleString("en-US")}{" "}
                                <span className="text-dim">{p.videos.atRelease}</span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </RevealItem>
                  </Reveal>
                )}
              </div>
            );
          })}
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

          <Reveal className="mx-auto mt-12 max-w-xl">
            <RevealItem>
              <div className="relative flex flex-col border border-dashed border-hair bg-[linear-gradient(180deg,rgba(252,192,0,0.13),rgba(252,192,0,0.01)_70%)] p-7 md:p-8">
                <span className="absolute -top-[13px] left-1/2 -translate-x-1/2 whitespace-nowrap border border-dashed border-gold/60 bg-canvas px-3 py-1 font-mono text-label uppercase text-gold">
                  {p.price.tag}
                </span>

                <h3 className="font-display text-h3 text-ink">{pack.name}</h3>

                <p className="mt-6 flex items-baseline gap-2">
                  <span className="font-mono text-stat-lg font-bold leading-none text-gold [font-variant-numeric:tabular-nums]">
                    {usd(launchCents)}
                  </span>
                  <span className="font-mono text-label uppercase text-dim">
                    {p.price.priceNote}
                  </span>
                </p>
                <p className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1">
                  <span className="flex items-baseline gap-2">
                    <span className="font-mono text-body text-dim line-through [font-variant-numeric:tabular-nums]">
                      {usd(regularCents)}
                    </span>
                    <span className="font-mono text-label uppercase text-muted">
                      {p.price.regularNote}
                    </span>
                  </span>
                  <span className="flex items-baseline gap-2">
                    <span className="font-mono text-body text-dim line-through [font-variant-numeric:tabular-nums]">
                      {usd(anchorCents)}
                    </span>
                    <span className="font-mono text-label uppercase text-muted">
                      {p.price.anchorNote}
                    </span>
                  </span>
                </p>
                <p className="mt-2 font-mono text-label uppercase text-gold">
                  save {usd(discountCents)}
                </p>

                <div className="my-6 border-t border-dashed border-hair" aria-hidden="true" />

                <ul className="space-y-3">
                  {p.price.cardFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <Check />
                      <span className="text-body leading-relaxed text-muted">{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  href={orderHref}
                  variant="gradient"
                  size="md"
                  className="mt-7 w-full"
                >
                  {cta.orderPremade}
                </Button>
                <p className="mt-4 text-center font-mono text-label uppercase text-dim">
                  {p.price.autoNote}
                </p>
              </div>
            </RevealItem>
          </Reveal>
        </div>
      </section>

      {/* 4. closing */}
      <CtaBand
        bpIdx={4}
        headline={p.closing.headline}
        accent={p.closing.accent}
        sub={p.closing.sub}
        cta={{ label: cta.orderPremade, href: orderHref }}
      />
    </>
  );
}
