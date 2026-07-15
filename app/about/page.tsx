import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { DrawnBorder } from "@/components/DrawnBorder";
import { Panel } from "@/components/Panel";
import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionHead } from "@/components/SectionHead";
import { Stat } from "@/components/Stat";
import { TeamSection } from "@/components/home/TeamSection";
import { PageHero } from "@/components/pages/PageHero";
import {
  clients,
  cta,
  disclaimer,
  entityLine,
  googleReviewsUrl,
  home,
  namedClients,
  otherBrands,
  pages,
  rating,
} from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "The original HighLevel-only video studio: one niche, an in-house team, and 800+ HighLevel SaaS teams served. A brand of Vidiosa LLC.",
};

export default function AboutPage() {
  const p = pages.about;
  return (
    <>
      <PageHero
        chip={p.hero.chip}
        headline={p.hero.headline}
        accent={p.hero.accent}
        accentColor="gold"
        lede={p.hero.lede}
      >
        <Button href={cta.bookACall.href} variant="hero">
          {cta.bookACall.label}
        </Button>
        <Button href={cta.seePremade.href} variant="ghost">
          {cta.seePremade.label}
        </Button>
      </PageHero>

      {/* light zone: the story */}
      <div className="theme-light">
      <section data-bp-idx="2" className="relative section-pad">
        <div className="shell">
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.1fr]">
            <SectionHead
              index={2}
              chip={p.story.chip}
              headline={p.story.headline}
              accent={p.story.accent}
              accentColor="gold"
            />
            <Reveal>
              <RevealItem className="grid gap-6">
                {p.story.paragraphs.map((par) => (
                  <p
                    key={par.slice(0, 24)}
                    className="max-w-[var(--measure-lede)] text-lede leading-relaxed text-muted"
                  >
                    {par}
                  </p>
                ))}
              </RevealItem>
            </Reveal>
          </div>
        </div>
      </section>

      </div>

      {/* founder POV: a dark feature moment */}
      <section data-bp-idx="3" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <Reveal>
            <RevealItem>
              <Panel className="overflow-hidden">
                <div className="grid lg:grid-cols-[auto_1fr]">
                  {home.founder.photo && (
                    <div className="relative lg:w-72">
                      {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
                      <img
                        src={home.founder.photo}
                        alt={home.founder.name}
                        width={500}
                        height={600}
                        className="h-64 w-full object-cover object-top lg:h-full"
                      />
                    </div>
                  )}
                  <div className="p-8 md:p-12">
                    <p className="font-mono text-label uppercase text-gold">
                      [ {p.founder.chip} ]
                    </p>
                    <blockquote className="mt-5 max-w-[44ch] font-display text-h3 leading-snug text-ink">
                      {p.founder.quote}
                    </blockquote>
                    <p className="mt-6 font-mono text-label uppercase text-muted">
                      {home.founder.name}{" "}
                      <span className="text-dim">/ {home.founder.role}</span>
                    </p>
                  </div>
                </div>
              </Panel>
            </RevealItem>
          </Reveal>
        </div>
      </section>

      {/* light zone: the people and the proof */}
      <div className="theme-light">
      <TeamSection index={4} />

      {/* clients */}
      <section data-bp-idx="5" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <SectionHead
            index={5}
            chip={p.clients.chip}
            headline={p.clients.headline}
            accent={p.clients.accent}
            accentColor="gold"
          />
          <Reveal className="mt-12 grid gap-6 lg:grid-cols-[1fr_auto]">
            <RevealItem>
              <div className="grid gap-px overflow-hidden rounded-card border border-hair bg-hair sm:grid-cols-3">
                {namedClients.map((c) => (
                  <div key={c.name} className="bg-canvas p-6">
                    <p className="font-display text-h4 font-semibold text-ink">
                      {c.name}
                    </p>
                    <p className="mt-1 font-mono text-label uppercase text-dim">
                      {c.role} / {c.company}
                    </p>
                  </div>
                ))}
              </div>
            </RevealItem>
            <RevealItem>
              <a
                href={googleReviewsUrl}
                target="_blank"
                rel="noopener"
                className="group flex h-full min-w-56 flex-col justify-center rounded-card border border-hair card-glass p-6"
              >
                <span className="font-mono text-stat-lg font-bold leading-none text-gold [font-variant-numeric:tabular-nums]">
                  <Stat value={clients} suffix="+" />
                </span>
                <span className="mt-2 font-mono text-label uppercase text-dim">
                  HighLevel SaaS teams
                </span>
                <span className="mt-4 border-t border-hair pt-4 font-mono text-label uppercase text-muted underline-offset-4 group-hover:underline">
                  {rating} on Google &rarr;
                </span>
              </a>
            </RevealItem>
          </Reveal>
        </div>
      </section>

      </div>

      {/* entity, openly */}
      <section data-bp-idx="6" className="relative section-pad">
        <DrawnBorder />
        <div className="shell">
          <SectionHead
            index={6}
            chip={p.entity.chip}
            headline={p.entity.headline}
            accent={p.entity.accent}
            accentColor="gold"
          />
          <Reveal className="mt-10">
            <RevealItem>
              <div className="rounded-card border border-hair bg-canvas p-7 md:p-8">
                <p className="max-w-[var(--measure-lede)] text-lede text-muted">
                  {p.entity.lines[0]}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <span className="inline-flex items-center rounded-full border border-hair bg-surface px-4 py-2 font-mono text-label uppercase text-muted">
                    {entityLine}
                  </span>
                  {otherBrands.map((b) => (
                    <a
                      key={b.name}
                      href={b.url}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-2 rounded-full border border-hair bg-surface px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/50 hover:text-gold"
                    >
                      {b.name}
                      <span aria-hidden="true">&rarr;</span>
                    </a>
                  ))}
                </div>
                <p className="mt-6 border-t border-hair pt-5 text-body text-dim">
                  {disclaimer}
                </p>
              </div>
            </RevealItem>
          </Reveal>
        </div>
      </section>
    </>
  );
}
