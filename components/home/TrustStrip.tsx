import { Marquee } from "@/components/Marquee";
import { Stat } from "@/components/Stat";
import { namedClients, clients, rating, googleReviewsUrl } from "@/lib/site";

/* Clean text wordmarks for the named clients until logo rights are
 * confirmed, interleaved with neutral audience labels so no client
 * name repeats. The rating links out to Google reviews. */
function Wordmark({ name }: { name: string }) {
  return (
    <span className="whitespace-nowrap font-display text-lg font-semibold tracking-tight text-dim">
      {name}
    </span>
  );
}

function AudienceMark({ label }: { label: string }) {
  return (
    <span className="whitespace-nowrap font-mono text-label uppercase text-muted">
      {label}
    </span>
  );
}

const audienceMarks = [
  "SaaS resellers",
  "Agency owners",
  "HighLevel creators",
];

export function TrustStrip() {
  return (
    <section className="border-y border-hair">
      <div className="shell grid grid-cols-1 items-center gap-8 py-8 md:grid-cols-[1fr_auto] md:gap-14">
        <Marquee>
          {namedClients.map((c, i) => (
            <span key={c.company} className="flex items-center gap-14">
              <Wordmark name={c.company} />
              <AudienceMark label={audienceMarks[i]} />
            </span>
          ))}
        </Marquee>

        <div className="flex flex-wrap items-baseline gap-x-10 gap-y-3 font-mono">
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
