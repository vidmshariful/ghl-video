import { Marquee } from "@/components/Marquee";
import { Stat } from "@/components/Stat";
import { namedClients, clients, rating, googleReviewsUrl } from "@/lib/site";

/* Clean text wordmarks for the named clients until logo rights are
 * confirmed. The rating links out to Google reviews. */
function Wordmark({ name }: { name: string }) {
  return (
    <span className="whitespace-nowrap font-display text-lg font-semibold tracking-tight text-dim">
      {name}
    </span>
  );
}

export function TrustStrip() {
  /* two passes of the three names so the loop has enough track */
  const marks = [...namedClients, ...namedClients];
  return (
    <section className="border-y border-hair">
      <div className="shell grid items-center gap-8 py-8 md:grid-cols-[1fr_auto] md:gap-14">
        <Marquee>
          {marks.map((c, i) => (
            <Wordmark key={`${c.company}-${i}`} name={c.company} />
          ))}
        </Marquee>

        <div className="flex items-baseline gap-10 font-mono">
          <p className="flex items-baseline gap-2.5">
            <Stat
              value={clients}
              suffix="+"
              className="text-[1.75rem] font-bold text-gold"
            />
            <span className="text-label uppercase text-dim">
              HighLevel SaaS
              <br />
              teams served
            </span>
          </p>
          <a
            href={googleReviewsUrl}
            className="group flex items-baseline gap-2.5"
          >
            <span className="text-[1.75rem] font-bold text-gold underline-offset-4 group-hover:underline">
              {rating}
            </span>
            <span className="text-label uppercase text-dim group-hover:text-muted">
              client rating
              <br />
              on Google
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
