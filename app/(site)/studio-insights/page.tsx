import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/Button";
import { CtaBand } from "@/components/CtaBand";
import { Reveal, RevealItem } from "@/components/Reveal";
import { RuledSection } from "@/components/RuledSection";
import { SectionGlow } from "@/components/SectionGlow";
import { SectionHead } from "@/components/SectionHead";
import { PageHero } from "@/components/pages/PageHero";
import { getStudioSlots, getStudioUpdates, type StudioSlot } from "@/lib/studio";
import { checkoutHref, cta, pages } from "@/lib/site";

/*
 * The public studio board: open capacity per service line and the
 * production board, both managed from the admin Studio screen. ISR at
 * five minutes, so an admin save is live within one coffee.
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Studio Insights",
  description:
    "Inside the GHL Video studio: what the team is producing now, launch dates, and open capacity for premade, custom, and editing work.",
  alternates: { canonical: "/studio-insights/" },
};

const SERVICE_NAMES: Record<StudioSlot["service"], string> = {
  premade: "Premade Videos",
  custom: "Custom Production",
  editing: "Video Editing",
};

/* deterministic date rendering (server + client agree) */
function fmtDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function SlotMeter({ total, remaining }: { total: number; remaining: number }) {
  const used = Math.max(0, total - remaining);
  if (total > 14) {
    return (
      <div className="h-1.5 w-full rounded-full bg-hair" aria-hidden="true">
        <div
          className="h-full rounded-full bg-brand-gradient"
          style={{ width: `${Math.round((remaining / total) * 100)}%` }}
        />
      </div>
    );
  }
  return (
    <div className="flex gap-1.5" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-2.5 flex-1 rounded-[2px] ${
            i < used ? "bg-hair" : "bg-gold"
          }`}
        />
      ))}
    </div>
  );
}

export default async function StudioInsightsPage() {
  const p = pages.studio;
  const [slots, updates] = await Promise.all([
    getStudioSlots(),
    getStudioUpdates(),
  ]);
  const inWork = updates.filter((u) => u.status !== "launched");
  const launched = updates.filter((u) => u.status === "launched");
  const lastTouch = [...slots.map((s) => s.updated_at), ...updates.map((u) => u.updated_at)]
    .sort()
    .at(-1);

  return (
    <>
      <PageHero
        chip={p.hero.chip}
        headline={p.hero.headline}
        accent={p.hero.accent}
        lede={p.hero.lede}
        signal={lastTouch ? `Updated ${fmtDate(lastTouch)}` : undefined}
      >
        <Button href={cta.seePremade.href}>{cta.seePremade.label}</Button>
        <Button href={cta.bookACall.href} variant="ghost">
          {cta.bookACall.label}
        </Button>
      </PageHero>

      {/* open capacity: one card per service line with a real ceiling */}
      <section data-bp-idx="2" className="relative overflow-x-clip section-pad">
        <SectionGlow position="right" />
        <div className="shell relative">
          <SectionHead
            index={2}
            chip={p.capacity.chip}
            headline={p.capacity.headline}
            accent={p.capacity.accent}
            intro={p.capacity.intro}
            center
          />
          {slots.length === 0 ? (
            <p className="mx-auto mt-12 max-w-[var(--measure-body)] text-center text-body text-muted">
              {p.capacity.empty}
            </p>
          ) : (
            <Reveal className="mt-12 grid gap-px border border-dashed border-hair bg-transparent md:grid-cols-3">
              {slots.map((s) => {
                const link =
                  p.capacity.links[s.service as keyof typeof p.capacity.links];
                const soldOut = s.remaining === 0;
                return (
                  <RevealItem
                    key={s.service}
                    className="border-t border-dashed border-hair first:border-t-0 md:border-l md:border-t-0 md:first:border-l-0"
                  >
                    <div className="flex h-full flex-col p-7 md:p-8">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="font-display text-h4 font-semibold text-ink">
                          {SERVICE_NAMES[s.service]}
                        </h3>
                        <span className="font-mono text-label uppercase text-dim">
                          {s.period_label}
                        </span>
                      </div>
                      <p className="mt-5 flex items-baseline gap-2">
                        <span
                          className={`font-mono text-stat-lg font-bold leading-none [font-variant-numeric:tabular-nums] ${
                            soldOut ? "text-dim" : "text-gold"
                          }`}
                        >
                          {s.remaining}
                        </span>
                        <span className="font-mono text-label uppercase text-muted">
                          of {s.total} slots open
                        </span>
                      </p>
                      <div className="mt-4">
                        <SlotMeter total={s.total} remaining={s.remaining} />
                      </div>
                      <p className="mt-3 font-mono text-label uppercase text-dim">
                        Updated {fmtDate(s.updated_at)}
                      </p>
                      <div className="mt-6 flex-1" />
                      {soldOut ? (
                        <p className="text-body text-muted">
                          This window is full. New orders queue for the next
                          one, or{" "}
                          <Link
                            href={cta.bookACall.href}
                            className="font-semibold text-gold"
                          >
                            book a call
                          </Link>{" "}
                          to plan it.
                        </p>
                      ) : (
                        <Link
                          href={link.href}
                          className="group inline-flex items-center gap-2 font-mono text-label uppercase tracking-[0.1em] text-gold transition-opacity hover:opacity-70"
                        >
                          {link.label}
                          <span
                            aria-hidden="true"
                            className="transition-transform duration-200 group-hover:translate-x-0.5"
                          >
                            &rarr;
                          </span>
                        </Link>
                      )}
                    </div>
                  </RevealItem>
                );
              })}
            </Reveal>
          )}
        </div>
      </section>

      {/* the production board */}
      <RuledSection
        bpIdx={3}
        index={3}
        chip={p.board.chip}
        headline={p.board.headline}
        accent={p.board.accent}
        intro={p.board.intro}
      >
        <div className="px-6 py-4 md:px-8">
          {inWork.length === 0 ? (
            <p className="py-6 text-body text-muted">{p.board.empty}</p>
          ) : (
            <ul>
              {inWork.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-t border-hair py-5 first:border-t-0"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-label uppercase text-gold">
                      {u.status === "announcement" ? "Announcement" : "In production"}
                    </p>
                    <p className="mt-1.5 font-display text-h4 font-semibold text-ink">
                      {u.title}
                    </p>
                    {u.note && (
                      <p className="mt-1 max-w-[var(--measure-body)] text-body text-muted">
                        {u.note}
                      </p>
                    )}
                  </div>
                  {u.target_date && (
                    <p className="shrink-0 font-mono text-label uppercase text-muted [font-variant-numeric:tabular-nums]">
                      Target {fmtDate(u.target_date)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {launched.length > 0 && (
            <>
              <p className="mt-8 border-t border-hair pt-6 font-mono text-label uppercase text-dim">
                {p.board.launchedHeading}
              </p>
              <ul className="mt-1">
                {launched.map((u) => (
                  <li
                    key={u.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-t border-hair py-4 first:border-t-0"
                  >
                    <div className="min-w-0">
                      <p className="font-display text-h4 font-semibold text-ink">
                        {u.title}
                      </p>
                      {u.link_slug && (
                        <Link
                          href={checkoutHref(u.link_slug)}
                          className="mt-1 inline-flex items-center gap-1.5 font-mono text-label uppercase tracking-[0.1em] text-gold transition-opacity hover:opacity-70"
                        >
                          {cta.orderPremade}
                          <span aria-hidden="true">&rarr;</span>
                        </Link>
                      )}
                    </div>
                    {u.target_date && (
                      <p className="shrink-0 font-mono text-label uppercase text-dim [font-variant-numeric:tabular-nums]">
                        Launched {fmtDate(u.target_date)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </RuledSection>

      <CtaBand
        bpIdx={4}
        headline={p.closing.headline}
        accent={p.closing.accent}
        sub={p.closing.sub}
        cta={p.closing.cta}
      />
    </>
  );
}
