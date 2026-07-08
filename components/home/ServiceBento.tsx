import Link from "next/link";
import { Eyebrow } from "@/components/Eyebrow";
import { MediaFrame } from "@/components/MediaFrame";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionGlow } from "@/components/SectionGlow";
import { home, premadeVideos } from "@/lib/site";

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

/* Live thumbnails inside the premade cell: the sample clips, poster
 * when idle, playing on hover. Driven from lib/site.ts. */
function PosterStrip() {
  const strip = premadeVideos.slice(0, 3);
  return (
    <div className="mt-8 grid grid-cols-3 gap-3">
      {strip.map((v) =>
        v.preview ? (
          /* decorative inside the routing Link: hover-play only, the
             click belongs to the card's navigation */
          <MediaFrame
            key={v.slug}
            src={v.preview}
            poster={v.poster}
            interactive={false}
          />
        ) : null,
      )}
    </div>
  );
}

export function ServiceBento() {
  const { bento } = home;
  return (
    <section className="relative overflow-hidden section-pad">
      <SectionGlow accent="green" position="right" />
      <div className="shell relative">
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
              className="group flex h-full flex-col rounded-card border border-hair card-glass p-8 transition-colors duration-200 hover:border-gold/40 md:p-10"
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
              className="group flex h-full flex-col rounded-card border border-hair card-glass p-8 transition-colors duration-200 hover:border-green/40 md:p-10"
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
              className="group grid items-center gap-6 rounded-card border border-hair card-glass p-8 transition-colors duration-200 hover:border-blue/40 md:grid-cols-[1fr_auto_auto] md:gap-10 md:p-10"
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
