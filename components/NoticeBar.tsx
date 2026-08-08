import type { SiteNotice } from "@/lib/site";

/*
 * The soft-launch notice strip fixed above the header. Height is h-9;
 * the site layout offsets the page and the header by the same amount,
 * so removing it (siteNotice = null) collapses the offset with it. Copy
 * lives in lib/content/core.ts; short shows on mobile, long on wider
 * screens, both on one line.
 */
export function NoticeBar({ notice }: { notice: SiteNotice }) {
  return (
    <div
      role="status"
      data-notice-bar
      className="fixed inset-x-0 top-0 z-[60] flex h-9 items-center justify-center gap-2 border-b border-gold/25 bg-surface px-4"
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold motion-safe:animate-pulse"
      />
      <p className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.05em] text-muted sm:text-label">
        <span className="sm:hidden">{notice.short} </span>
        <span className="hidden sm:inline">{notice.long} </span>
        <a
          href={`mailto:${notice.email}`}
          className="font-semibold text-gold underline decoration-gold/40 underline-offset-2 transition-colors hover:decoration-gold"
        >
          {notice.email}
        </a>
      </p>
    </div>
  );
}
