"use client";

import Link from "next/link";
import { cta, skuFor, videoStack, type PremadePack } from "@/lib/site";
import {
  featureBrowse,
  oldClassic,
  stackGroups,
  stackNote,
  stackPicks,
  type BrowseVideo,
  type FilterDef,
} from "./catalog";
import { VideoBrowser } from "./browser";

/* ---------------------------------------------------------------- */
/* Bundle view: details (watch-before + what's inside) then preview   */
/* ---------------------------------------------------------------- */

export type BundleSummaryItem = {
  name: string;
  count: number;
  value?: number | null;
  poster?: string | null;
};

/* the team walkthrough lands here; a designed placeholder until it is
 * shot and dropped in. */
export function ComingSoonVideo() {
  return (
    <div className="relative flex aspect-video w-full flex-col items-center justify-center border border-hair bg-surface text-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hatch opacity-30"
      />
      <span className="relative flex h-12 w-12 items-center justify-center rounded-full border border-hair bg-canvas">
        <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5 text-gold" aria-hidden="true">
          <path d="M8 5v14l11-7z" fill="currentColor" />
        </svg>
      </span>
      <span className="relative mt-4 rounded-full border border-hair bg-canvas px-4 py-1.5 font-mono text-label uppercase text-dim">
        Video coming soon
      </span>
      <p className="relative mt-3 max-w-[var(--measure-body)] px-6 text-body text-muted">
        A short walkthrough from our team is being filmed and lands here soon.
      </p>
    </div>
  );
}

