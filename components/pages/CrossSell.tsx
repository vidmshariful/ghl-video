import Link from "next/link";
import { DrawnIcon, type IconName } from "@/components/DrawnIcon";
import { Reveal, RevealItem } from "@/components/Reveal";
import type { ChipAccent } from "@/components/SectionChip";

const accentText: Record<ChipAccent, string> = {
  gold: "text-gold",
  green: "text-gold",
  blue: "text-gold",
};

/*
 * Route-out pair at the end of a service page: two cells in one ruled
 * frame, no card backgrounds. The reader who did not convert here gets
 * the adjacent services, each in its ledger color.
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
    icon?: IconName;
  }[];
}) {
  return (
    <Reveal className="grid gap-px overflow-hidden rounded-card border border-hair bg-hair md:grid-cols-2">
      {items.map((item) => (
        <RevealItem key={item.href} className="h-full">
          <Link
            href={item.href}
            data-cell
            className="group flex h-full flex-col bg-canvas p-7 transition-colors duration-300 hover:bg-surface md:p-8"
          >
            <div className="flex items-start justify-between">
              <p
                className={`font-mono text-label uppercase ${accentText[item.accent]}`}
              >
                {item.eyebrow}
              </p>
              {item.icon && <DrawnIcon name={item.icon} accent={item.accent} />}
            </div>
            <p className="mt-4 max-w-[40ch] flex-1 font-display text-h3 text-ink">
              {item.line}
            </p>
            <p
              className={`mt-6 inline-flex items-center gap-2 text-sm font-semibold ${accentText[item.accent]}`}
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
        </RevealItem>
      ))}
    </Reveal>
  );
}
