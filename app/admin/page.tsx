"use client";

import { type Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { sitePages } from "@/lib/pages-list";
import { site } from "@/lib/site";
import { HEAD_SCRIPTS, BODY_END_SCRIPTS } from "@/lib/chrome";
import { supabase, authHeader } from "./client";
import type { View } from "./nav";
import {
  NotificationsBell,
  PortalSidebar,
  PortalTopbar,
  ProfileMenu,
  TopIconButton,
  type NavGroup,
} from "@/components/portal/Shell";
import { PortalHelp } from "@/components/portal/help";
import {
  BarChart3,
  BookOpen,
  Code,
  FileText,
  Film,
  Globe,
  Handshake,
  LayoutDashboard,
  LifeBuoy,
  Link2,
  Mail,
  MessageSquare,
  Package,
  Repeat,
  Settings,
  ShoppingCart,
  Ticket,
  Users,
} from "lucide-react";
import { DashboardScreen } from "./DashboardScreen";
import { OrdersScreen } from "./OrdersScreen";
import { MessagesScreen } from "./MessagesScreen";
import { SubscriptionsScreen } from "./SubscriptionsScreen";
import { chatGet } from "@/components/chat/api";
import { ProductsScreen } from "./ProductsScreen";
import { CouponsScreen } from "./CouponsScreen";
import { LinksScreen } from "./LinksScreen";
import { InvoicesScreen } from "./InvoicesScreen";
import { CustomersScreen } from "./CustomersScreen";
import { PartnersScreen } from "./PartnersScreen";
import { StudioScreen } from "./StudioScreen";
import { JournalScreen } from "./JournalScreen";
import { SettingsScreen } from "./SettingsScreen";
import { EmailTemplatesScreen } from "./EmailTemplatesScreen";
import { CatalogScreen } from "./CatalogScreen";
import { canAccess, type Role } from "./roles";

/*
 * The managing area: /admin. Supabase Auth login, a sidebar, and one
 * screen per concern: Dashboard, Orders, Products, Catalog, Customers, plus
 * the site tools (Header & Footer Code, Pages). Reads/writes run through the
 * shared client and are enforced by row-level security. Screens live in their
 * own files; this file is the shell + login + the Code and Pages screens.
 */

/* ---------------------------------------------------------------- */
/* Login                                                             */
/* ---------------------------------------------------------------- */
function Login({ onError, error }: { onError: (m: string) => void; error: string }) {
  const [mode, setMode] = useState<"signin" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const reset = mode === "reset";

  const switchMode = (m: "signin" | "reset") => {
    setMode(m);
    onError("");
    setNotice("");
  };

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    onError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) onError(error.message === "Invalid login credentials" ? "Wrong email or password." : error.message);
    setBusy(false);
  }

  /* set-first-time or forgot: sends the branded reset link. The set-password
     page establishes the session; the new password then works here too. */
  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return onError("Enter your email.");
    setBusy(true);
    onError("");
    setNotice("");
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/portal/set-password/` },
    );
    setBusy(false);
    if (error) onError(error.message);
    else setNotice(`We sent a link to ${email.trim()}. Open it to set your password.`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <form
        onSubmit={reset ? sendReset : signIn}
        className="w-full max-w-sm rounded-[12px] border border-hair bg-surface p-8"
      >
        <p className="font-display text-h4 font-semibold text-ink">
          GHL Video <span className="text-gradient">Site Admin</span>
        </p>
        <p className="mt-2 text-body-sm text-muted">
          {reset
            ? "Enter your email and we will send a link to set your password."
            : "Sign in to manage the website."}
        </p>
        <label className="mt-6 block">
          <span className="font-mono text-label uppercase text-muted">Email</span>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-[8px] border border-hair bg-canvas px-4 py-3 text-body text-ink focus:border-gold focus:outline-none"
          />
        </label>
        {!reset && (
          <label className="mt-4 block">
            <span className="font-mono text-label uppercase text-muted">Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-[8px] border border-hair bg-canvas px-4 py-3 text-body text-ink focus:border-gold focus:outline-none"
            />
          </label>
        )}
        {error && <p className="mt-4 text-body-sm text-error">{error}</p>}
        {notice && <p className="mt-4 text-body-sm text-gold">{notice}</p>}
        <button
          type="submit"
          disabled={busy}
          className="tap mt-6 w-full rounded-[8px] bg-brand-gradient px-6 py-3 text-body font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60"
        >
          {reset ? (busy ? "Sending" : "Send reset link") : busy ? "Signing in" : "Sign in"}
        </button>
        <button
          type="button"
          onClick={() => switchMode(reset ? "signin" : "reset")}
          disabled={busy}
          className="tap mt-4 w-full text-center font-mono text-label uppercase text-muted transition-colors hover:text-gold disabled:opacity-60"
        >
          {reset ? "Back to sign in" : "First time here, or forgot your password?"}
        </button>
      </form>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Screen 1: Header & Footer code                                    */
/* ---------------------------------------------------------------- */
function CodeScreen() {
  // The tracking snippets are hard-coded in lib/chrome.ts (see the note there)
  // and injected on every public page. This screen only mirrors them so the
  // team can confirm exactly what is live without touching the source.
  const blocks: { label: string; where: string; code: string }[] = [
    {
      label: "Header code (GTM, Google Ads, Hotjar)",
      where: "Injected at body start on every public page.",
      code: HEAD_SCRIPTS,
    },
    {
      label: "Footer code (GTM noscript, chat widget)",
      where: "Injected right before the closing body tag.",
      code: BODY_END_SCRIPTS,
    },
  ];

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-h2 text-ink">Header &amp; Footer Code</h1>
      <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
        These tracking and verification snippets are hard-coded in the site
        source and injected on every public page: the marketing site, the
        sales pages, and checkout. They are never added to the customer portal
        or this admin. This screen is read-only, so what you see below is
        exactly what is live. To change it, edit{" "}
        <span className="font-mono text-body-sm text-ink">lib/chrome.ts</span>{" "}
        and deploy.
      </p>

      {blocks.map((b) => (
        <div key={b.label} className="mt-8">
          <span className="font-mono text-label uppercase text-muted">{b.label}</span>
          <p className="mt-1 text-body-sm text-dim">{b.where}</p>
          <pre className="mt-2 max-h-80 w-full overflow-auto rounded-[8px] border border-hair bg-[#05060a] p-4 font-mono text-body-sm leading-relaxed text-ink">
            {b.code}
          </pre>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Screen 2: Pages                                                   */
/* ---------------------------------------------------------------- */
function PagesScreen() {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(url);
      setTimeout(() => setCopied(null), 1600);
    });
  }

  return (
    <div className="w-full">
      <h1 className="font-display text-h2 text-ink">Pages</h1>
      <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
        Every page the website ships. Pages marked direct link only are not
        in the navigation; this list is where you get their links.
      </p>
      <ul className="mt-8 overflow-hidden rounded-[12px] border border-hair">
        {sitePages.map((p) => {
          const url = `${site.url}${p.path}`;
          return (
            <li
              key={p.path}
              className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-hair bg-surface px-5 py-4 first:border-t-0"
            >
              <div className="min-w-0">
                <p className="text-body font-semibold text-ink">
                  {p.name}
                  {p.note && (
                    <span className="ml-3 inline-flex rounded-full border border-hair bg-canvas px-2.5 py-0.5 font-mono text-label uppercase text-dim">
                      {p.note}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 font-mono text-body-sm text-muted">{url}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => copy(url)}
                  className="tap rounded-[8px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
                >
                  {copied === url ? "Copied" : "Copy link"}
                </button>
                <a
                  href={p.path}
                  target="_blank"
                  rel="noopener"
                  className="tap rounded-[8px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
                >
                  Open
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}


/* ---------------------------------------------------------------- */
/* Shell                                                             */
/* ---------------------------------------------------------------- */
export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [loginError, setLoginError] = useState("");
  const [msgUnread, setMsgUnread] = useState(0);
  const [me, setMe] = useState<{
    email: string;
    name: string | null;
    role: Role;
    features: string[] | null;
    avatarUrl: string | null;
  } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Being logged in is not enough: this area is for the admins allowlist.
  useEffect(() => {
    if (!session) {
      setIsAdmin(null);
      return;
    }
    supabase.rpc("is_admin").then(({ data }) => setIsAdmin(data === true));
  }, [session]);

  // The signed-in admin's role + feature grants, used to gate the menu.
  // Settings re-runs this after a profile change so the top bar updates.
  const loadMe = async () => {
    try {
      const r = await fetch("/api/admin/me", { headers: await authHeader() });
      const j = await r.json();
      if (r.ok) setMe(j);
    } catch {
      /* stays as-is; the nav shows Dashboard only until it loads */
    }
  };
  useEffect(() => {
    if (!isAdmin) {
      setMe(null);
      return;
    }
    loadMe();
  }, [isAdmin]);

  // Never sit on a view this user is not allowed to open.
  useEffect(() => {
    if (me && view !== "dashboard" && !canAccess(view, me.role, me.features)) {
      setView("dashboard");
    }
  }, [me, view]);

  // Unread chat count for the Messages nav badge (studio side).
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    const tick = async () => {
      const j = await chatGet<{ unreadCount?: number }>("/api/admin/conversations");
      if (active) setMsgUnread(j.unreadCount ?? 0);
    };
    tick();
    const t = window.setInterval(tick, 20000);
    return () => {
      active = false;
      window.clearInterval(t);
    };
  }, [isAdmin]);

  if (!ready) return null;
  if (!session) return <Login onError={setLoginError} error={loginError} />;
  if (isAdmin === null) return null;
  if (!isAdmin)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-display text-h3 text-ink">Not authorized</p>
        <p className="max-w-sm text-body text-muted">
          {session.user.email} is not an admin. If you are a customer, your area
          is at <span className="text-gold">/portal</span>.
        </p>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="tap rounded-[8px] border border-hair px-5 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
        >
          Sign out
        </button>
      </div>
    );

  /* The menu, in working order: the daily pair on top, then money, people,
     partners, what we sell, the site itself, and access last. Icons follow
     the reference language; groups collapse (see PortalSidebar). */
  const groups: { title: string; items: { key: View; label: string; icon: React.ReactNode; badge?: number }[] }[] = [
    {
      title: "",
      items: [
        { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard /> },
        { key: "journal", label: "Journal", icon: <BookOpen /> },
      ],
    },
    {
      title: "Sales",
      items: [
        { key: "orders", label: "Orders", icon: <ShoppingCart /> },
        { key: "subscriptions", label: "Subscriptions", icon: <Repeat /> },
        { key: "invoices", label: "Invoices", icon: <FileText /> },
        { key: "coupons", label: "Coupons", icon: <Ticket /> },
        { key: "links", label: "Links", icon: <Link2 /> },
      ],
    },
    {
      title: "Clients",
      items: [
        { key: "customers", label: "Customers", icon: <Users /> },
        { key: "messages", label: "Messages", icon: <MessageSquare />, badge: msgUnread || undefined },
      ],
    },
    {
      title: "Partners",
      items: [{ key: "partners", label: "Partners", icon: <Handshake /> }],
    },
    {
      title: "Catalog",
      items: [
        { key: "catalog", label: "Catalog", icon: <Film /> },
        { key: "products", label: "Products & Pricing", icon: <Package /> },
      ],
    },
    {
      title: "Site",
      items: [
        { key: "pages", label: "Pages", icon: <Globe /> },
        { key: "studio", label: "Studio Insights", icon: <BarChart3 /> },
        { key: "emails", label: "Email Templates", icon: <Mail /> },
        { key: "code", label: "Header & Footer Code", icon: <Code /> },
      ],
    },
  ];

  // Gate the menu to what this admin may see; while `me` loads, show only
  // Dashboard.
  const visibleGroups: NavGroup[] = groups
    .map((g) => ({
      ...g,
      items: g.items.filter((it) =>
        me ? canAccess(it.key, me.role, me.features) : it.key === "dashboard",
      ),
    }))
    .filter((g) => g.items.length > 0);

  /* the bell's authed fetch: bearer header + JSON content type on writes */
  const adminFetch = async (path: string, init?: RequestInit) => {
    const r = await fetch(path, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        ...(await authHeader()),
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
      cache: "no-store",
    });
    return r.json();
  };

  return (
    <div className="flex min-h-screen flex-col">
      <PortalTopbar
        area="Site Admin"
        right={
          <>
            <TopIconButton label="Help & guide" mobileHidden onClick={() => setView("help")}>
              <LifeBuoy size={16} />
            </TopIconButton>
            <NotificationsBell
              endpoint="/api/admin/notifications"
              fetcher={adminFetch}
              onOpenHref={(href) => {
                const target = href.split("/")[0] as View;
                if (me && canAccess(target, me.role, me.features)) setView(target);
              }}
            />
            <ProfileMenu
              name={me?.name}
              email={session.user.email ?? ""}
              avatarUrl={me?.avatarUrl}
              onSettings={() => setView("settings")}
              onHelp={() => setView("help")}
              onSignOut={() => supabase.auth.signOut()}
            />
          </>
        }
      />

      <div className="flex flex-1 flex-col md:flex-row">
        <PortalSidebar
          groups={visibleGroups}
          active={view}
          onSelect={(k) => setView(k as View)}
          storageKey="ghlv-admin-nav"
          bottom={[{ key: "settings", label: "Settings", icon: <Settings /> }]}
        />

        {/* content: keyed on the view so each screen fades up as it opens */}
        <section className="min-w-0 flex-1 p-4 md:p-8">
          <div key={view} className="portal-view">
          {view === "dashboard" ? (
            <DashboardScreen onNavigate={setView} />
          ) : view === "orders" ? (
            <OrdersScreen />
          ) : view === "messages" ? (
            <MessagesScreen />
          ) : view === "subscriptions" ? (
            <SubscriptionsScreen />
          ) : view === "products" ? (
            <ProductsScreen />
          ) : view === "coupons" ? (
            <CouponsScreen />
          ) : view === "links" ? (
            <LinksScreen />
          ) : view === "invoices" ? (
            <InvoicesScreen />
          ) : view === "customers" ? (
            <CustomersScreen />
          ) : view === "partners" ? (
            <PartnersScreen />
          ) : view === "studio" ? (
            <StudioScreen />
          ) : view === "journal" ? (
            <JournalScreen meEmail={me?.email ?? ""} />
          ) : view === "code" ? (
            <CodeScreen />
          ) : view === "pages" ? (
            <PagesScreen />
          ) : view === "catalog" ? (
            <CatalogScreen />
          ) : view === "emails" ? (
            <EmailTemplatesScreen />
          ) : view === "settings" ? (
            me ? (
              <SettingsScreen me={me} onMeChanged={loadMe} />
            ) : (
              <p className="text-body text-muted">Loading your account...</p>
            )
          ) : view === "help" ? (
            <PortalHelp audience="admin" />
          ) : (
            // every View has an explicit branch above; fall back to the
            // dashboard for safety rather than a blank screen
            <DashboardScreen onNavigate={setView} />
          )}
          </div>
        </section>
      </div>
    </div>
  );
}
