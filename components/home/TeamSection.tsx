import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionChip } from "@/components/SectionChip";
import { SectionGlow } from "@/components/SectionGlow";
import { home } from "@/lib/site";

/* Team card: real photo when set, designed slot otherwise. */
function PhotoSlot({
  name,
  role,
  photo,
}: {
  name: string | null;
  role: string;
  photo: string | null;
}) {
  return (
    <div className="relative flex aspect-[4/5] items-end overflow-hidden rounded-media border border-hair bg-[#0B0D14]">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- static export
        <img
          src={photo}
          alt={name ?? role}
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
      ) : (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(160deg, rgba(252,192,0,0.08), rgba(0,0,0,0) 45%, rgba(0,204,0,0.08))",
            }}
          />
          <span className="absolute right-3 top-3 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-dim">
            Photo slot
          </span>
        </>
      )}
      <div className="relative w-full border-t border-hair bg-canvas/70 px-4 py-3 backdrop-blur-sm">
        <p className="font-display text-sm font-semibold text-ink">
          {name ?? "To be announced"}
        </p>
        <p className="mt-0.5 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted">
          {role}
        </p>
      </div>
    </div>
  );
}

export function TeamSection() {
  const { team } = home;
  return (
    <section className="relative overflow-hidden section-pad border-t border-hair">
      <SectionGlow accent="gold" position="right" />
      <div className="shell relative">
        <Reveal>
          <RevealItem>
            <SectionChip index={5} label={team.chip} />
            <h2 className="mt-6 max-w-[22ch] font-display text-h2 text-ink">
              {team.headline}{" "}
              <span className="text-gold">{team.accent}</span>
            </h2>
            <p className="mt-4 max-w-[52ch] text-lede text-muted">
              {team.intro}
            </p>
          </RevealItem>
        </Reveal>

        <Reveal className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {team.members.map((m) => (
            <RevealItem key={m.role}>
              <PhotoSlot name={m.name} role={m.role} photo={m.photo} />
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
