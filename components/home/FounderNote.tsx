import { Avatar } from "@/components/Avatar";
import { Reveal, RevealItem } from "@/components/Reveal";
import { home } from "@/lib/site";

/*
 * Small human moment before the closing CTA: face, two sentences in
 * the founder voice, mono attribution. Photo and final line come from
 * lib/site.ts (drafts until Shariful sends the real ones).
 */
export function FounderNote() {
  const { founder } = home;
  return (
    <section className="border-t border-hair">
      <div className="shell py-16 md:py-20">
        <Reveal>
          <RevealItem className="flex max-w-2xl items-start gap-5">
            <Avatar name={founder.name} photo={founder.photo} size="lg" />
            <div>
              <p className="text-[1.0625rem] leading-relaxed text-ink">
                {founder.line}
              </p>
              <p className="mt-4 font-mono text-sm">
                <span className="text-ink">{founder.name}</span>
                <span className="text-dim"> / {founder.role}</span>
              </p>
            </div>
          </RevealItem>
        </Reveal>
      </div>
    </section>
  );
}
