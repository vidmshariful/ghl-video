import Link from "next/link";
import { DrawnIcon, type IconName } from "@/components/DrawnIcon";
import { Reveal, RevealItem } from "@/components/Reveal";

/*
 * Route-out pair at the end of a service page: two cells in one ruled
 * frame, no card backgrounds. The reader who did not convert here gets
 * the adjacent services.
 */
export function CrossSell({
  items,
}: {
  items: readonly {
    eyebrow: string;
    line: string;
    linkLabel: string;
    href: string;
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
              <p className="font-mono text-label uppercase text-gold">
                {item.eyebrow}
              </p>
              {item.icon && <DrawnIcon name={item.icon} />}
            </div>
            <p className="mt-4 max-w-[40ch] flex-1 font-display text-h3 text-ink">
              {item.line}
            </p>
            <p
              className={`mt-6 inline-flex items-center gap-2 text-body font-semibold text-gold`}
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
