"use client";

import { type Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { sitePages } from "@/lib/pages-list";
import { site } from "@/lib/site";
import { supabase, authHeader } from "./client";
import { ALL_VIEWS, type View } from "./nav";
import {
  NotificationsBell,
  PortalSidebar,
  PortalTopbar,
  ProfileMenu,
  TopIconButton,
  type NavGroup,
} from "@/components/portal/Shell";
import { HandbookScreen } from "./HandbookScreen";
import { ReferenceScreen } from "./ReferenceScreen";
import { HealthScreen } from "./HealthScreen";
import { CommsScreen } from "./CommsScreen";
import { handbookFor } from "./handbook-map";
import {
  BarChart3,
  BookOpen,
  KeyRound,
  Newspaper,
  BadgeDollarSign,
  Clapperboard,
  FileText,
  Globe,
  Handshake,
  HeartPulse,
  Mail,
  LayoutDashboard,
  LifeBuoy,
  Link2,
  MessageSquare,
  Package,
  Repeat,
  Scissors,
  Search,
  Settings,
  ShoppingCart,
  Sparkles,
  Megaphone,
  Ticket,
  Users,
} from "lucide-react";
import { DashboardScreen } from "./DashboardScreen";
import { EditingScreen } from "./EditingScreen";
import { OrdersScreen } from "./OrdersScreen";
import { MessagesScreen } from "./MessagesScreen";
import { SubscriptionsScreen } from "./SubscriptionsScreen";
import { chatGet } from "@/components/chat/api";
import { CampaignsScreen } from "./CampaignsScreen";
import { CouponsScreen } from "./CouponsScreen";
import { LinksScreen } from "./LinksScreen";
import { InvoicesScreen } from "./InvoicesScreen";
import { CustomVideoScreen } from "./CustomVideoScreen";
import { SalesScreen } from "./SalesScreen";
import { CustomersScreen } from "./CustomersScreen";
import { PartnersScreen } from "./PartnersScreen";
import { StudioScreen } from "./StudioScreen";
import { JournalScreen } from "./JournalScreen";
import { SettingsScreen } from "./SettingsScreen";
import { ProductionScreen } from "./ProductionScreen";
import { ProductsHub } from "./ProductsHub";
import { BlogScreen } from "./BlogScreen";
import { SeoScreen } from "./SeoScreen";
import { canAccess, type Role } from "./roles";

/*
 * The managing area: /admin. Supabase Auth login, a sidebar, and one
 * screen per concern: Dashboard, Orders, Products, Catalog, Customers, plus
 * the site tools (Header & Footer Code, Pages). Reads/writes run through the
 * shared client and are enforced by row-level security. Screens live in their
 * own files; this file is the shell + login + the Code and Pages screens.
 *
 * Every screen has a real URL (/admin/orders/, /admin/settings/, ...):
 * the [[...view]] route passes the segment in as initialView, clicking the
 * menu pushes history, and back/forward or a refresh land on the same
 * screen. Links are shareable between teammates.
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
      <h1 className="font-display text-h3 text-ink">Pages</h1>
      <p className="mt-0.5 max-w-[var(--measure-body)] text-body-sm text-muted">
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
const pathFor = (v: View, sub?: string | null) =>
  v === "dashboard" ? "/admin/" : sub ? `/admin/${v}/${sub}/` : `/admin/${v}/`;

export function AdminClient({
  initialView,
  initialCustomerId = null,
  initialProjectId = null,
  initialEditingSlug = null,
}: {
  initialView: View;
  initialCustomerId?: string | null;
  initialProjectId?: string | null;
  initialEditingSlug?: string | null;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [view, setView] = useState<View>(initialView);
  /* which handbook topic to open when the help view is reached from a
     screen's own link, rather than from the menu */
  const [helpSlug, setHelpSlug] = useState<string | null>(null);
  /* the client record open at /admin/customers/<id>/, so one can be linked
     to a teammate rather than described */
  const [customerId, setCustomerId] = useState<string | null>(initialCustomerId);
  const [projectId, setProjectId] = useState<string | null>(initialProjectId);
  /* the editing client open at /admin/editing/<slug>/ */
  const [editingSlug, setEditingSlug] = useState<string | null>(initialEditingSlug);

  const [loginError, setLoginError] = useState("");

  /* the menu pushes a real URL; back/forward walk the screens */
  /* The optional slug is how a screen's own handbook link says "open help, on
     THIS topic". Reaching help any other way, such as the menu, passes nothing
     and clears it, so the menu always lands on the index. */
  const go = (v: View, slug: string | null = null) => {
    setView(v);
    setHelpSlug(v === "help" ? slug : null);
    setCustomerId(null);
    setProjectId(null);
    setEditingSlug(null);
    if (window.location.pathname !== pathFor(v)) {
      window.history.pushState(null, "", pathFor(v));
    }
  };

  /* opening an editing client is a navigation too, so their board gets the
     URL somebody can paste to a teammate */
  const openEditingClient = (slug: string | null) => {
    setEditingSlug(slug);
    const path = pathFor("editing", slug);
    if (window.location.pathname !== path) window.history.pushState(null, "", path);
  };

  /* opening a project is a navigation, so it gets a URL of its own */
  const openProject = (id: string | null) => {
    setProjectId(id);
    const path = id ? pathFor("custom", id) : pathFor("custom");
    if (window.location.pathname !== path) window.history.pushState(null, "", path);
  };

  /* opening a client record is a navigation, so it gets a URL of its own */
  const openCustomer = (id: string | null) => {
    setCustomerId(id);
    const path = pathFor("customers", id);
    if (window.location.pathname !== path) window.history.pushState(null, "", path);
  };
  useEffect(() => {
    const onPop = () => {
      const segs = window.location.pathname.replace(/^\/admin\/?/, "").split("/").filter(Boolean);
      const seg = segs[0] ?? "";
      setProjectId(seg === "custom" && segs[1] ? segs[1] : null);
      setView(seg && (ALL_VIEWS as string[]).includes(seg) ? (seg as View) : "dashboard");
      setCustomerId(seg === "customers" && segs[1] ? segs[1] : null);
      setEditingSlug(seg === "editing" && segs[1] ? segs[1] : null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const [msgUnread, setMsgUnread] = useState(0);
  const [alarmCount, setAlarmCount] = useState(0);
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
      window.history.replaceState(null, "", pathFor("dashboard"));
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

  /* Open critical alarms, for the Health badge. Polled on the same cadence as
   * the chat badge: the point of the badge is that trouble is visible from
   * whatever screen you happen to be on, without going to look for it. */
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/admin/alarms", { headers: await authHeader() });
        if (!r.ok) return;
        const j = (await r.json()) as { criticalCount?: number };
        if (active) setAlarmCount(j.criticalCount ?? 0);
      } catch {
        /* a health check that breaks the admin would be its own joke */
      }
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

  /* The menu, restructured (owner decision, August 2026): the daily screens
     on top, then Sales (money), Production (the three service lines: Premade,
     Custom, Editing), Affiliate, Products & Packs (what we sell), and CMS
     (the website). Emails and the site code live inside Settings. */
  const groups: { title: string; items: { key: View; label: string; icon: React.ReactNode; badge?: number }[] }[] = [
    {
      title: "",
      items: [
        { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard /> },
        { key: "messages", label: "Messages", icon: <MessageSquare />, badge: msgUnread || undefined },
        { key: "emails", label: "Emails & notifications", icon: <Mail /> },
        { key: "journal", label: "Journal", icon: <BookOpen /> },
        { key: "reference", label: "Reference", icon: <KeyRound /> },
        { key: "health", label: "Health", icon: <HeartPulse />, badge: alarmCount || undefined },
      ],
    },
    {
      title: "Sales",
      items: [
        { key: "sales", label: "Sales Dashboard", icon: <BadgeDollarSign /> },
        { key: "orders", label: "Orders", icon: <ShoppingCart /> },
        { key: "subscriptions", label: "Subscriptions", icon: <Repeat /> },
        { key: "invoices", label: "Invoices", icon: <FileText /> },
        { key: "coupons", label: "Coupons", icon: <Ticket /> },
        { key: "campaigns", label: "Offers", icon: <Megaphone /> },
        { key: "links", label: "Links", icon: <Link2 /> },
        { key: "customers", label: "Customers", icon: <Users /> },
      ],
    },
    {
      /* The three service lines, named after what we sell rather than after
         how the code is arranged. Premade is the order board, Custom is
         bespoke work, Editing is the monthly plans. */
      title: "Production",
      items: [
        { key: "production", label: "Premade", icon: <Clapperboard /> },
        { key: "custom", label: "Custom", icon: <Sparkles /> },
        { key: "editing", label: "Editing", icon: <Scissors /> },
      ],
    },
    {
      title: "Affiliate",
      items: [{ key: "partners", label: "Partners", icon: <Handshake /> }],
    },
    {
      title: "Products & Packs",
      items: [{ key: "catalog", label: "Products", icon: <Package /> }],
    },
    {
      title: "CMS",
      items: [
        { key: "pages", label: "Pages", icon: <Globe /> },
        { key: "blog", label: "Blog", icon: <Newspaper /> },
        { key: "seo", label: "SEO", icon: <Search /> },
        { key: "studio", label: "Studio Insights", icon: <BarChart3 /> },
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
            <TopIconButton
              label={handbookFor(view) ? `Guide: ${handbookFor(view)!.label}` : "Help & guide"}
              mobileHidden
              onClick={() => go("help", handbookFor(view)?.slug)}
            >
              <LifeBuoy size={16} />
            </TopIconButton>
            <NotificationsBell
              endpoint="/api/admin/notifications"
              fetcher={adminFetch}
              onOpenHref={(href) => {
                /* "custom/<id>", "customers/<id>", "health"; older rows carry a
                   full "/admin/production/" path, so strip that first */
                const segs = href.replace(/^\/admin\/?/, "").split("/").filter(Boolean);
                const target = (segs[0] ?? "") as View;
                if (!me || !canAccess(target, me.role, me.features)) return;
                if (target === "custom" && segs[1]) {
                  go("custom");
                  openProject(segs[1]);
                } else if (target === "customers" && segs[1]) {
                  go("customers");
                  openCustomer(segs[1]);
                } else {
                  go(target);
                }
              }}
            />
            <ProfileMenu
              name={me?.name}
              email={session.user.email ?? ""}
              avatarUrl={me?.avatarUrl}
              onSettings={() => go("settings")}
              onHelp={() => go("help")}
              onSignOut={() => supabase.auth.signOut()}
            />
          </>
        }
      />

      <div className="flex flex-1 flex-col md:flex-row">
        <PortalSidebar
          groups={visibleGroups}
          active={view}
          onSelect={(k) => go(k as View)}
          storageKey="ghlv-admin-nav"
          bottom={[{ key: "settings", label: "Settings", icon: <Settings /> }]}
        />

        {/* content: keyed on the view so each screen fades up as it opens */}
        <section className="min-w-0 flex-1 p-4 md:p-8">
          <div key={view} className="portal-view">
          {view === "dashboard" ? (
            <DashboardScreen onNavigate={go} />
          ) : view === "orders" ? (
            <OrdersScreen onNavigate={go} />
          ) : view === "messages" ? (
            <MessagesScreen
              onOpenCustomer={(id) => {
                go("customers");
                openCustomer(id);
              }}
            />
          ) : view === "subscriptions" ? (
            <SubscriptionsScreen />
          ) : view === "products" ? (
            <ProductsHub />
          ) : view === "coupons" ? (
            <CouponsScreen />
          ) : view === "campaigns" ? (
            <CampaignsScreen />
          ) : view === "links" ? (
            <LinksScreen />
          ) : view === "invoices" ? (
            <InvoicesScreen />
          ) : view === "sales" ? (
            <SalesScreen />
          ) : view === "custom" ? (
            <CustomVideoScreen openProjectId={projectId} onOpenProject={openProject} />
          ) : view === "customers" ? (
            <CustomersScreen openId={customerId} onOpen={openCustomer} />
          ) : view === "partners" ? (
            <PartnersScreen />
          ) : view === "studio" ? (
            <StudioScreen />
          ) : view === "reference" ? (
            <ReferenceScreen />
          ) : view === "health" ? (
            <HealthScreen />
          ) : view === "journal" ? (
            <JournalScreen meEmail={me?.email ?? ""} />
          ) : view === "pages" ? (
            <PagesScreen />
          ) : view === "blog" ? (
            <BlogScreen />
          ) : view === "seo" ? (
            <SeoScreen />
          ) : view === "catalog" ? (
            <ProductsHub />
          ) : view === "production" ? (
            <ProductionScreen
              onNavigate={go}
              onOpenProject={(id) => {
                go("custom");
                openProject(id);
              }}
              onOpenEditing={(slug) => {
                go("editing");
                openEditingClient(slug);
              }}
            />
          ) : view === "editing" ? (
            <EditingScreen openSlug={editingSlug} onOpenClient={openEditingClient} />
          ) : view === "emails" ? (
            <CommsScreen />
          ) : view === "code" ? (
            me ? (
              <SettingsScreen me={me} onMeChanged={loadMe} initialTab={view} />
            ) : (
              <p className="text-body text-muted">Loading your account...</p>
            )
          ) : view === "settings" ? (
            me ? (
              <SettingsScreen me={me} onMeChanged={loadMe} />
            ) : (
              <p className="text-body text-muted">Loading your account...</p>
            )
          ) : view === "help" ? (
            <HandbookScreen initialSlug={helpSlug} />
          ) : (
            // every View has an explicit branch above; fall back to the
            // dashboard for safety rather than a blank screen
            <DashboardScreen onNavigate={go} />
          )}
          </div>
        </section>
      </div>
    </div>
  );
}
