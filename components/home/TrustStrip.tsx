import { Marquee } from "@/components/Marquee";
import { trustLogos } from "@/lib/site";

/*
 * The trust bar owns exactly one job: whose logos are on the wall, at a
 * glance, straight under the hero. The 800+ figure belongs to the client
 * wall and the 5.0 to the reviews section; repeating them here only
 * diluted all three. Logos ride as uniform light silhouettes so mixed
 * brand colours read on the dark ground, and light to full colour on
 * hover.
 */
function LogoMark({ src }: { src: string }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element -- static export, local asset */
    <img
      src={src}
      alt=""
      loading="lazy"
      className="h-6 w-auto max-w-[9rem] shrink-0 object-contain opacity-50 [filter:brightness(0)_invert(1)] transition duration-300 hover:opacity-100 hover:[filter:none]"
    />
  );
}

export function TrustStrip() {
  return (
    <section className="border-y border-hair">
      <div className="shell grid grid-cols-1 items-center gap-x-8 gap-y-5 py-7 lg:grid-cols-[auto_1fr]">
        {/* purpose cap in the chip bracket language */}
        <p className="font-mono text-label uppercase text-dim">
          [ <span className="text-muted">Trusted by</span> ]
        </p>

        <Marquee>
          {trustLogos.map((src) => (
            <LogoMark key={src} src={src} />
          ))}
        </Marquee>
      </div>
    </section>
  );
}
