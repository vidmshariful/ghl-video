import Link from "next/link";
import { Eyebrow } from "@/components/Eyebrow";
import { Reveal, RevealItem } from "@/components/Reveal";
import { home } from "@/lib/site";

/*
 * The routing block. Asymmetric on purpose: Premade (acquisition) takes
 * the widest cell, Custom sits beside it, Editing runs full width below
 * because it speaks to the second ICP. One accent per cell, per the
 * accent ledger: gold / green / blue.
 */

function ArrowLink({
  href,
  label,
  accent,
}: {
  href: string;
  label: string;
  accent: "gold" | "green" | "blue";
}) {
  const color = {
    gold: "text-gold",
    green: "text-green",
    blue: "text-blue",
  }[accent];
  return (
    <span
      className={`inline-flex items-center gap-2 text-sm font-semibold ${color}`}
    >
      {label}
      <span
        aria-hidden="true"
        className="transition-transform duration-200 group-hover:translate-x-1"
      >
        &rarr;
      </span>
    </span>
  );
}

/* Quiet placeholder thumbnails inside the premade cell. Real posters
 * replace these via lib/site.ts with no layout change. */
function PosterStrip() {
  return (
    <div aria-hidden="true" className="mt-8 grid grid-cols-3 gap-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="relative flex aspect-video items-center justify-center overflow-hidden rounded-media border border-hair bg-[#05060A]"
        >
          <div
            className={`absolute rounded-full opacity-[0.16] blur-2xl ${
              i === 0
                ? "left-[-20%] top-[-30%] h-[130%] w-[90%] bg-gold"
                : i === 1
                  ? "right-[-15%] top-[10%] h-[125%] w-[85%] bg-green"
                  : "left-[20%] bottom-[-35%] h-[125%] w-[80%] bg-blue"
            }`}
          />
          {/* play affordance so the tiles read as video slots */}
          <svg viewBox="0 0 16 16" className="relative h-3.5 w-3.5 opacity-40">
            <path d="M3 1.8v12.4L14 8 3 1.8Z" fill="#EEF0F6" />
          </svg>
        </div>
      ))}
    </div>
  );
}

export function ServiceBento() {
  const { bento } = home;
  return (
    <section className="section-pad">
      <div className="shell">
        <Reveal>
          <RevealItem>
            <Eyebrow accent="green">{bento.eyebrow}</Eyebrow>
            <h2 className="mt-4 max-w-[14ch] font-display text-h2 text-ink">
              {bento.headline}
            </h2>
          </RevealItem>
        </Reveal>

        <Reveal className="mt-12 grid gap-4 lg:grid-cols-12">
          {/* Premade: the wide cell, gold */}
          <RevealItem className="lg:col-span-7">
            <Link
              href={bento.premade.href}
              className="group flex h-full flex-col rounded-card border border-hair bg-surface p-8 transition-colors duration-200 hover:border-gold/40 md:p-10"
            >
              <Eyebrow accent="gold">{bento.premade.label}</Eyebrow>
              <h3 className="mt-4 max-w-[20ch] font-display text-h3 text-ink">
                {bento.premade.title}
              </h3>
              <p className="mt-3 max-w-[46ch] text-sm leading-relaxed text-muted">
                {bento.premade.body}
              </p>
              <PosterStrip />
              <div className="mt-8">
                <ArrowLink
                  href={bento.premade.href}
                  label={bento.premade.linkLabel}
                  accent="gold"
                />
              </div>
            </Link>
          </RevealItem>

          {/* Custom: green */}
          <RevealItem className="lg:col-span-5">
            <Link
              href={bento.custom.href}
              className="group flex h-full flex-col rounded-card border border-hair bg-surface p-8 transition-colors duration-200 hover:border-green/40 md:p-10"
            >
              <Eyebrow accent="green">{bento.custom.label}</Eyebrow>
              <h3 className="mt-4 max-w-[18ch] font-display text-h3 text-ink">
                {bento.custom.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {bento.custom.body}
              </p>
              {/* prices are always gold, site-wide */}
              <p className="mt-auto pt-8 font-mono text-price text-gold">
                {bento.custom.priceLine}
              </p>
              <div className="mt-4">
                <ArrowLink
                  href={bento.custom.href}
                  label={bento.custom.linkLabel}
                  accent="green"
                />
              </div>
            </Link>
          </RevealItem>

          {/* Editing: the full-width band, blue, different shape because
              it speaks to a different buyer */}
          <RevealItem className="lg:col-span-12">
            <Link
              href={bento.editing.href}
              className="group grid items-center gap-6 rounded-card border border-hair bg-surface p-8 transition-colors duration-200 hover:border-blue/40 md:grid-cols-[1fr_auto_auto] md:gap-10 md:p-10"
            >
              <div>
                <Eyebrow accent="blue">{bento.editing.label}</Eyebrow>
                <h3 className="mt-4 max-w-[30ch] font-display text-h3 text-ink">
                  {bento.editing.title}
                </h3>
                <p className="mt-3 max-w-[50ch] text-sm leading-relaxed text-muted">
                  {bento.editing.body}
                </p>
              </div>
              <p className="font-mono text-price text-gold">
                {bento.editing.priceLine}
              </p>
              <ArrowLink
                href={bento.editing.href}
                label={bento.editing.linkLabel}
                accent="blue"
              />
            </Link>
          </RevealItem>
        </Reveal>
      </div>
    </section>
  );
}