export function BundleView({
  name,
  tagline,
  count,
  price,
  anchorPrice,
  sku,
  ctaLabel,
  overviewNote,
  summaryItems,
  footNote,
  previewVideos,
  previewGroups,
  previewNote,
}: {
  name: string;
  tagline: string;
  count: number | null;
  price: number | null;
  anchorPrice?: number | null;
  sku: string | null;
  ctaLabel: string;
  overviewNote: string;
  summaryItems: BundleSummaryItem[];
  footNote?: string | null;
  previewVideos: BrowseVideo[];
  previewGroups: FilterDef[];
  previewNote?: string | null;
}) {
  const canOrder = Boolean(price && sku);
  return (
    <div>
      {/* header band: value anchor + one CTA */}
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5 border-b border-hair px-5 py-6 md:px-7">
        <div className="max-w-[var(--measure-body)]">
          <p className="font-display text-h3 text-ink">{name}</p>
          <p className="mt-1.5 text-body leading-relaxed text-muted">{tagline}</p>
        </div>
        <div className="flex items-center gap-5">
          {count !== null && (
            <span className="hidden font-mono text-label uppercase text-muted sm:inline">
              [ {count} videos ]
            </span>
          )}
          {canOrder ? (
            <>
              <span className="flex items-baseline gap-2">
                {anchorPrice ? (
                  <span className="font-mono text-body text-dim line-through [font-variant-numeric:tabular-nums]">
                    ${anchorPrice.toLocaleString("en-US")}
                  </span>
                ) : null}
                <span className="font-mono text-price font-bold text-gold [font-variant-numeric:tabular-nums]">
                  ${(price ?? 0).toLocaleString("en-US")}
                </span>
              </span>
              <Link
                href={`/checkout/${skuFor(sku ?? "")}`}
                className="group inline-flex items-center gap-2 whitespace-nowrap rounded-[3px] bg-brand-gradient px-6 py-3 text-body font-semibold text-canvas shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_28px_rgba(0,204,0,0.28)] transition-all duration-200 hover:brightness-[1.07] active:scale-[0.98]"
              >
                {ctaLabel}
                <span
                  aria-hidden="true"
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
                >
                  &rarr;
                </span>
              </Link>
            </>
          ) : (
            <Link
              href={cta.bookACall.href}
              className="group inline-flex items-center gap-2 whitespace-nowrap rounded-[3px] bg-brand-gradient px-6 py-3 text-body font-semibold text-canvas transition-all duration-200 hover:brightness-[1.07] active:scale-[0.98]"
            >
              {cta.bookACall.label}
              <span aria-hidden="true">&rarr;</span>
            </Link>
          )}
        </div>
      </div>

      {/* details: watch-before walkthrough + what's inside */}
      <div className="grid lg:grid-cols-[1.35fr_1fr]">
        <div className="border-b border-hair p-5 md:p-7 lg:border-b-0 lg:border-r">
          <p className="mb-3 font-mono text-label uppercase text-dim">
            [ Watch before you buy ]
          </p>
          <ComingSoonVideo />
          <p className="mt-3 text-body text-muted">{overviewNote}</p>
        </div>

        <div className="p-5 md:p-7">
          <p className="mb-3 font-mono text-label uppercase text-dim">
            [ What is inside ]
          </p>
          <ul className="grid gap-px overflow-hidden rounded-[3px] border border-hair bg-hair">
            {summaryItems.map((f) => (
              <li key={f.name} className="flex items-center gap-4 bg-canvas p-3.5">
                <span className="relative block h-12 w-20 shrink-0 overflow-hidden rounded-[2px] border border-hair bg-black">
                  {f.poster ? (
                    // eslint-disable-next-line @next/next/no-img-element -- static export, remote poster
                    <img
                      src={f.poster}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover opacity-85"
                    />
                  ) : null}
                  <span className="absolute inset-0 flex items-center justify-center font-mono text-body font-bold text-gradient [font-variant-numeric:tabular-nums]">
                    {f.count}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-body font-semibold text-ink">
                    {f.count}
                    {"× "}
                    {f.name}
                  </span>
                  {f.value ? (
                    <span className="mt-0.5 block font-mono text-label uppercase tracking-[0.14em] text-dim">
                      value ${f.value.toLocaleString("en-US")}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          {footNote && (
            <p className="mt-4 font-mono text-label uppercase text-dim">
              {footNote}
            </p>
          )}
        </div>
      </div>

      {/* preview: every included video, filterable and previewable */}
      <div className="border-t border-hair">
        <div className="px-5 py-6 md:px-7">
          <p className="font-mono text-label uppercase text-dim">
            [ Preview the line-up ]
          </p>
          {previewNote && (
            <p className="mt-1 max-w-[var(--measure-body)] text-body leading-relaxed text-muted">
              {previewNote}
            </p>
          )}
        </div>
        <div className="border-t border-hair">
          <VideoBrowser videos={previewVideos} groups={previewGroups} />
        </div>
      </div>
    </div>
  );
}

export function VideoStackView() {
  const s = videoStack;
  const posterFor = (t: string) =>
    oldClassic.find((v) => v.typeTag === t && v.poster)?.poster ??
    featureBrowse.find((v) => v.poster)?.poster ??
    null;

  return (
    <BundleView
      name={s.name}
      tagline={s.tagline}
      count={s.totalCount}
      price={s.price}
      anchorPrice={s.anchorPrice}
      sku={s.sku}
      ctaLabel={cta.orderPremade}
      overviewNote={`A walkthrough of the full stack from our team. Every format below ships branded to your platform, delivered in ${s.deliveryDays} days.`}
      summaryItems={s.formats.map((f) => ({
        name: f.name,
        count: f.count,
        value: f.value,
        poster: posterFor(f.sampleType),
      }))}
      footNote={`${s.totalCount} videos. One order. No contracts.`}
      previewVideos={stackPicks}
      previewGroups={stackGroups}
      previewNote={stackNote}
    />
  );
}

/* A pack rendered like the stack: details section, then a previewable
 * line-up of everything inside, grouped by category. */
export function PackBundleView({ pack }: { pack: PremadePack }) {
  const previewVideos: BrowseVideo[] = pack.categories.flatMap((c) =>
    c.videos.map((v) => ({
      slug: `${pack.slug}-${v.title}`,
      title: v.title,
      typeTag: c.name,
      subTag: v.format,
      price: 0,
      preview: v.src,
      poster: v.poster,
      wistiaId: null,
      subtitle: v.format,
      packCount: null,
      realPreview: null,
      realPoster: null,
      previewOnly: true,
      previewNote: `Included in the ${pack.name}, branded to your platform.`,
      previewCtaLabel: cta.orderPremade,
      checkoutSku: pack.slug,
    })),
  );
  const previewGroups: FilterDef[] = [
    {
      label: "Category",
      options: pack.categories.map((c) => c.name),
      on: "typeTag",
    },
  ];
  const summaryItems: BundleSummaryItem[] = pack.categories.map((c) => ({
    name: c.name,
    count: c.count ?? c.videos.length,
    poster: c.videos.find((v) => v.poster)?.poster ?? null,
  }));

  return (
    <BundleView
      name={pack.name}
      tagline={pack.tagline}
      count={pack.count}
      price={pack.price}
      anchorPrice={pack.anchorPrice}
      sku={pack.slug}
      ctaLabel={cta.orderPremade}
      overviewNote="A walkthrough of the pack from our team, branded to your platform. Every video below is included."
      summaryItems={summaryItems}
      footNote={pack.count ? `${pack.count} videos. One order.` : null}
      previewVideos={previewVideos}
      previewGroups={previewGroups}
      previewNote="Preview every video in the pack. Finished videos play now; the rest are in production and land as they release."
    />
  );
}
