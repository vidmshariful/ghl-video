import { DrawnIcon, type IconName } from "@/components/DrawnIcon";
import { MediaFrame } from "@/components/MediaFrame";
import { pages } from "@/lib/site";

/*
 * Intro explainer above the library: a walkthrough video on the left, the
 * question and description on the right, then four feature cards. Real
 * indexable copy for SEO (an h2 question, two descriptive paragraphs, and the
 * card headings). The video shows a placeholder until a URL is set in
 * pages.premade.explainer.video.
 */
export function PremadeExplainer() {
  const x = pages.premade.explainer;
  return (
    <div className="shell relative">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
        {/* the walkthrough video (placeholder until a URL is set) */}
        <div>
          {x.video.src ? (
            <MediaFrame
              src={x.video.src}
              poster={x.video.poster}
              label={x.question}
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

        {/* the question, then the description */}
        <div>
          <h2 className="font-display text-h2 leading-tight text-ink">{x.question}</h2>
          <div className="mt-5 space-y-4">
            {x.body.map((para) => (
              <p key={para} className="text-lede leading-relaxed text-muted">
                {para}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* four feature cards, below the video + description */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {x.features.map((f) => (
          <div
            key={f.title}
            className="flex flex-col rounded-card border border-hair card-glass p-6"
          >
            <DrawnIcon name={f.icon as IconName} />
            <h3 className="mt-4 font-display text-h4 font-semibold leading-snug text-ink">
              {f.title}
            </h3>
            <p className="mt-2 text-body-sm leading-relaxed text-muted">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
