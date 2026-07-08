import { Marquee } from "@/components/Marquee";
import { Stat } from "@/components/Stat";
import { trustLogos, clients, rating, googleReviewsUrl } from "@/lib/site";

/*
 * Structured trust bar: a bracketed purpose cap, the logo marquee, and
 * two stat cells separated by hairlines, all reading as blueprint
 * cells rather than floating items. Placeholder marks fill the wall
 * until the real client logos are cleared (flagged in lib/site.ts).
 */

/* small geometric mark so placeholder wordmarks read as logos */
function Mark({ variant }: { variant: number }) {
  const shapes = [
    <rect key="r" x="1.5" y="1.5" width="9" height="9" rx="2" />,
    <circle key="c" cx="6" cy="6" r="4.75" />,
    <path key="t" d="M6 1.5 10.75 10.5H1.25Z" />,
  ];
  return (
    <svg
      viewBox="0 0 12 12"
      className="h-2.5 w-2.5 fill-dim/70"
      aria-hidden="true"
    >
      {shapes[variant % shapes.length]}
    </svg>
  );
}

function Wordmark({ name, index }: { name: string; index: number }) {
  return (
    <span className="flex items-center gap-2.5 whitespace-nowrap font-display text-lg font-semibold tracking-tight text-dim">
      <Mark variant={index} />
      {name}
    </span>
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
  const valueCls = `font-mono text-[1.75rem] font-bold leading-none text-gold ${
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
          {trustLogos.map((logo, i) => (
            <Wordmark key={logo.name} name={logo.name} index={i} />
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
