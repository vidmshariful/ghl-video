"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Bell, ChevronDown, LifeBuoy, LogOut, Moon, Settings, Sun } from "lucide-react";
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

/* ---------------- shared bits ---------------- */

/** Close a popover on outside click or Escape, returning focus to the trigger. */
function useDismiss(
  ref: RefObject<HTMLDivElement | null>,
  open: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        ref.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, open, onClose]);
}

/** A person in the portal chrome: photo if set, initials on the gradient if not. */
export function PortalAvatar({
  name,
  email,
  url,
  size = "sm",
}: {
  name?: string | null;
  email: string;
  url?: string | null;
  size?: "sm" | "lg" | "xl";
}) {
  const cls =
    size === "xl"
      ? "h-16 w-16 text-h4"
      : size === "lg"
        ? "h-11 w-11 text-body"
        : "h-8 w-8 text-label";
  const initials = (name?.trim() || email)
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tiny avatar, remote bucket URL
      <img
        src={url}
        alt=""
        className={`${cls} shrink-0 rounded-full border border-chrome-line object-cover`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${cls} grid shrink-0 place-items-center rounded-full bg-brand-gradient font-display font-bold text-canvas`}
    >
      {initials}
    </span>
  );
}

/** Round top-bar icon button with an optional count badge. */
export function TopIconButton({
  label,
  onClick,
  badge,
  mobileHidden = false,
  children,
}: {
  label: string;
  onClick: () => void;
  badge?: number;
  /* drop the icon on the smallest screens (it must also live in a menu) */
  mobileHidden?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={badge ? `${label} (${badge} unread)` : label}
      title={label}
      className={`tap relative h-9 w-9 place-items-center rounded-full border border-chrome-line text-chrome-muted transition-colors hover:border-gold/60 hover:text-gold ${
        mobileHidden ? "hidden sm:grid" : "grid"
      }`}
    >
      {children}
      {badge ? (
        <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 font-mono text-[10px] font-bold leading-none text-canvas">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </button>
  );
}

const timeAgo = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/* ---------------- notifications bell ---------------- */
export type PortalNotification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

type Fetcher = (path: string, init?: RequestInit) => Promise<unknown>;

export function NotificationsBell({
  endpoint,
  fetcher,
  onOpenHref,
}: {
  /* e.g. "/api/admin/notifications" */
  endpoint: string;
  /* the portal's authed fetch (adds the session bearer) */
  fetcher: Fetcher;
  /* navigate to a notification's in-portal destination */
  onOpenHref: (href: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PortalNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const j = (await fetcher(endpoint)) as {
          notifications?: PortalNotification[];
          unread?: number;
        };
        if (active && j.notifications) {
          setItems(j.notifications);
          setUnread(j.unread ?? 0);
        }
      } catch {
        /* quiet; the badge just stays put */
      }
    };
    tick();
    const t = window.setInterval(tick, 45000);
    return () => {
      active = false;
      window.clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poll once per mount
  }, [endpoint]);

  async function markAll() {
    setItems((list) => list.map((n) => ({ ...n, readAt: n.readAt ?? "now" })));
    setUnread(0);
    try {
      await fetcher(endpoint, { method: "POST", body: JSON.stringify({}) });
    } catch {
      /* next poll corrects */
    }
  }

  async function openItem(n: PortalNotification) {
    if (!n.readAt) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, readAt: "now" } : x)));
      setUnread((u) => Math.max(0, u - 1));
      try {
        await fetcher(endpoint, { method: "POST", body: JSON.stringify({ ids: [n.id] }) });
      } catch {
        /* next poll corrects */
      }
    }
    setOpen(false);
    if (n.href) onOpenHref(n.href);
  }

  return (
    <div ref={ref} className="relative">
      <TopIconButton label="Notifications" badge={unread} onClick={() => setOpen((o) => !o)}>
        <Bell size={16} />
      </TopIconButton>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-[12px] border border-hair bg-surface shadow-2xl">
          <div className="flex items-center justify-between border-b border-hair px-4 py-2.5">
            <span className="font-mono text-label font-bold uppercase tracking-[0.1em] text-muted">
              Notifications
            </span>
            {unread > 0 ? (
              <button
                type="button"
                onClick={markAll}
                className="tap font-mono text-label uppercase text-gold transition-colors hover:brightness-110"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-1.5">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-body-sm text-muted">
                Nothing yet. Order and project events land here.
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openItem(n)}
                  className="tap flex w-full items-start gap-2.5 rounded-[8px] px-3 py-2.5 text-left transition-colors hover:bg-hair/40"
                >
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-hair" : "bg-gold"}`}
                  />
                  <span className="min-w-0">
                    <span
                      className={`block truncate text-body-sm ${n.readAt ? "text-muted" : "font-semibold text-ink"}`}
                    >
                      {n.title}
                    </span>
                    {n.body ? (
                      <span className="mt-0.5 block text-body-sm leading-snug text-dim [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                        {n.body}
                      </span>
                    ) : null}
                    <span className="mt-1 block font-mono text-label uppercase text-dim">
                      {timeAgo(n.createdAt)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- profile menu ---------------- */
export function ProfileMenu({
  name,
  email,
  avatarUrl,
  onSettings,
  onHelp,
  onSignOut,
  extra,
}: {
  name?: string | null;
  email: string;
  avatarUrl?: string | null;
  onSettings: () => void;
  onHelp: () => void;
  onSignOut: () => void;
  /* e.g. the account switcher for team members; rendered above Sign out */
  extra?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  const item =
    "tap flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-left text-body-sm text-muted transition-colors hover:bg-hair/40 hover:text-ink";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Your account"
        className="tap flex items-center gap-1.5 rounded-full border border-chrome-line p-0.5 pr-1.5 transition-colors hover:border-gold/50"
      >
        <PortalAvatar name={name} email={email} url={avatarUrl} />
        <ChevronDown size={13} className="text-chrome-dim" aria-hidden="true" />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-[12px] border border-hair bg-surface p-1.5 shadow-2xl">
          <div className="flex items-center gap-3 border-b border-hair px-3 pb-3 pt-2">
            <PortalAvatar name={name} email={email} url={avatarUrl} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-body font-semibold text-ink">{name || "Set your name"}</p>
              <p className="truncate font-mono text-label text-dim">{email}</p>
            </div>
          </div>
          <div className="pt-1.5">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onSettings();
              }}
              className={item}
            >
              <Settings size={15} className="shrink-0 text-dim" />
              Profile &amp; settings
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onHelp();
              }}
              className={item}
            >
              <LifeBuoy size={15} className="shrink-0 text-dim" />
              Help &amp; guide
            </button>
            {extra}
            <div className="my-1.5 border-t border-hair" />
            <button
              type="button"
              onClick={onSignOut}
              className="tap flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-left text-body-sm text-muted transition-colors hover:bg-hair/40 hover:text-error"
            >
              <LogOut size={15} className="shrink-0" />
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

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
      className="tap grid h-9 w-9 place-items-center rounded-full border border-chrome-line text-chrome-muted transition-colors hover:border-gold/60 hover:text-gold"
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
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-chrome-line bg-chrome px-4 py-3 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Logo className="h-6 shrink-0" />
        <span className="truncate font-mono text-label uppercase tracking-[0.1em] text-chrome-muted">
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
  /* Start open on a fresh visit. For a short menu whose groups ARE the
   * product (the customer portal sells from its rail), collapsing them hides
   * the store; a long admin rail still wants the compact default. The
   * visitor's own open/close choices always win over this. */
  defaultOpen?: boolean;
};

