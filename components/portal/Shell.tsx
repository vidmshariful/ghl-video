"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, Moon, Sun } from "lucide-react";
import { Logo } from "@/components/Logo";
import { THEME_KEY } from "@/components/portal/theme-init";

/*
 * The shared shell for the three portals (/admin, /portal, /partners):
 * one top bar, one icon sidebar with collapsible groups, one theme switch.
 * The look follows the portal surface skin, so the light/dark switch here
 * flips only the portals (data-theme on <html>, [data-surface="portal"]
 * scoping in globals.css), never the marketing site or checkout.
 *
 * Motion is deliberate and small: groups slide open, content fades up
 * (see .portal-group / .portal-view in globals.css), both disabled under
 * prefers-reduced-motion.
 */

export function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.getAttribute("data-theme") === "light");
  }, []);

  function flip() {
    const next = !light;
    setLight(next);
    if (next) document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");
    try {
      localStorage.setItem(THEME_KEY, next ? "light" : "dark");
    } catch {
      /* private mode */
    }
  }

  return (
    <button
      type="button"
      onClick={flip}
      aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
      title={light ? "Dark mode" : "Light mode"}
      className="tap grid h-9 w-9 place-items-center rounded-full border border-hair text-muted transition-colors hover:border-gold/60 hover:text-gold"
    >
      {light ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}

/* ---------------- top bar ---------------- */
export function PortalTopbar({
  area,
  right,
}: {
  /* "Site Admin" | "Portal" | "Partners" */
  area: string;
  right?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-hair bg-surface/90 px-4 py-3 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Logo className="h-6 shrink-0" />
        <span className="truncate font-mono text-label uppercase tracking-[0.1em] text-muted">
          / {area}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        <ThemeToggle />
        {right}
      </div>
    </header>
  );
}

/* ---------------- sidebar ---------------- */
export type NavItem = {
  key: string;
  label: string;
  icon: ReactNode;
  badge?: number;
};
export type NavGroup = {
  /* empty title = always-visible top-level items (Dashboard, Journal) */
  title: string;
  items: NavItem[];
};

export function PortalSidebar({
  groups,
  active,
  onSelect,
  storageKey,
}: {
  groups: NavGroup[];
  active: string;
  onSelect: (key: string) => void;
  storageKey: string;
}) {
  /* Which titled groups are open. Default: only the group holding the
   * active item, so the rail starts compact; choices persist per portal. */
  const [open, setOpen] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    let stored: Record<string, boolean> | null = null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) stored = JSON.parse(raw);
    } catch {
      /* fresh start */
    }
    if (stored) {
      setOpen(stored);
      return;
    }
    const initial: Record<string, boolean> = {};
    for (const g of groups) {
      if (!g.title) continue;
      initial[g.title] = g.items.some((it) => it.key === active);
    }
    setOpen(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial mount only
  }, []);

  /* never hide the active item: opening its group is a correction, not a choice */
  useEffect(() => {
    if (!open) return;
    const g = groups.find((x) => x.title && x.items.some((it) => it.key === active));
    if (g && open[g.title] === false) {
      setOpen((o) => ({ ...(o ?? {}), [g.title]: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to view changes
  }, [active]);

  function toggle(title: string) {
    setOpen((o) => {
      const next = { ...(o ?? {}), [title]: !(o?.[title] ?? false) };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* private mode */
      }
      return next;
    });
  }

  const Item = ({ it }: { it: NavItem }) => (
    <button
      type="button"
      onClick={() => onSelect(it.key)}
      className={`tap group flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2 text-left text-body-sm transition-colors ${
        active === it.key
          ? "bg-gold/15 font-semibold text-gold"
          : "text-muted hover:bg-hair/40 hover:text-ink"
      }`}
    >
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center [&>svg]:h-[16px] [&>svg]:w-[16px] ${
          active === it.key ? "text-gold" : "text-dim group-hover:text-ink"
        }`}
      >
        {it.icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{it.label}</span>
      {it.badge ? (
        <span className="rounded-full bg-gold px-1.5 py-0.5 font-mono text-label font-bold leading-none text-canvas">
          {it.badge}
        </span>
      ) : null}
    </button>
  );

  return (
    /* outer nav stretches to the column floor so the rail's background never
       stops short; the inner div is what sticks and scrolls */
    <nav className="border-b border-hair bg-surface/60 md:w-60 md:shrink-0 md:border-b-0 md:border-r">
      <div className="p-3 md:sticky md:top-[3.55rem] md:max-h-[calc(100vh-3.55rem)] md:overflow-y-auto md:p-4">
      {/* mobile: one compact dropdown */}
      <select
        value={active}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full rounded-[8px] border border-hair bg-canvas px-3 py-2.5 text-body text-ink focus:border-gold focus:outline-none md:hidden"
      >
        {groups.map((g) => {
          const opts = g.items.map((it) => (
            <option key={it.key} value={it.key}>
              {it.label}
              {it.badge ? ` (${it.badge})` : ""}
            </option>
          ));
          return g.title ? (
            <optgroup key={g.title} label={g.title}>
              {opts}
            </optgroup>
          ) : (
            opts
          );
        })}
      </select>

      {/* desktop: grouped, collapsible rail */}
      <div className="hidden flex-col gap-1 md:flex">
        {groups.map((g) => {
          /* a closed group must not swallow its items' badges (an unread
             count hiding is worse than a busy rail): bubble the sum up */
          const closedBadge = !(open?.[g.title] ?? false)
            ? g.items.reduce((s, it) => s + (it.badge ?? 0), 0)
            : 0;
          return g.title ? (
            <div key={g.title} className="mt-1.5">
              <button
                type="button"
                onClick={() => toggle(g.title)}
                aria-expanded={open?.[g.title] ?? false}
                className="tap flex w-full items-center justify-between rounded-[8px] px-3 py-1.5 font-mono text-label font-bold uppercase tracking-[0.12em] text-dim transition-colors hover:text-muted"
              >
                <span className="inline-flex items-center gap-2">
                  {g.title}
                  {closedBadge > 0 ? (
                    <span className="rounded-full bg-gold px-1.5 py-0.5 font-mono text-label font-bold leading-none text-canvas">
                      {closedBadge}
                    </span>
                  ) : null}
                </span>
                <ChevronDown
                  size={13}
                  className={`transition-transform duration-200 ${open?.[g.title] ? "" : "-rotate-90"}`}
                />
              </button>
              <div className="portal-group" data-closed={String(!(open?.[g.title] ?? false))}>
                <div>
                  <ul className="flex flex-col gap-0.5 pt-0.5">
                    {g.items.map((it) => (
                      <li key={it.key}>
                        <Item it={it} />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <ul key="top" className="flex flex-col gap-0.5">
              {g.items.map((it) => (
                <li key={it.key}>
                  <Item it={it} />
                </li>
              ))}
            </ul>
          );
        })}
      </div>
      </div>
    </nav>
  );
}
