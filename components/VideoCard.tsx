import { MediaFrame } from "@/components/MediaFrame";
import type { PremadeVideo } from "@/lib/site";

/*
 * Premade grid card: the hover-play preview is the hero, then title,
 * one-line purpose, the per-SKU price in mono gold, and the per-SKU
 * order button. Price and URL come from the config so the variable
 * pricing model drops in with no layout change.
 */
export function VideoCard({ video }: { video: PremadeVideo }) {
  return (
    <div className="group rounded-card border border-hair card-glass p-3">
      {video.preview ? (
        <MediaFrame
          src={video.preview}
          poster={video.poster}
          label={video.title}
          tint="gold"
        />
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-media border border-hair bg-[#030303]">
          <span className="font-mono text-label uppercase text-dim">
            [ Preview coming ]
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4 p-4 pt-5">
        <div className="min-w-0">
          <h3 className="font-display text-[1.125rem] font-semibold tracking-[-0.01em] text-ink">
            {video.title}
          </h3>
          <p className="mt-1 max-w-[34ch] text-sm text-muted">{video.purpose}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-price text-gold [font-variant-numeric:tabular-nums]">
            ${video.price}
          </span>
          <a
            href={video.orderUrl}
            target="_blank"
            rel="noopener"
            className="group/btn inline-flex items-center gap-2 whitespace-nowrap rounded-[3px] bg-green px-5 py-2.5 text-sm font-semibold text-[#08090D] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
          >
            Order for ${video.price}
            <span
              aria-hidden="true"
              className="transition-transform duration-200 group-hover/btn:translate-x-0.5"
            >
              &rarr;
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}
