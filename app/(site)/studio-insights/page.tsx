import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { Button } from "@/components/Button";
import { CtaBand } from "@/components/CtaBand";
import { Reveal, RevealItem } from "@/components/Reveal";
import { RuledSection } from "@/components/RuledSection";
import { SectionGlow } from "@/components/SectionGlow";
import { SectionHead } from "@/components/SectionHead";
import { PageHero } from "@/components/pages/PageHero";
import { StudioRequestForm } from "@/components/StudioRequestForm";
import {
  getStudioSlots,
  getStudioUpdates,
  type StudioSlot,
  type StudioUpdate,
} from "@/lib/studio";
import { checkoutHref, cta, pages } from "@/lib/site";

/*
 * The public studio board: open capacity per service line and the
 * premade pipeline (request to published), both managed from the admin
 * Studio screen. ISR at five minutes, so an admin save is live within
 * one coffee.
 */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/studio-insights/", {
    title: "Studio Insights",
    description:
      "Inside the GHL Video studio: the premade pipeline from request to published, plus open capacity for premade, custom, and editing work. Request the next library video.",
    alternates: { canonical: "/studio-insights/" },
  });
}

const SERVICE_ORDER: StudioSlot["service"][] = ["premade", "custom", "editing"];

const SERVICE_NAMES: Record<StudioSlot["service"], string> = {
  premade: "Premade Videos",
  custom: "Custom Production",
  editing: "Video Editing",
};

/* editing capacity is a client-intake number, not a production slot
   count (client decision), so the unit line differs per service */
const SLOT_UNITS: Record<StudioSlot["service"], string> = {
  premade: "slots open",
  custom: "slots open",
  editing: "new client spots open",
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
  const [rawSlots, updates] = await Promise.all([
    getStudioSlots(),
    getStudioUpdates(),
  ]);
  const slots = [...rawSlots].sort(
    (a, b) => SERVICE_ORDER.indexOf(a.service) - SERVICE_ORDER.indexOf(b.service),
  );
  const byStage = (stage: StudioUpdate["status"]) =>
    updates.filter((u) => u.status === stage);
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
                          of {s.total} {SLOT_UNITS[s.service]}
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
                          This window is full. New work queues for the next
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

      {/* the premade pipeline: a four-stage board, request to published.
          Only library videos live here; client projects never show. */}
      <RuledSection
        bpIdx={3}
        index={3}
        chip={p.board.chip}
        headline={p.board.headline}
        accent={p.board.accent}
        intro={p.board.intro}
      >
        <div className="grid lg:grid-cols-4">
          {/* stage 1: the visitor request queue */}
          <div className="flex flex-col p-6 md:p-7">
            <p className="font-mono text-label uppercase tracking-[0.1em] text-ink">
              {p.board.columns.request.label}
            </p>
            <p className="mt-3 text-body-sm text-muted">
              {p.board.columns.request.blurb}
            </p>
            <div className="mt-5">
              <StudioRequestForm />
            </div>
          </div>

          {/* stages 2 to 4: admin-curated cards */}
          {(
            [
              { stage: "selected", meta: "target" },
              { stage: "in_production", meta: "target" },
              { stage: "published", meta: "published" },
            ] as const
          ).map(({ stage, meta }) => {
            const items = byStage(stage);
            const col = p.board.columns[stage];
            return (
              <div
                key={stage}
                className="flex flex-col border-t border-dashed border-hair p-6 md:p-7 lg:border-l lg:border-t-0"
              >
                <p className="flex items-baseline justify-between gap-3 font-mono text-label uppercase tracking-[0.1em] text-ink">
                  {col.label}
                  <span
                    className={`[font-variant-numeric:tabular-nums] ${
                      items.length > 0 ? "text-gold" : "text-dim"
                    }`}
                  >
                    [ {String(items.length).padStart(2, "0")} ]
                  </span>
                </p>
                {items.length === 0 ? (
                  <p className="mt-5 border border-dashed border-hair p-4 text-body-sm text-dim">
                    {col.empty}
                  </p>
                ) : (
                  <ul className="mt-5 space-y-3">
                    {items.map((u) => (
                      <li key={u.id} className="border border-hair bg-card/40 p-4">
                        {u.format && (
                          <span className="mb-2 inline-flex items-center rounded-[2px] border border-gold/30 bg-gold/[0.06] px-2 py-[3px] font-mono text-label uppercase tracking-[0.08em] text-gold">
                            {u.format}
                          </span>
                        )}
                        <p className="font-display text-body font-semibold leading-snug text-ink">
                          {u.title}
                        </p>
                        {u.note && (
                          <p className="mt-1.5 text-body-sm text-muted">{u.note}</p>
                        )}
                        {u.target_date && (
                          <p className="mt-2.5 font-mono text-label uppercase text-dim [font-variant-numeric:tabular-nums]">
                            {meta === "published" ? "Published" : "Target"}{" "}
                            {fmtDate(u.target_date)}
                          </p>
                        )}
                        {stage === "published" && u.link_slug && (
                          <Link
                            href={checkoutHref(u.link_slug)}
                            className="mt-2.5 inline-flex items-center gap-1.5 font-mono text-label uppercase tracking-[0.1em] text-gold transition-opacity hover:opacity-70"
                          >
                            {cta.orderPremade}
                            <span aria-hidden="true">&rarr;</span>
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
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
