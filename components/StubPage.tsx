import { Button } from "@/components/Button";
import { Panel } from "@/components/Panel";
import { site } from "@/lib/site";

/*
 * Designed placeholder for routes whose real pages are still being
 * built: no dead links anywhere on the site. Swapped out page by page
 * as each one ships.
 */
export function StubPage({
  title,
  note,
  emailCta = false,
}: {
  title: string;
  note: string;
  /* the contact stub offers the real email as a working fallback */
  emailCta?: boolean;
}) {
  return (
    <div className="shell pt-40 pb-24 md:pt-44">
      <Panel className="mx-auto max-w-2xl overflow-hidden">
        <div className="p-10 md:p-14">
          <p className="inline-flex items-center gap-3 rounded-full border border-hair bg-surface px-4 py-2 font-mono text-label uppercase">
            <span className="text-dim">
              [ <span className="text-gold">Soon</span> ]
            </span>
            <span className="text-muted">This page is being built</span>
          </p>
          <h1 className="mt-7 font-display text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.02] tracking-[-0.025em] text-ink">
            {title}
          </h1>
          <p className="mt-5 max-w-[52ch] text-lede text-muted">{note}</p>
          <div className="mt-10 flex flex-wrap gap-4">
            {emailCta ? (
              <Button href={`mailto:${site.email}`} external variant="primary">
                Email {site.email}
              </Button>
            ) : (
              <Button href="/contact/" variant="primary">
                Book a Call
              </Button>
            )}
            <Button href="/" variant="ghost">
              Back to the homepage
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
