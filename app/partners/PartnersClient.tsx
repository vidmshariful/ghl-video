"use client";

import { useEffect, useState } from "react";
import { Button, Input, Textarea } from "@/components/portal/ui";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";
import {
  NotificationsBell,
  PortalSidebar,
  PortalTopbar,
  ProfileMenu,
  TopIconButton,
} from "@/components/portal/Shell";
import { AvatarUploader, PasswordCard } from "@/components/portal/account";
import { TeamCard } from "@/components/portal/team";
import {
  actForHeader,
  getActFor,
  hasChosenAccount,
  initActFor,
  setActFor,
} from "@/components/portal/act-for";
import { memberCan } from "@/lib/team-features";
import { PROGRAM_RULES, tierDef } from "@/lib/partner-program";
import { BookACallView, WhiteLabelView } from "@/components/portal/booking";
import { PARTNER_VIEWS, type View } from "./views";
import {
  BarChart3,
  BookOpen,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  Link2,
  PhoneCall,
  Settings,
  Users,
  Wallet,
} from "lucide-react";

/*
 * The affiliate partner portal at /partners. Password login (same Supabase
 * auth as the customer portal), then the partner's own links, promo assets,
 * program resources, and profile. All data comes from /api/partners/*,
 * which resolves the signed-in email to a partners row server-side.
 * Performance stats sync from FirstPromoter in a later phase; the money
 * (commission rules, payouts) stays in FirstPromoter.
 */

type Membership = { ownerEmail: string; ownerName: string | null; status: string };

type Me = {
  status: "none" | "applied" | "paused" | "active";
  partner?: {
    name: string;
    email: string | null;
    ref: string;
    status: string;
    tier: "affiliate" | "vip" | "partnership";
    photoPath: string | null;
    roleLine: string;
    tagline: string | null;
    bio: string | null;
    couponCode: string | null;
    discountPercent: number;
    discountMonths: number;
    fpRef: string | null;
    avatarUrl: string | null;
  };
  pages?: { title: string; url: string }[];
  primaryLink?: string;
  links?: { label: string; url: string }[];
  memberships?: Membership[];
  viewer?: {
    name: string | null;
    avatarUrl: string | null;
    isOwner: boolean;
    features: string[] | null;
    actingFor: { email: string; name: string } | null;
    memberships: Membership[];
  };
};

const ACT_FOR_KEY = "ghlv-partners-act-for";

type Asset = {
  id: string;
  kind: "banner" | "graphic" | "logo" | "video" | "copy" | "doc";
  title: string;
  description: string | null;
  fileUrl: string | null;
  body: string | null;
  yours: boolean;
};

const pathFor = (v: View) => (v === "dashboard" ? "/partners/" : `/partners/${v}/`);

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard /> },
  { key: "performance", label: "Performance", icon: <BarChart3 /> },
  { key: "referrals", label: "Referrals", icon: <Users /> },
  { key: "earnings", label: "Earnings & Payouts", icon: <Wallet /> },
  { key: "assets", label: "Links & Assets", icon: <Link2 /> },
  { key: "resources", label: "Resources", icon: <BookOpen /> },
  { key: "book", label: "Book a Call", icon: <PhoneCall /> },
];

/* ---- FirstPromoter-backed data payloads ---- */
type FpGate = { configured: boolean; found?: boolean; unavailable?: boolean };
type StatsPayload = FpGate & {
  stats?: {
    clicks: number;
    referrals: number;
    customers: number;
    activeCustomers: number;
    sales: number;
    revenueCents: number;
  };
  balanceCents?: number;
  joinedAt?: string | null;
  campaigns?: { name: string; state: string; refLink: string | null; coupon: string | null }[];
  series?: { period: string; clicks: number; referrals: number; revenueCents: number; earningsCents: number }[];
};
type ReferralsPayload = FpGate & {
  referrals?: { id: number; who: string; state: string; createdAt: string | null; customerSince: string | null }[];
};
type PayoutsPayload = FpGate & {
  balanceCents?: number;
  lifetimePaidCents?: number;
  revenueCents?: number;
  payouts?: {
    id: number;
    status: string;
    amountCents: number;
    periodStart: string | null;
    periodEnd: string | null;
    paidAt: string | null;
    createdAt: string | null;
    method: string | null;
  }[];
};

const fpMoney = (cents: number) =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 ? 2 : 0,
  });
const fpDay = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

/* fetch one FP-backed endpoint with loading + error state */
function useFpData<T extends FpGate>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (!path) return; // gated off for this viewer
    let active = true;
    authedFetch<T>(path)
      .then((j) => {
        if (active) setData(j);
      })
      .catch(() => {
        if (active) setErr(true);
      });
    return () => {
      active = false;
    };
  }, [path]);
  return { data, err };
}

/* the three graceful non-data states every stats page shares */
function FpStateCard({ data, err }: { data: FpGate | null; err: boolean }) {
  if (err || data?.unavailable)
    return (
      <div className="mt-8 rounded-[12px] border border-hair bg-surface px-6 py-10 text-center">
        <p className="font-display text-h4 text-ink">Stats are catching their breath.</p>
        <p className="mx-auto mt-2 max-w-md text-body text-muted">
          We could not reach the tracking system just now. Give it a minute and reload.
        </p>
      </div>
    );
  if (data && !data.configured)
    return (
      <div className="mt-8 rounded-[12px] border border-hair bg-surface px-6 py-10 text-center">
        <p className="font-mono text-label uppercase text-gold">[ Almost live ]</p>
        <p className="mt-3 font-display text-h4 text-ink">Stats sync is being switched on.</p>
        <p className="mx-auto mt-2 max-w-md text-body text-muted">
          Your numbers will appear here automatically once the connection is live. Your
          clicks and referrals are being tracked the whole time, nothing is lost.
        </p>
      </div>
    );
  if (data && data.configured && data.found === false)
    return (
      <div className="mt-8 rounded-[12px] border border-hair bg-surface px-6 py-10 text-center">
        <p className="font-display text-h4 text-ink">Your tracking profile is not linked yet.</p>
        <p className="mx-auto mt-2 max-w-md text-body text-muted">
          We match by email and could not find yours. Write to hi@ghlvideo.com and we
          will link it by hand in a minute.
        </p>
      </div>
    );
  if (!data)
    return <p className="mt-8 text-body text-muted">Loading your numbers...</p>;
  return null;
}


