import { Marquee } from "@/components/Marquee";
import { Stat } from "@/components/Stat";
import { trustLogos, clients, rating, googleReviewsUrl } from "@/lib/site";

/*
 * Structured trust bar: a bracketed purpose cap, a marquee of real
 * client logos, and two stat cells separated by hairlines. Logos ride
 * as uniform light silhouettes so mixed brand colours read on the dark
 * ground, and light to full colour on hover.
 */
function LogoMark({ src }: { src: string }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element -- static export, local asset */
    <img
      src={src}
      alt=""
      loading="lazy"
      className="h-6 w-auto max-w-[9rem] shrink-0 object-contain opacity-50 [filter:brightness(0)_invert(1)] transition duration-300 hover:opacity-100 hover:[filter:none]"
    />
  );
}

function StatCell({
  value,
  lines,
  countUp = false,
  linked = false,
}: {
  value: string;
  lines: [string, string];
  countUp?: boolean;
  /* renders hover affordances for a wrapping anchor's group scope */
  linked?: boolean;
}) {
  const valueCls = `font-mono text-[1.75rem] font-bold leading-none text-gold [font-variant-numeric:tabular-nums] ${
    linked ? "underline-offset-4 group-hover:underline" : ""
  }`;
  return (
    <span className="flex items-center gap-3.5">
      {countUp ? (
        <Stat value={clients} suffix="+" className={valueCls} />
      ) : (
        <span className={valueCls}>{value}</span>
      )}
      <span
        className={`font-mono text-label uppercase text-dim ${linked ? "group-hover:text-muted" : ""}`}
      >
        <span className="block">{lines[0]}</span>
        <span className="block">{lines[1]}</span>
      </span>
    </span>
  );
}

export function TrustStrip() {
  return (
    <section className="border-y border-hair">
      <div className="shell grid grid-cols-1 items-center gap-x-8 gap-y-6 py-7 lg:grid-cols-[auto_1fr_auto]">
        {/* purpose cap in the chip bracket language */}
        <p className="font-mono text-label uppercase text-dim">
          [ <span className="text-muted">Trusted by</span> ]
        </p>

        <Marquee>
          {trustLogos.map((src) => (
            <LogoMark key={src} src={src} />
          ))}
        </Marquee>

        {/* stat cells, hairline-separated, centered as units; wraps
            below ~360px so narrow phones never overflow */}
        <div className="flex flex-wrap items-center gap-x-7 gap-y-4 lg:border-l lg:border-hair lg:pl-10">
          <StatCell value="800+" lines={["HighLevel SaaS", "teams served"]} countUp />
          <span aria-hidden="true" className="hidden h-10 w-px shrink-0 bg-hair sm:block" />
          <a href={googleReviewsUrl} className="group">
            <StatCell value={rating} lines={["Client rating", "on Google"]} linked />
          </a>
        </div>
      </div>
    </section>
  );
}
