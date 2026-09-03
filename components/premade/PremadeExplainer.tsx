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
          {/*
            * 2.25rem by owner direction, which sits between text-h3 (1.55rem)
            * and text-h2 (3.1rem) with no token in between. It is a heading
            * beside a video in a two-column block, not a centred section
            * head, so the full section size overpowered the column. Say the
            * word if this size gets reused and it earns a real token.
            */}
          <h2 className="font-display text-[2.25rem] font-semibold leading-[1.1] tracking-[-0.01em] text-ink">
            {x.question}
          </h2>
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
            className="relative flex flex-col overflow-hidden rounded-card border border-hair p-6"
            style={{
              background:
                "linear-gradient(135deg, rgba(var(--blue-rgb),0.13) 0%, rgba(var(--blue-rgb),0.035) 34%, rgba(0,0,0,0) 60%), #000",
            }}
          >
            <span
              aria-hidden="true"
              className="grunge pointer-events-none absolute inset-0"
              style={{ opacity: 0.15 }}
            />
            <DrawnIcon name={f.icon as IconName} />
            <h3 className="relative mt-4 font-display text-h4 font-semibold leading-snug text-ink">
              {f.title}
            </h3>
            <p className="relative mt-2 text-body-sm leading-relaxed text-muted">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
