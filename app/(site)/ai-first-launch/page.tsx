import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { CtaBand } from "@/components/CtaBand";
import { DrawnBorder } from "@/components/DrawnBorder";
import { MediaCard } from "@/components/MediaCard";
import { Reveal, RevealItem } from "@/components/Reveal";
import { RuleList } from "@/components/RuleList";
import { RuledSection } from "@/components/RuledSection";
import { SectionGlow } from "@/components/SectionGlow";
import { SectionHead } from "@/components/SectionHead";
import Link from "next/link";
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

type LaunchState = { kind: "ready" | "draft" | "scheduled"; date?: string; src?: string | null };

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

/* right-aligned single-purchase block in a card's footer row */
function SingleBuy({
  price,
  label,
  href,
}: {
  price: number;
  label: string;
  href?: string;
}) {
  return (
    <span className="flex shrink-0 flex-col items-end gap-1 text-right">
      <span className="font-mono text-label uppercase text-dim">{label}</span>
      <span className="font-mono text-body font-bold text-gold [font-variant-numeric:tabular-nums]">
        ${price.toLocaleString("en-US")}
      </span>
      {href && (
        <Link
          href={href}
          className="group inline-flex items-center gap-1.5 font-mono text-label uppercase tracking-[0.1em] text-gold transition-opacity hover:opacity-70"
        >
          {cta.orderPremade}
          <span
            aria-hidden="true"
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          >
            &rarr;
          </span>
        </Link>
      )}
    </span>
  );
}

function PipelineCard({
  title,
  format,
  statusLabel,
  dateLabel,
  price,
  priceLabel,
}: {
  title: string;
  format: string;
  statusLabel: string;
  dateLabel: string | null;
  price: number;
  priceLabel: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex aspect-video flex-col items-center justify-center gap-2 border border-dashed border-hair bg-surface/40 px-6 text-center">
        {dateLabel && (
          <p className="font-mono text-price font-bold leading-none text-gold [font-variant-numeric:tabular-nums]">
            {dateLabel}
          </p>
        )}
        <p className="font-mono text-label uppercase tracking-[0.1em] text-gold">
          {statusLabel}
        </p>
      </div>
      <div className="flex flex-1 items-start justify-between gap-4 border-b border-hair px-1 pb-4 pt-3.5">
        <div className="min-w-0">
          <h3 className="font-display text-h4 font-semibold leading-snug tracking-[-0.01em] text-ink">
            {title}
          </h3>
          <p className="mt-1 font-mono text-label uppercase text-dim">{format}</p>
        </div>
        <SingleBuy price={price} label={priceLabel} />
      </div>
    </div>
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

  const orderHref = `${checkoutHref(pack.slug)}?code=${p.code}`;
  const anchorCents = (pack.anchorPrice ?? 0) * 100;
  const regularCents = (pack.price ?? 0) * 100;
  const discountCents = Math.round((regularCents * p.percent) / 100);
  const launchCents = regularCents - discountCents;

  return (
    <>
      {/* 1. hero: the offer, the clock, the one button */}
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

      {/* 2. the nine videos and their pipeline states */}
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
          <div className="mt-12 grid gap-14">
            {categories.map((cat, ci) => (
              <div key={cat.name}>
                {/* category header: numbered, name, and its one-line pitch */}
                <Reveal className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-hair pb-4">
                  <RevealItem>
                    <p className="font-mono text-label uppercase tracking-[0.14em] text-gold">
                      [ 0{ci + 1} ] {cat.name}
                    </p>
                  </RevealItem>
                  <RevealItem className="min-w-0">
                    <p className="max-w-[var(--measure-body)] text-body-sm text-muted">
                      {cat.line}
                    </p>
                  </RevealItem>
                </Reveal>
                <Reveal className="mt-7 grid items-stretch gap-x-5 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
                  {cat.videos.map((v) => {
                    const state = states[v.title];
                    const single = premadeBySlugTitle[v.title];
                    const price = single?.price ?? 495;
                    if (v.src || state?.src) {
                      /* published, or a ready/draft preview whose clip has
                         been supplied; singles sell only once published */
                      return (
                        <RevealItem key={v.title} className="h-full">
                          <MediaCard
                            src={(v.src ?? state?.src) as string}
                            poster={v.poster}
                            title={v.title}
                            meta={v.format}
                            metaSub={
                              v.src
                                ? p.videos.liveNote
                                : state?.kind === "draft"
                                  ? p.videos.draftLabel
                                  : p.videos.readyLabel
                            }
                            action={
                              <SingleBuy
                                price={price}
                                label={v.src ? p.videos.singleLabel : p.videos.atRelease}
                                href={
                                  v.src && single ? checkoutHref(single.slug) : undefined
                                }
                              />
                            }
                          />
                        </RevealItem>
                      );
                    }
                    const scheduled = state?.kind === "scheduled" && state.date;
                    return (
                      <RevealItem key={v.title} className="h-full">
                        <PipelineCard
                          title={v.title}
                          format={v.format}
                          statusLabel={
                            scheduled
                              ? p.videos.scheduledPrefix
                              : state?.kind === "draft"
                                ? p.videos.draftLabel
                                : p.videos.readyLabel
                          }
                          dateLabel={scheduled ? fmtDate(state.date!) : null}
                          price={price}
                          priceLabel={p.videos.atRelease}
                        />
                      </RevealItem>
                    );
                  })}
                </Reveal>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. the delivery promise, in plain rules */}
      <RuledSection
        bpIdx={3}
        index={3}
        chip={p.terms.chip}
        headline={p.terms.headline}
        accent={p.terms.accent}
      >
        <div className="px-6 py-6 md:px-8">
          <RuleList items={p.terms.items} framed={false} />
        </div>
      </RuledSection>

      {/* 4. the price story */}
      <section data-bp-idx="4" className="relative overflow-x-clip section-pad">
        <SectionGlow position="right" />
        <div className="shell relative">
          <SectionHead
            index={4}
            chip={p.price.chip}
            headline={p.price.headline}
            accent={p.price.accent}
            center
          />
          <Reveal className="mx-auto mt-12 max-w-xl">
            <RevealItem>
              <div className="border border-dashed border-hair p-8 text-center md:p-10">
                <div className="grid gap-3">
                  <p className="flex items-baseline justify-between gap-6 text-body text-dim">
                    <span>{p.price.anchorNote}</span>
                    <s className="font-mono [font-variant-numeric:tabular-nums]">
                      {usd(anchorCents)}
                    </s>
                  </p>
                  <p className="flex items-baseline justify-between gap-6 text-body text-muted">
                    <span>{p.price.regularNote}</span>
                    <s className="font-mono [font-variant-numeric:tabular-nums]">
                      {usd(regularCents)}
                    </s>
                  </p>
                  <p className="flex items-baseline justify-between gap-6 border-t border-hair pt-4 text-body text-ink">
                    <span>{p.price.yourNote}</span>
                    <span className="font-display text-price font-semibold text-gold [font-variant-numeric:tabular-nums]">
                      {usd(launchCents)}
                    </span>
                  </p>
                </div>
                <p className="mt-5 text-body-sm text-muted">
                  You save {usd(discountCents)} in this window.
                </p>
                <p className="mx-auto mt-3 max-w-[46ch] text-body-sm text-muted">
                  {p.price.deliveryNote}
                </p>
                <div className="mt-7">
                  <Button href={orderHref} variant="gradient" size="lg">
                    {cta.orderPremade}
                  </Button>
                </div>
                <p className="mt-4 font-mono text-label uppercase text-dim">
                  {p.price.autoNote}
                </p>
              </div>
            </RevealItem>
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