async function authedFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const r = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...actForHeader(),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  });
  return r.json();
}

/* one shared "copied" affordance */
function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1600);
    });
  };
  return { copied, copy };
}

/* ---- login (mirrors the customer portal's) ---- */
const LOGIN_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LoginView() {
  const [mode, setMode] = useState<"signin" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const reset = mode === "reset";

  const cleanEmail = () => email.trim().toLowerCase();
  const switchMode = (m: "signin" | "reset") => {
    setMode(m);
    setErr("");
    setNotice(null);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail(),
        password,
      });
      setBusy(false);
      if (error)
        setErr("That email and password did not match. First time here? Set your password below.");
    } else {
      if (!LOGIN_EMAIL_RE.test(cleanEmail())) {
        setBusy(false);
        setErr("Enter your email.");
        return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail(), {
        redirectTo: `${window.location.origin}/partners/set-password/`,
      });
      setBusy(false);
      if (error) setErr(error.message);
      else setNotice(`We sent a link to ${cleanEmail()}. Open it to set your password.`);
    }
  }

  return (
    <section className="relative flex-1 py-12 md:py-16">
      <div className="shell">
        <div className="mx-auto max-w-md">
          <p className="font-mono text-label uppercase text-gold">[ Partner portal ]</p>
          <h1 className="mt-4 font-display text-h2 text-ink">
            {reset ? "Set or reset your password." : "Welcome, partner."}
          </h1>

          {notice ? (
            <div className="mt-8 rounded-[12px] border border-gold/40 bg-gold/[0.06] px-6 py-8">
              <p className="font-display text-h4 text-ink">Check your email.</p>
              <p className="mt-2 text-body text-muted">{notice}</p>
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="tap mt-4 font-mono text-label uppercase text-muted transition-colors hover:text-gold"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={submit} className="mt-8 grid gap-4">
                <p className="text-body text-muted">
                  {reset
                    ? "Enter the email we invited you with, and we will send a link to set your password."
                    : "Sign in to grab your links, assets, and program details."}
                </p>
                <label className="grid gap-2">
                  <span className="font-mono text-label uppercase text-muted">Email</span>
                  <Input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                {!reset && (
                  <label className="grid gap-2">
                    <span className="font-mono text-label uppercase text-muted">Password</span>
                    <Input
                      type="password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </label>
                )}
                {err && <p className="text-body-sm text-error">{err}</p>}
                <Button variant="brand" type="submit" disabled={busy}>
                  {busy ? "One moment..." : reset ? "Send the link" : "Sign in"}
                </Button>
              </form>
              <div className="mt-6 grid gap-3 border-t border-hair pt-6">
                <button
                  type="button"
                  onClick={() => switchMode(reset ? "signin" : "reset")}
                  className="tap text-left text-body-sm text-muted transition-colors hover:text-gold"
                >
                  {reset
                    ? "Back to sign in with a password"
                    : "First time here, or forgot your password? Set it by email"}
                </button>
                <p className="text-body-sm text-dim">
                  Not a partner yet?{" "}
                  <Link href="/partners/apply" className="text-gold hover:brightness-110">
                    Apply to the program
                  </Link>
                  .
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---- gate screens for non-active partner states ---- */
function GateScreen({
  heading,
  body,
  showApply,
}: {
  heading: string;
  body: string;
  showApply?: boolean;
}) {
  return (
    <section className="relative flex-1 py-12 md:py-16">
      <div className="shell">
        <div className="mx-auto max-w-md text-center">
          <p className="font-mono text-label uppercase text-gold">[ Partner portal ]</p>
          <h1 className="mt-4 font-display text-h2 text-ink">{heading}</h1>
          <p className="mt-3 text-body text-muted">{body}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {showApply && (
              <Button href="/partners/apply" variant="brand">
                Apply to the program
              </Button>
            )}
            <Button href="mailto:hi@ghlvideo.com">
              hi@ghlvideo.com
            </Button>
            <Button variant="secondary" onClick={() => supabase.auth.signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---- dashboard ---- */
function DashboardView({
  me,
  can,
  actingLabel,
  onNavigate,
}: {
  me: Me;
  can: (key: string) => boolean;
  actingLabel: string | null;
  onNavigate: (v: View) => void;
}) {
  const p = me.partner!;
  const { copied, copy } = useCopy();
  const first = (actingLabel ? me.viewer?.name ?? p.name : p.name).split(" ")[0];
  const canPerf = can("performance");
  const { data: st } = useFpData<StatsPayload>(canPerf ? "/api/partners/stats" : "");
  const live = canPerf && st?.configured && st.found && st.stats;

  return (
    <div className="w-full">
      <h1 className="font-display text-h3 text-ink">Welcome back, {first}.</h1>
      {actingLabel ? (
        <p className="mt-1 font-mono text-label uppercase text-dim">
          Working in {actingLabel}&apos;s partner account
        </p>
      ) : null}
      <p className="mt-1 font-mono text-label uppercase text-gold">
        {tierDef(p.tier).name}: {tierDef(p.tier).firstOrderPct}% on a client&apos;s first
        order, {tierDef(p.tier).followOnPct}% on everything after, for life
      </p>
      <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
        {p.couponCode
          ? `Your audience gets ${p.discountPercent}% off every GHL Video service with your code ${p.couponCode}. Your links credit every sale to you.`
          : "Your links credit every sale to you automatically. Share them anywhere you recommend the studio."}
      </p>

      {live ? (
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
          {[
            ...(st!.balanceCents !== undefined && can("earnings")
              ? [{ label: "Your balance", value: fpMoney(st!.balanceCents), gold: true }]
              : []),
            { label: "Revenue driven", value: fpMoney(st!.stats!.revenueCents) },
            { label: "Clicks", value: st!.stats!.clicks.toLocaleString("en-US") },
            { label: "Referrals", value: st!.stats!.referrals.toLocaleString("en-US") },
            { label: "Customers", value: st!.stats!.customers.toLocaleString("en-US") },
          ].map((tile) => (
            <div
              key={tile.label}
              className={`rounded-[12px] border p-6 ${
                tile.gold ? "border-gold/40 bg-gold/[0.06]" : "border-hair bg-surface"
              }`}
            >
              <p className="font-mono text-label uppercase text-muted">{tile.label}</p>
              <p className={`mt-2 font-display text-h3 font-semibold ${tile.gold ? "text-gold" : "text-ink"}`}>
                {tile.value}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[12px] border border-hair bg-surface p-6">
          <p className="font-mono text-label uppercase text-muted">Your main link</p>
          <p className="mt-2 break-all font-mono text-body-sm text-ink">{me.primaryLink}</p>
          <button
            type="button"
            onClick={() => copy("primary", me.primaryLink ?? "")}
            className="mt-4"
          >
            {copied === "primary" ? "Copied" : "Copy link"}
          </button>
        </div>
        <div className="rounded-[12px] border border-hair bg-surface p-6">
          <p className="font-mono text-label uppercase text-muted">Your coupon</p>
          {p.couponCode ? (
            <>
              <p className="mt-2 font-mono text-h4 font-semibold uppercase tracking-[0.08em] text-gold">
                {p.couponCode}
              </p>
              <p className="mt-1 text-body-sm text-muted">
                Your audience enters this at checkout for their discount. On your
                partner page, buy buttons apply it for them.
              </p>
              <button
                type="button"
                onClick={() => copy("coupon", p.couponCode ?? "")}
                className="mt-3"
              >
                {copied === "coupon" ? "Copied" : "Copy code"}
              </button>
            </>
          ) : (
            <p className="mt-2 text-body text-muted">
              Your account runs on tracked links alone: share your link and
              every sale credits you. No code needed.
            </p>
          )}
        </div>
      </div>

      {me.pages && me.pages.length > 0 && (
        <div className="mt-4 rounded-[12px] border border-gold/30 bg-gold/[0.04] p-6">
          <p className="font-mono text-label uppercase text-gold">Your partner page</p>
          {me.pages.map((pg) => (
            <div
              key={pg.url}
              className="mt-3 flex flex-wrap items-center justify-between gap-3"
            >
              <p className="break-all font-mono text-body-sm text-ink">{pg.url}</p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => copy(pg.url, pg.url)}
                >
                  {copied === pg.url ? "Copied" : "Copy"}
                </Button>
                <Button href={pg.url} target="_blank" rel="noopener">
                  Open
                </Button>
              </div>
            </div>
          ))}
          <p className="mt-3 text-body-sm text-muted">
            A page built around you: your name, your face, your offer. Send people here
            for the full pitch.
          </p>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onNavigate("assets")}
          className="tap rounded-[12px] border border-hair bg-surface p-6 text-left transition-colors hover:border-gold/50"
        >
          <p className="font-display text-h4 text-ink">Links &amp; assets</p>
          <p className="mt-1 text-body-sm text-muted">
            Tracked links to every page, banners, and ready-to-send copy.
          </p>
        </button>
        {live && can("earnings") ? (
          <button
            type="button"
            onClick={() => onNavigate("earnings")}
            className="tap rounded-[12px] border border-hair bg-surface p-6 text-left transition-colors hover:border-gold/50"
          >
            <p className="font-display text-h4 text-ink">Earnings &amp; payouts</p>
            <p className="mt-1 text-body-sm text-muted">
              Your balance, commission history, and payout status.
            </p>
          </button>
        ) : !can("earnings") ? null : (
          <div className="rounded-[12px] border border-hair bg-surface p-6">
            <p className="font-display text-h4 text-ink">Earnings &amp; stats</p>
            <p className="mt-1 text-body-sm text-muted">
              {st && st.configured && st.found === false
                ? "Your tracking profile is not linked yet. Write to hi@ghlvideo.com and we will link it in a minute."
                : "Your numbers appear here automatically once stats sync is live. Tracking runs the whole time, nothing is lost."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- performance ---- */
function PerformanceView() {
  const { data, err } = useFpData<StatsPayload>("/api/partners/stats");
  const gate = <FpStateCard data={data} err={err} />;
  const series = data?.series ?? [];
  const maxClicks = Math.max(1, ...series.map((s) => s.clicks));
  const last30 = series.reduce(
    (acc, s) => ({
      clicks: acc.clicks + s.clicks,
      referrals: acc.referrals + s.referrals,
      revenueCents: acc.revenueCents + s.revenueCents,
      earningsCents: acc.earningsCents + s.earningsCents,
    }),
    { clicks: 0, referrals: 0, revenueCents: 0, earningsCents: 0 },
  );

  return (
    <div className="w-full">
      <h1 className="font-display text-h3 text-ink">Performance</h1>
      <p className="mt-0.5 max-w-[var(--measure-body)] text-body-sm text-muted">
        Every click and sale through your links, synced automatically. Lifetime first,
        then the last 30 days.
      </p>
      {gate}
      {data?.configured && data.found && data.stats ? (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: "Clicks, lifetime", value: data.stats.clicks.toLocaleString("en-US") },
              { label: "Referrals, lifetime", value: data.stats.referrals.toLocaleString("en-US") },
              { label: "Customers", value: data.stats.customers.toLocaleString("en-US") },
              { label: "Revenue driven", value: fpMoney(data.stats.revenueCents) },
            ].map((tile) => (
              <div key={tile.label} className="rounded-[12px] border border-hair bg-surface p-6">
                <p className="font-mono text-label uppercase text-muted">{tile.label}</p>
                <p className="mt-2 font-display text-h3 font-semibold text-ink">{tile.value}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-10 font-display text-h4 text-ink">The last 30 days</h2>
          <div className="mt-4 rounded-[12px] border border-hair bg-surface p-5">
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <p className="text-body-sm text-muted">
                Clicks <span className="ml-1 font-semibold text-ink">{last30.clicks.toLocaleString("en-US")}</span>
              </p>
              <p className="text-body-sm text-muted">
                Referrals <span className="ml-1 font-semibold text-ink">{last30.referrals.toLocaleString("en-US")}</span>
              </p>
              <p className="text-body-sm text-muted">
                Revenue <span className="ml-1 font-semibold text-ink">{fpMoney(last30.revenueCents)}</span>
              </p>
              <p className="text-body-sm text-muted">
                Your earnings <span className="ml-1 font-semibold text-gold">{fpMoney(last30.earningsCents)}</span>
              </p>
            </div>
            {series.length > 0 && last30.clicks + last30.referrals > 0 ? (
              <div className="mt-5 flex h-24 items-end gap-[3px]" aria-hidden="true">
                {series.map((s) => (
                  <div
                    key={s.period}
                    title={`${fpDay(s.period)}: ${s.clicks} clicks`}
                    className="flex-1 rounded-t-[2px] bg-gold/70"
                    style={{ height: `${Math.max(3, (s.clicks / maxClicks) * 100)}%`, opacity: s.clicks ? 1 : 0.18 }}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-4 text-body-sm text-dim">
                No clicks in the last 30 days yet. Share a link and watch this fill in.
              </p>
            )}
          </div>

          {data.campaigns && data.campaigns.length > 0 ? (
            <>
              <h2 className="mt-10 font-display text-h4 text-ink">Your campaigns</h2>
              <ul className="mt-4 overflow-hidden rounded-[12px] border border-hair">
                {data.campaigns.map((c, i) => (
                  <li
                    key={`${c.name}-${i}`}
                    className="flex flex-wrap items-center justify-between gap-2 border-t border-hair bg-canvas px-5 py-3.5 first:border-t-0"
                  >
                    <div className="min-w-0">
                      <p className="text-body font-semibold text-ink">{c.name}</p>
                      {c.refLink ? (
                        <p className="mt-0.5 break-all font-mono text-body-sm text-muted">{c.refLink}</p>
                      ) : null}
                    </div>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${
                        c.state === "accepted" ? "border-green/40 text-green" : "border-hair text-dim"
                      }`}
                    >
                      {c.state}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/* ---- referrals ---- */
const REF_STATE_STYLE: Record<string, string> = {
  active: "border-green/40 text-green",
  subscribed: "border-green/40 text-green",
  signup: "border-gold/40 text-gold",
  pending: "border-gold/40 text-gold",
  cancelled: "border-hair text-dim",
  moved: "border-hair text-dim",
  refunded: "border-error/40 text-error",
  denied: "border-error/40 text-error",
};

function ReferralsView() {
  const { data, err } = useFpData<ReferralsPayload>("/api/partners/referrals");
  const rows = data?.referrals ?? [];
  return (
    <div className="w-full">
      <h1 className="font-display text-h3 text-ink">Referrals</h1>
      <p className="mt-0.5 max-w-[var(--measure-body)] text-body-sm text-muted">
        Everyone who came through your links. Emails are shortened for their privacy.
      </p>
      <FpStateCard data={data} err={err} />
      {data?.configured && data.found ? (
        rows.length === 0 ? (
          <div className="mt-8 rounded-[12px] border border-hair bg-surface px-6 py-10 text-center">
            <p className="font-display text-h4 text-ink">No referrals yet.</p>
            <p className="mx-auto mt-2 max-w-md text-body text-muted">
              Share your link or your partner page and the first ones will show up here.
            </p>
          </div>
        ) : (
          <ul className="mt-8 overflow-hidden rounded-[12px] border border-hair">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 border-t border-hair bg-canvas px-5 py-3.5 first:border-t-0"
              >
                <div className="min-w-0">
                  <p className="font-mono text-body-sm text-ink">{r.who}</p>
                  <p className="mt-0.5 font-mono text-label uppercase text-dim">
                    joined {fpDay(r.createdAt)}
                    {r.customerSince ? ` / customer since ${fpDay(r.customerSince)}` : ""}
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${
                    REF_STATE_STYLE[r.state] ?? "border-hair text-dim"
                  }`}
                >
                  {r.state}
                </span>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

/* ---- earnings + payouts ---- */
const PAYOUT_STYLE: Record<string, string> = {
  completed: "border-green/40 text-green",
  processing: "border-gold/40 text-gold",
  pending: "border-gold/40 text-gold",
  failed: "border-error/40 text-error",
  cancelled: "border-hair text-dim",
};

function EarningsView() {
  const { data, err } = useFpData<PayoutsPayload>("/api/partners/payouts");
  const rows = data?.payouts ?? [];
  return (
    <div className="w-full">
      <h1 className="font-display text-h3 text-ink">Earnings &amp; Payouts</h1>
      <p className="mt-0.5 max-w-[var(--measure-body)] text-body-sm text-muted">
        What you have earned and what has been paid. Payouts run on the program
        schedule; this page always shows where things stand.
      </p>
      <FpStateCard data={data} err={err} />
      {data?.configured && data.found ? (
        <>
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-[12px] border border-gold/40 bg-gold/[0.06] p-5">
              <p className="font-mono text-label uppercase text-muted">Current balance</p>
              <p className="mt-1.5 font-display text-h3 font-semibold text-gold">
                {fpMoney(data.balanceCents ?? 0)}
              </p>
            </div>
            <div className="rounded-[12px] border border-hair bg-surface p-5">
              <p className="font-mono text-label uppercase text-muted">Paid out, lifetime</p>
              <p className="mt-1.5 font-display text-h3 font-semibold text-ink">
                {fpMoney(data.lifetimePaidCents ?? 0)}
              </p>
            </div>
            <div className="rounded-[12px] border border-hair bg-surface p-5">
              <p className="font-mono text-label uppercase text-muted">Revenue you drove</p>
              <p className="mt-1.5 font-display text-h3 font-semibold text-ink">
                {fpMoney(data.revenueCents ?? 0)}
              </p>
            </div>
          </div>

          <h2 className="mt-10 font-display text-h4 text-ink">Payout history</h2>
          {rows.length === 0 ? (
            <p className="mt-3 text-body text-muted">
              No payouts yet. Your first one lands here once your balance is due.
            </p>
          ) : (
            <ul className="mt-4 overflow-hidden rounded-[12px] border border-hair">
              {rows.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-t border-hair bg-canvas px-5 py-3.5 first:border-t-0"
                >
                  <div className="min-w-0">
                    <p className="text-body font-semibold text-ink">{fpMoney(p.amountCents)}</p>
                    <p className="mt-0.5 font-mono text-label uppercase text-dim">
                      {p.periodStart && p.periodEnd
                        ? `${fpDay(p.periodStart)} to ${fpDay(p.periodEnd)}`
                        : `created ${fpDay(p.createdAt)}`}
                      {p.paidAt ? ` / paid ${fpDay(p.paidAt)}` : ""}
                      {p.method && p.method !== "not_set" ? ` / ${p.method}` : ""}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${
                      PAYOUT_STYLE[p.status] ?? "border-hair text-dim"
                    }`}
                  >
                    {p.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}

/* ---- links + assets ---- */
const KIND_LABEL: Record<Asset["kind"], string> = {
  banner: "Banner",
  graphic: "Graphic",
  logo: "Logo",
  video: "Video",
  copy: "Swipe copy",
  doc: "Document",
};

function AssetsView({ me }: { me: Me }) {
  const { copied, copy } = useCopy();
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    authedFetch<{ assets?: Asset[]; error?: string }>("/api/partners/assets")
      .then((j) => (j.assets ? setAssets(j.assets) : setErr(j.error ?? "Could not load assets.")))
      .catch(() => setErr("Could not load assets."));
  }, []);

  const files = (assets ?? []).filter((a) => a.kind !== "copy");
  const copyAssets = (assets ?? []).filter((a) => a.kind === "copy");

  return (
    <div className="w-full">
      <h1 className="font-display text-h3 text-ink">Links &amp; Assets</h1>
      <p className="mt-0.5 max-w-[var(--measure-body)] text-body-sm text-muted">
        Every link below carries your referral, so your discount and your credit apply
        automatically. Assets are yours to use anywhere you promote.
      </p>

      {/* tracked links */}
      <div className="mt-8 rounded-[12px] border border-hair bg-surface">
        <p className="border-b border-hair px-5 py-3 font-mono text-label uppercase text-muted">
          Tracked links
        </p>
        <ul>
          {(me.pages ?? []).map((pg) => (
            <li
              key={pg.url}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-hair px-5 py-3.5 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="text-body font-semibold text-ink">
                  {pg.title}
                  <span className="ml-2 font-mono text-label uppercase text-gold">
                    your page
                  </span>
                </p>
                <p className="mt-0.5 break-all font-mono text-body-sm text-muted">{pg.url}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" onClick={() => copy(pg.url, pg.url)}>
                  {copied === pg.url ? "Copied" : "Copy"}
                </Button>
                <Button href={pg.url} target="_blank" rel="noopener">
                  Open
                </Button>
              </div>
            </li>
          ))}
          {(me.links ?? []).map((l) => (
            <li
              key={l.url}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-hair px-5 py-3.5 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="text-body font-semibold text-ink">{l.label}</p>
                <p className="mt-0.5 break-all font-mono text-body-sm text-muted">{l.url}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" onClick={() => copy(l.url, l.url)}>
                  {copied === l.url ? "Copied" : "Copy"}
                </Button>
                <Button href={l.url} target="_blank" rel="noopener">
                  Open
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* swipe copy */}
      <h2 className="mt-10 font-display text-h4 text-ink">Ready-to-send copy</h2>
      {err && <p className="mt-3 text-body-sm text-error">{err}</p>}
      {assets === null && !err && (
        <p className="mt-3 text-body text-muted">Loading your assets...</p>
      )}
      {assets !== null && copyAssets.length === 0 && (
        <p className="mt-3 text-body text-muted">
          No swipe copy yet. New material lands here as we add it.
        </p>
      )}
      <div className="mt-4 grid gap-4">
        {copyAssets.map((a) => (
          <div key={a.id} className="rounded-[12px] border border-hair bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-body font-semibold text-ink">
                  {a.title}
                  {a.yours && (
                    <span className="ml-2 font-mono text-label uppercase text-gold">
                      just for you
                    </span>
                  )}
                </p>
                {a.description && (
                  <p className="mt-0.5 text-body-sm text-muted">{a.description}</p>
                )}
              </div>
              <Button
                variant="secondary"
                onClick={() => copy(a.id, a.body ?? "")}
              >
                {copied === a.id ? "Copied" : "Copy text"}
              </Button>
            </div>
            <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-[8px] border border-hair bg-canvas p-4 font-mono text-body-sm leading-relaxed text-muted">
              {a.body}
            </pre>
          </div>
        ))}
      </div>

      {/* files */}
      <h2 className="mt-10 font-display text-h4 text-ink">Banners &amp; files</h2>
      {assets !== null && files.length === 0 && (
        <p className="mt-3 text-body text-muted">
          No files yet. Banners and graphics land here as we add them.
        </p>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {files.map((a) => (
          <div key={a.id} className="rounded-[12px] border border-hair bg-surface p-5">
            <p className="font-mono text-label uppercase text-muted">{KIND_LABEL[a.kind]}</p>
            <p className="mt-1 text-body font-semibold text-ink">
              {a.title}
              {a.yours && (
                <span className="ml-2 font-mono text-label uppercase text-gold">
                  just for you
                </span>
              )}
            </p>
            {a.description && <p className="mt-1 text-body-sm text-muted">{a.description}</p>}
            {a.fileUrl && (
              <div className="mt-4 flex gap-2">
                <Button href={a.fileUrl} target="_blank" rel="noopener">
                  Open
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => copy(a.id, a.fileUrl ?? "")}
                >
                  {copied === a.id ? "Copied" : "Copy URL"}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- resources ---- */
function ResourcesView({ me }: { me: Me }) {
  const p = me.partner!;
  const steps = [
    ...(me.pages && me.pages.length > 0
      ? [
          {
            title: "Share your partner page",
            line: "It carries your face, your offer, and your discount. It is the strongest first touch.",
          },
        ]
      : []),
    {
      title: "Use tracked links everywhere",
      line: "Every link in Links & Assets carries your referral, so every sale credits you on its own.",
    },
    ...(p.couponCode
      ? [
          {
            title: "Share your code with every recommendation",
            line: `${p.couponCode} is how your audience gets their discount at checkout. On your partner page, the buy buttons apply it for them.`,
          },
        ]
      : []),
    {
      title: "Send warm intros to hi@ghlvideo.com",
      line: "For bigger fish, a direct intro works better than a link. We will take great care of them, on your credit.",
    },
  ];
  const faqs = [
    {
      q: p.couponCode ? "What does my audience get?" : "How do my referrals buy?",
      a: p.couponCode
        ? `${p.discountPercent}% off every GHL Video service. On editing plans it runs for the first ${p.discountMonths} months; on one-time orders it applies to the purchase.`
        : "They buy at standard pricing through your link; the sale credits you automatically. Your commission comes from us, not from a discount.",
    },
    {
      q: "How do I get credited?",
      a: "Your links carry your referral tag. Sales are tracked through FirstPromoter, and your commission accrues there automatically.",
    },
    {
      q: "How and when do I get paid?",
      a: "Payouts run on the program schedule through our tracking system. Your balance, history, and payout status are on your Earnings & Payouts page, always current.",
    },
    {
      q: "Can I get custom material?",
      a: "Yes. If you need a banner in your brand, a co-branded page tweak, or copy in your voice, email hi@ghlvideo.com and we will make it.",
    },
  ];

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-h3 text-ink">Resources</h1>
      <p className="mt-0.5 max-w-[var(--measure-body)] text-body-sm text-muted">
        How the program works and how to get the most out of it.
      </p>

      <h2 className="mt-8 font-display text-h4 text-ink">Getting started</h2>
      <ol className="mt-4 grid gap-3">
        {steps.map((st, i) => (
          <li key={st.title} className="flex gap-4 rounded-[12px] border border-hair bg-surface p-5">
            <span className="font-mono text-h4 font-semibold text-gold">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <p className="text-body font-semibold text-ink">{st.title}</p>
              <p className="mt-0.5 text-body-sm text-muted">{st.line}</p>
            </div>
          </li>
        ))}
      </ol>

      <h2 className="mt-10 font-display text-h4 text-ink">Your terms</h2>
      <div className="mt-4 rounded-[12px] border border-gold/30 bg-gold/[0.04] p-5">
        <p className="text-body font-semibold text-ink">{tierDef(p.tier).name}</p>
        <p className="mt-1 text-body-sm text-muted">
          {tierDef(p.tier).firstOrderPct}% on a referred client&apos;s first order,{" "}
          {tierDef(p.tier).followOnPct}% on every order after, for the life of the
          client. Tracking window: {tierDef(p.tier).cookieDays} days from click.
          {tierDef(p.tier).audienceDiscountPct
            ? ` Your audience gets ${tierDef(p.tier).audienceDiscountPct}% off.`
            : ""}
        </p>
      </div>
      <ul className="mt-3 grid gap-2">
        {PROGRAM_RULES.map((r) => (
          <li key={r.slice(0, 24)} className="flex gap-3 rounded-[12px] border border-hair bg-surface px-5 py-3.5">
            <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-green" />
            <span className="text-body-sm text-muted">{r}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-body-sm text-dim">
        The full terms live at{" "}
        <a href="/legal/partner-terms/" target="_blank" rel="noopener" className="text-gold hover:brightness-110">
          ghlvideo.com/legal/partner-terms
        </a>
        .
      </p>

      <h2 className="mt-10 font-display text-h4 text-ink">Good to know</h2>
      <div className="mt-4 grid gap-3">
        {faqs.map((f) => (
          <div key={f.q} className="rounded-[12px] border border-hair bg-surface p-5">
            <p className="text-body font-semibold text-ink">{f.q}</p>
            <p className="mt-1 text-body-sm text-muted">{f.a}</p>
          </div>
        ))}
      </div>

      <p className="mt-8 text-body text-muted">
        Anything else, any time:{" "}
        <a href="mailto:hi@ghlvideo.com" className="text-gold hover:brightness-110">
          hi@ghlvideo.com
        </a>
        .
      </p>
    </div>
  );
}

/* ---- settings ---- */
function SettingsView({
  me,
  onSaved,
  canProfile,
  isOwner,
  selfEmail,
}: {
  me: Me;
  onSaved: () => void;
  canProfile: boolean;
  isOwner: boolean;
  selfEmail: string;
}) {
  const p = me.partner!;
  const [name, setName] = useState(p.name);
  const [tagline, setTagline] = useState(p.tagline ?? "");
  const [bio, setBio] = useState(p.bio ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setErr("");
    const j = await authedFetch<{ ok?: boolean; error?: string }>("/api/partners/me", {
      method: "PATCH",
      body: JSON.stringify({ name, tagline, bio }),
    });
    setBusy(false);
    if (j.ok) {
      setMsg("Saved.");
      onSaved();
    } else setErr(j.error ?? "Could not save. Try again.");
  }

  const viewerName = me.viewer?.name ?? p.name;
  const viewerAvatar = me.viewer?.avatarUrl ?? p.avatarUrl;
  const [tab, setTab] = useState<"profile" | "account" | "team">("profile");
  const tabs = [
    { key: "profile" as const, label: "Profile" },
    { key: "account" as const, label: "Account" },
    ...(isOwner ? [{ key: "team" as const, label: "Team" }] : []),
  ];

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-h3 text-ink">Settings</h1>
      <p className="mt-0.5 max-w-[var(--measure-body)] text-body-sm text-muted">
        {isOwner
          ? "Your profile, your account, and your team."
          : "Your profile and your account."}
      </p>

      {!isOwner && me.viewer?.actingFor ? (
        <div className="mt-6 rounded-[12px] border border-gold/30 bg-gold/[0.04] p-5">
          <p className="text-body-sm text-muted">
            You are working in{" "}
            <span className="font-semibold text-ink">{me.viewer.actingFor.name}</span>
            &apos;s partner account.
            {canProfile
              ? " The public details belong to them, and your access lets you edit them."
              : ""}
          </p>
        </div>
      ) : null}

      <div className="mt-6 inline-flex rounded-[8px] border border-hair bg-surface p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setMsg("");
              setErr("");
            }}
            className={`tap rounded-[6px] px-4 py-2 font-mono text-label uppercase transition-colors ${
              tab === t.key ? "bg-gold/15 font-bold text-gold" : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div key={tab} className="portal-view mt-6">
        {tab === "profile" ? (
          <div className="grid gap-6">
            <div className="rounded-[12px] border border-hair bg-surface p-6">
              <AvatarUploader
                name={viewerName}
                email={p.email ?? ""}
                avatarUrl={viewerAvatar}
                endpoint="/api/partners/me/avatar"
                onChanged={() => onSaved()}
              />
              <p className="mt-2 text-body-sm text-dim">
                Your portal photo. The photo on the public partner page is set by
                the studio; write to hi@ghlvideo.com to swap it.
              </p>
            </div>

            {canProfile ? (
              <form onSubmit={save} className="grid gap-5 rounded-[12px] border border-hair bg-surface p-6">
                <div>
                  <p className="font-mono text-label uppercase text-muted">Public details</p>
                  <p className="mt-1 text-body-sm text-dim">
                    These feed the partner page your audience sees.
                  </p>
                </div>
                <label className="grid gap-2">
                  <span className="font-mono text-label uppercase text-muted">Name</span>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required />
                </label>
                <label className="grid gap-2">
                  <span className="font-mono text-label uppercase text-muted">Tagline</span>
                  <Input
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="A friend of you is a friend of GHL Video."
                    maxLength={200}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="font-mono text-label uppercase text-muted">Short bio</span>
                  <Textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={4}
                    placeholder="Who you are and who you help."
                    maxLength={1200}
                  />
                </label>
                {msg && <p className="text-body-sm text-green">{msg}</p>}
                {err && <p className="text-body-sm text-error">{err}</p>}
                <div>
                  <Button variant="brand" type="submit" disabled={busy}>
                    {busy ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </form>
            ) : null}
          </div>
        ) : tab === "account" ? (
          <div className="grid gap-6">
            <div className="rounded-[12px] border border-hair bg-surface p-6">
              <p className="font-mono text-label uppercase text-muted">Sign-in email</p>
              <p className="mt-2 text-body text-ink">{selfEmail}</p>
              <p className="mt-1 text-body-sm text-muted">
                {isOwner
                  ? "To change it, write to hi@ghlvideo.com."
                  : "Your own login. To change it, ask the account owner to re-add you with the new one."}
              </p>
            </div>
            <PasswordCard resetRedirect="/partners/set-password/" />
          </div>
        ) : (
          <TeamCard endpoint="/api/partners/team/" accountType="partner" />
        )}
      </div>
    </div>
  );
}

/* ---- shell ---- */
export function PartnersClient({ initialView }: { initialView: View }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [view, setView] = useState<View>(initialView);

  /* clicking around pushes real URLs; back/forward walk the views */
  const go = (v: View) => {
    setView(v);
    if (window.location.pathname !== pathFor(v)) {
      window.history.pushState(null, "", pathFor(v));
    }
  };
  useEffect(() => {
    const onPop = () => {
      const seg = window.location.pathname.replace(/^\/partners\/?/, "").replace(/\/$/, "");
      setView(seg && (PARTNER_VIEWS as readonly string[]).includes(seg) ? (seg as View) : "dashboard");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadMe = async () => {
    initActFor(ACT_FOR_KEY);
    let j = await authedFetch<Me & { error?: string }>("/api/partners/me").catch(() => null);
    // a stale saved account (membership revoked): fall back to self
    if ((!j || j.error) && getActFor()) {
      setActFor(ACT_FOR_KEY, null);
      j = await authedFetch<Me & { error?: string }>("/api/partners/me").catch(() => null);
    }
    if (!j || j.error) {
      // a session the server no longer accepts: back to the login screen
      if (j?.error === "Unauthorized") {
        await supabase.auth.signOut();
        return;
      }
      setMe({ status: "none" });
      return;
    }
    // a team member's first sign-in: enter their only membership on its own
    if (
      j.status === "none" &&
      !hasChosenAccount(ACT_FOR_KEY) &&
      (j.memberships ?? []).length === 1
    ) {
      setActFor(ACT_FOR_KEY, j.memberships![0].ownerEmail);
      const acted = await authedFetch<Me & { error?: string }>("/api/partners/me").catch(() => null);
      if (acted && !acted.error) {
        setMe(acted);
        return;
      }
    }
    setMe(j);
  };

  useEffect(() => {
    if (!session) {
      setMe(null);
      return;
    }
    loadMe();
     
  }, [session]);

  if (!ready) return null;
  if (!session)
    return (
      <div className="flex min-h-screen flex-col">
        <Topbar />
        <LoginView />
      </div>
    );
  if (!me)
    return (
      <div className="flex min-h-screen flex-col">
        <Topbar />
        <section className="flex flex-1 items-center justify-center">
          <p className="text-body text-muted">Loading your portal...</p>
        </section>
      </div>
    );

  if (me.status === "none") {
    const memberships = me.memberships ?? [];
    if (memberships.length > 0) {
      /* on a team (or several): pick whose partner account to open */
      return (
        <div className="flex min-h-screen flex-col">
          <Topbar />
          <section className="relative flex-1 py-12 md:py-16">
            <div className="shell">
              <div className="mx-auto max-w-md">
                <p className="font-mono text-label uppercase text-gold">[ Partner portal ]</p>
                <h1 className="mt-4 font-display text-h2 text-ink">Pick an account.</h1>
                <p className="mt-3 text-body text-muted">
                  You are on {memberships.length === 1 ? "a partner team" : "several partner teams"}.
                  Choose whose portal to open.
                </p>
                <div className="mt-6 grid gap-2">
                  {memberships.map((m) => (
                    <button
                      key={m.ownerEmail}
                      type="button"
                      onClick={() => {
                        setActFor(ACT_FOR_KEY, m.ownerEmail);
                        window.location.reload();
                      }}
                      className="tap rounded-[12px] border border-hair bg-surface px-5 py-4 text-left transition-colors hover:border-gold/50"
                    >
                      <p className="text-body font-semibold text-ink">
                        {m.ownerName || m.ownerEmail}
                      </p>
                      <p className="mt-0.5 font-mono text-label text-dim">{m.ownerEmail}</p>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => supabase.auth.signOut()}
                  className="mt-6"
                >
                  Sign out
                </button>
              </div>
            </div>
          </section>
        </div>
      );
    }
    return (
      <div className="flex min-h-screen flex-col">
        <Topbar />
        <GateScreen
          heading="No partner account here yet."
          body={`${session.user.email} is signed in, but it is not on the partner program. If you are a customer, your area is at /portal. Want in on the program?`}
          showApply
        />
      </div>
    );
  }
  if (me.status === "applied")
    return (
      <div className="flex min-h-screen flex-col">
        <Topbar />
        <GateScreen
          heading="Application received."
          body="We are reviewing it now. You will hear from us by email, usually within a couple of days."
        />
      </div>
    );
  if (me.status === "paused")
    return (
      <div className="flex min-h-screen flex-col">
        <Topbar />
        <GateScreen
          heading="Your account is paused."
          body="Your links and assets are on hold. If you think this is a mistake, or you want to restart, write to us."
        />
      </div>
    );

  const viewer = me.viewer;
  const can = (key: string) => !viewer || viewer.isOwner || memberCan(viewer.features, key);
  const acting = viewer?.actingFor ?? null;

  const openHref = (href: string) => {
    const key = href.split("/")[0];
    if (["performance", "referrals", "earnings", "assets"].includes(key) && !can(key)) return;
    if ((PARTNER_VIEWS as readonly string[]).includes(key)) {
      go(key as View);
    }
  };

  const nav = [
    ...NAV.filter(
      (it) => ["dashboard", "resources", "book"].includes(it.key) || can(it.key),
    ),
    /* the white-label pitch is aimed at the partner themselves */
    ...(viewer?.isOwner !== false
      ? [{ key: "whitelabel", label: "White-label", icon: <Layers /> }]
      : []),
  ];

  const switchAccount = (ownerEmail: string | null) => {
    setActFor(ACT_FOR_KEY, ownerEmail);
    window.location.reload();
  };

  const memberships = viewer?.memberships ?? [];
  const switcher =
    memberships.length > 0 ? (
      <div>
        <p className="px-3 pb-1 pt-2 font-mono text-label font-bold uppercase tracking-[0.1em] text-dim">
          Switch account
        </p>
        <button
          type="button"
          onClick={() => switchAccount(null)}
          className={`tap flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-left text-body-sm transition-colors ${
            viewer?.isOwner ? "font-semibold text-gold" : "text-muted hover:bg-hair/40 hover:text-ink"
          }`}
        >
          Your account
          {viewer?.isOwner ? <span aria-hidden="true">&#10003;</span> : null}
        </button>
        {memberships.map((m) => (
          <button
            key={m.ownerEmail}
            type="button"
            onClick={() => switchAccount(m.ownerEmail)}
            className={`tap flex w-full items-center justify-between gap-2 rounded-[8px] px-3 py-2 text-left text-body-sm transition-colors ${
              acting?.email === m.ownerEmail
                ? "font-semibold text-gold"
                : "text-muted hover:bg-hair/40 hover:text-ink"
            }`}
          >
            <span className="min-w-0 truncate">{m.ownerName || m.ownerEmail}</span>
            {acting?.email === m.ownerEmail ? <span aria-hidden="true">&#10003;</span> : null}
          </button>
        ))}
      </div>
    ) : undefined;

  return (
    <div className="flex min-h-screen flex-col">
      <PortalTopbar
        area="Partners"
        right={
          <>
            <TopIconButton label="Program guide" onClick={() => go("resources")}>
              <LifeBuoy size={16} />
            </TopIconButton>
            <NotificationsBell
              endpoint="/api/partners/notifications"
              fetcher={(path, init) => authedFetch(path, init)}
              onOpenHref={openHref}
            />
            <ProfileMenu
              name={viewer?.name ?? me.partner?.name}
              email={session.user.email ?? ""}
              avatarUrl={viewer?.avatarUrl ?? me.partner?.avatarUrl}
              onSettings={() => go("settings")}
              onHelp={() => go("resources")}
              onSignOut={() => supabase.auth.signOut()}
              extra={switcher}
            />
          </>
        }
      />
      <div className="flex flex-1 flex-col md:flex-row">
        <PortalSidebar
          groups={[{ title: "", items: nav }]}
          active={view}
          onSelect={(k) => go(k as View)}
          storageKey="ghlv-partners-nav"
          bottom={[{ key: "settings", label: "Settings", icon: <Settings /> }]}
        />
        <section className="min-w-0 flex-1 p-4 md:p-8">
          <div key={view} className="portal-view">
          {view === "dashboard" ? (
            <DashboardView me={me} can={can} actingLabel={acting?.name ?? null} onNavigate={go} />
          ) : view === "performance" && can("performance") ? (
            <PerformanceView />
          ) : view === "referrals" && can("referrals") ? (
            <ReferralsView />
          ) : view === "earnings" && can("earnings") ? (
            <EarningsView />
          ) : view === "assets" && can("assets") ? (
            <AssetsView me={me} />
          ) : view === "resources" ? (
            <ResourcesView me={me} />
          ) : view === "book" ? (
            <BookACallView />
          ) : view === "whitelabel" && viewer?.isOwner !== false ? (
            <WhiteLabelView />
          ) : view === "settings" ? (
            <SettingsView
              me={me}
              onSaved={loadMe}
              canProfile={can("profile")}
              isOwner={viewer?.isOwner ?? true}
              selfEmail={session.user.email ?? ""}
            />
          ) : (
            <DashboardView me={me} can={can} actingLabel={acting?.name ?? null} onNavigate={go} />
          )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Topbar({ email, onSignOut }: { email?: string; onSignOut?: () => void }) {
  return (
    <PortalTopbar
      area="Partners"
      right={
        email && onSignOut ? (
          <>
            <span className="hidden max-w-[14rem] truncate font-mono text-label text-dim sm:inline">
              {email}
            </span>
            <Button variant="secondary" onClick={onSignOut}>
              Sign out
            </Button>
          </>
        ) : null
      }
    />
  );
}
