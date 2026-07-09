import Link from "next/link";
import { Panel } from "@/components/Panel";
import { Reveal, RevealItem } from "@/components/Reveal";
import type { ChipAccent } from "@/components/SectionChip";

const accentText: Record<ChipAccent, string> = {
  gold: "text-gold",
  green: "text-green",
  blue: "text-blue",
};

/*
 * Route-out pair at the end of a service page: the reader who did not
 * convert here gets the two adjacent services, each in its ledger
 * color. Quiet by design; the page's own CTA stays primary.
 */
export function CrossSell({
  items,
}: {
  items: readonly {
    eyebrow: string;
    line: string;
    linkLabel: string;
    href: string;
    accent: ChipAccent;
  }[];
}) {
  return (
    <Reveal className="grid gap-5 md:grid-cols-2">
      {items.map((item) => (
        <RevealItem key={item.href}>
          <Panel ticks={false} className="h-full overflow-hidden">
            <Link href={item.href} className="group block h-full p-7 md:p-8">
              <p className={`font-mono text-label uppercase ${accentText[item.accent]}`}>
                {item.eyebrow}
              </p>
              <p className="mt-3 max-w-[40ch] font-display text-h3 text-ink">
                {item.line}
              </p>
              <p
                className={`mt-5 inline-flex items-center gap-2 text-sm font-semibold ${accentText[item.accent]}`}
              >
                {item.linkLabel}
                <span
                  aria-hidden="true"
                  className="transition-transform duration-200 group-hover:translate-x-1"
                >
                  &rarr;
                </span>
              </p>
            </Link>
          </Panel>
        </RevealItem>
      ))}
    </Reveal>
  );
}
