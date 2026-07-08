import { Marquee } from "@/components/Marquee";
import { Stat } from "@/components/Stat";
import { namedClients, clients, rating } from "@/lib/site";

/* Styled text wordmarks for the three named clients. Neutral skeleton
 * marks hold space for the logos pending rights confirmation. */
function Wordmark({ name }: { name: string }) {
  return (
    <span className="whitespace-nowrap font-display text-lg font-semibold tracking-tight text-dim transition-colors hover:text-muted">
      {name}
    </span>
  );
}

function SkeletonMark({ w }: { w: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block h-4 ${w} rounded-full bg-hair/80`}
    />
  );
}

export function TrustStrip() {
  return (
    <section className="border-y border-hair">
      <div className="shell grid items-center gap-8 py-8 md:grid-cols-[1fr_auto] md:gap-14">
        <Marquee>
          <Wordmark name={namedClients[0].company} />
          <SkeletonMark w="w-24" />
          <Wordmark name={namedClients[1].company} />
          <SkeletonMark w="w-32" />
          <Wordmark name={namedClients[2].company} />
          <SkeletonMark w="w-20" />
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
          <p className="flex items-baseline gap-2.5">
            <span className="text-[1.75rem] font-bold text-gold">{rating}</span>
            <span className="text-label uppercase text-dim">
              client
              <br />
              rating
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
