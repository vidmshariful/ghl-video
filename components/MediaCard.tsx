import type { ReactNode } from "react";
import { MediaFrame } from "@/components/MediaFrame";

/*
 * The one media card. A clean 16:9 frame on top (no text baked over
 * the footage), a hairline, then title, meta, and an optional action
 * BELOW. Used everywhere a video is showcased: Our Work, the home
 * showreel, client stories, custom formats. Kills the "caption inside
 * the frame" problem and gives every video the same anatomy.
 */
export function MediaCard({
  src,
  poster,
  title,
  meta,
  label,
  startAt,
  endAt,
  tint,
  action,
  className = "",
}: {
  src: string;
  poster: string | null;
  title: string;
  meta?: string;
  label?: string;
  startAt?: number;
  endAt?: number;
  tint?: "gold" | "green" | "blue";
  /* optional right-aligned control in the footer row */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`group/mc ${className}`}>
      <MediaFrame
        src={src}
        poster={poster}
        label={label ?? title}
        tint={tint}
        {...(startAt !== undefined ? { startAt, endAt } : {})}
      />
      <div className="flex items-end justify-between gap-4 border-b border-hair px-1 pb-4 pt-3.5">
        <div className="min-w-0">
          <h3 className="font-display text-[1.0625rem] font-semibold tracking-[-0.01em] text-ink">
            {title}
          </h3>
          {meta && (
            <p className="mt-0.5 font-mono text-label uppercase text-dim">
              {meta}
            </p>
          )}
        </div>
        {action}
      </div>
    </div>
  );
}
