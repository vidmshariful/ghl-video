import { clients, googleReviewsUrl, rating } from "@/lib/site";

/*
 * Light proof band for inner pages: the two locked figures and the
 * live Google reviews link. Quiet, mono, one hairline row.
 */
export function ProofStrip({ quote }: { quote?: string }) {
  return (
    <div className="border-y border-hair py-6">
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-center">
        <span className="flex items-baseline gap-2.5">
          <span className="font-mono text-[1.375rem] font-bold text-gold [font-variant-numeric:tabular-nums]">
            {clients}+
          </span>
          <span className="font-mono text-label uppercase text-dim">
            HighLevel SaaS teams
          </span>
        </span>
        <span aria-hidden="true" className="hidden h-4 w-px bg-hair sm:block" />
        <a
          href={googleReviewsUrl}
          target="_blank"
          rel="noopener"
          className="group flex items-baseline gap-2.5"
        >
          <span className="font-mono text-[1.375rem] font-bold text-gold [font-variant-numeric:tabular-nums] underline-offset-4 group-hover:underline">
            {rating}
          </span>
          <span className="font-mono text-label uppercase text-dim">
            client rating on Google
          </span>
        </a>
        {quote && (
          <>
            <span
              aria-hidden="true"
              className="hidden h-4 w-px bg-hair lg:block"
            />
            <span className="max-w-[44ch] text-sm text-muted">{quote}</span>
          </>
        )}
      </div>
    </div>
  );
}
