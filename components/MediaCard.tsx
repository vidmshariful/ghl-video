import type { ReactNode } from "react";
import { MediaFrame } from "@/components/MediaFrame";

/*
 * The one media card, matched to the premade library card. The meta
 * rides over the footage as a caption (type / feature), then the title
 * sits below on the left with any action pinned to the right. Long
 * titles wrap; the action never breaks to a new line. Used everywhere a
 * video is showcased: Our Work, the home showreel, client stories.
 */
export function MediaCard({
  src,
  poster,
  title,
  meta,
  metaSub,
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
  /* the over-video caption: a lead label and an optional second part */
  meta?: string;
  metaSub?: string;
  label?: string;
  startAt?: number;
  endAt?: number;
  tint?: boolean;
  /* optional right-aligned control in the footer row */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`group/mc flex h-full flex-col ${className}`}>
      <MediaFrame
        src={src}
        poster={poster}
        label={label ?? title}
        tint={tint}
        {...(meta ? { caption: { title: meta, sub: metaSub } } : {})}
        {...(startAt !== undefined ? { startAt, endAt } : {})}
      />
      <div className="flex flex-1 items-start justify-between gap-4 border-b border-hair px-1 pb-4 pt-3.5">
        <h3 className="min-w-0 font-display text-h4 font-semibold leading-snug tracking-[-0.01em] text-ink">
          {title}
        </h3>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