export function PortalSidebar({
  groups,
  active,
  onSelect,
  storageKey,
  bottom,
}: {
  groups: NavGroup[];
  active: string;
  onSelect: (key: string) => void;
  storageKey: string;
  /* items pinned to the rail's floor (Settings lives here) */
  bottom?: NavItem[];
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
      initial[g.title] = (g.defaultOpen ?? false) || g.items.some((it) => it.key === active);
    }
    setOpen(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial mount only
  }, []);

  /* never hide the active item: opening its group is a correction, not a
   * choice, so it is not persisted. Reacts to `groups` too: menus can arrive
   * late (admin items load with the account) or be regrouped between visits,
   * in which case the stored choices say nothing about the new titles. */
  useEffect(() => {
    if (!open) return;
    const g = groups.find((x) => x.title && x.items.some((it) => it.key === active));
    if (g && open[g.title] !== true) {
      setOpen((o) => ({ ...(o ?? {}), [g.title]: true }));
    }
  }, [active, groups, open]);

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
          ? "bg-chrome-2 font-semibold text-chrome-text"
          : "text-chrome-muted hover:bg-chrome-2/70 hover:text-chrome-text"
      }`}
    >
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center [&>svg]:h-[16px] [&>svg]:w-[16px] ${
          active === it.key ? "text-gold" : "text-chrome-dim group-hover:text-chrome-text"
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
       stops short; the inner div sticks, its group list scrolls, and the
       pinned block (Settings) always sits on the rail's floor */
    <nav className="border-b border-chrome-line bg-chrome md:w-60 md:shrink-0 md:border-b-0 md:border-r">
      <div className="p-3 md:sticky md:top-[3.55rem] md:flex md:h-[calc(100vh-3.55rem)] md:flex-col md:p-4">
      {/* mobile: one compact dropdown */}
      <select
        value={active}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full rounded-[8px] border border-chrome-line bg-chrome-2 px-3 py-2.5 text-body text-chrome-text focus:border-gold focus:outline-none md:hidden"
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
        {bottom && bottom.length > 0 ? (
          <optgroup label="General">
            {bottom.map((it) => (
              <option key={it.key} value={it.key}>
                {it.label}
              </option>
            ))}
          </optgroup>
        ) : null}
      </select>

      {/* desktop: grouped, collapsible rail */}
      <div className="hidden flex-col gap-1 md:flex md:min-h-0 md:flex-1 md:overflow-y-auto">
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
                className="tap flex w-full items-center justify-between rounded-[8px] px-3 py-1.5 font-mono text-label font-bold uppercase tracking-[0.12em] text-chrome-dim transition-colors hover:text-chrome-text"
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

      {/* pinned to the rail's floor, visible from every scroll position */}
      {bottom && bottom.length > 0 ? (
        <ul className="hidden shrink-0 flex-col gap-0.5 border-t border-chrome-line pt-3 md:mt-3 md:flex">
          {bottom.map((it) => (
            <li key={it.key}>
              <Item it={it} />
            </li>
          ))}
        </ul>
      ) : null}
      </div>
    </nav>
  );
}
