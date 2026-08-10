import { MediaFrame } from "@/components/MediaFrame";
import { RuleList } from "@/components/RuleList";
import { pages } from "@/lib/site";

/*
 * Intro explainer above the library: what premade video is, what every order
 * includes, and a walkthrough video. Also earns the page real indexable copy
 * (a proper h2, two descriptive paragraphs, and a semantic list) for SEO.
 * The video slot shows a placeholder until the walkthrough URL is set in
 * pages.premade.explainer.video.
 */
export function PremadeExplainer() {
  const x = pages.premade.explainer;
  return (
    <div className="shell relative">
      <div className="mx-auto max-w-3xl text-center">
        <p className="font-mono text-label uppercase tracking-[0.14em] text-gold">{x.chip}</p>
        <h2 className="mt-5 font-display text-h2 leading-tight text-ink">
          {x.headline} <span className="text-gradient">{x.accent}</span>
        </h2>
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:items-start">
        {/* the walkthrough video (placeholder until a URL is set) */}
        <div>
          {x.video.src ? (
            <MediaFrame
              src={x.video.src}
              poster={x.video.poster}
              label="What premade video is"
              tint
              caption={{ title: "Watch", sub: "How it works" }}
            />
          ) : (
            <div className="relative flex aspect-video w-full flex-col items-center justify-center border border-hair bg-surface text-center">
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 hatch opacity-25" />
              <span className="relative flex h-12 w-12 items-center justify-center rounded-full border border-hair bg-canvas">
                <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5 text-gold" aria-hidden="true">
                  <path d="M8 5v14l11-7z" fill="currentColor" />
                </svg>
              </span>
              <span className="relative mt-4 font-mono text-label uppercase tracking-[0.1em] text-dim">
                Explainer video coming soon
              </span>
            </div>
          )}
        </div>

        {/* what it is, then what every order includes */}
        <div>
          <div className="space-y-4">
            {x.body.map((para) => (
              <p key={para} className="text-lede leading-relaxed text-muted">
                {para}
              </p>
            ))}
          </div>
          <h3 className="mt-8 font-display text-h4 font-semibold text-ink">{x.includedTitle}</h3>
          <div className="mt-4">
            <RuleList items={x.included.map((line) => ({ line }))} framed={false} />
          </div>
        </div>
      </div>
    </div>
  );
}
