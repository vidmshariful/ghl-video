"use client";

import { useEffect, useRef, useState } from "react";
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
import { PortalHelp } from "@/components/portal/help";
import { TeamCard } from "@/components/portal/team";
import {
  AffiliateApplyView,
  BookACallView,
  SocialXView,
  WhiteLabelView,
} from "@/components/portal/booking";
import { PORTAL_SECTIONS, type PortalSection } from "./sections";
import { DashboardView } from "./DashboardView";
import { BrandKitView } from "./BrandKitView";
import { ComingSoonView } from "./ComingSoonView";
import { LibraryView } from "./LibraryView";
import { CustomView } from "./CustomView";
import { EditingView } from "./EditingView";
import { Button, Card, Chip, EmptyState, Table, Td, Th } from "@/components/portal/ui";
import {
  actForHeader,
  getActFor,
  hasChosenAccount,
  initActFor,
  setActFor,
} from "@/components/portal/act-for";
import { memberCan } from "@/lib/team-features";
import {
  LibraryBig,
  Palette,
  ArrowLeft,
  Clapperboard,
  Handshake,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  MessageSquare,
  PhoneCall,
  Repeat,
  Scissors,
  Settings,
  Sparkles,
  ShoppingCart,
} from "lucide-react";
import { MessagesView } from "./MessagesView";
import { MyVideosView } from "./MyVideosView";
import { STATUS_LABEL, type DeliverableStatus } from "@/lib/deliverable-status";
import { chatGet } from "@/components/chat/api";

/*
 * The customer portal at /portal. Magic-link login (passwordless), then the
 * customer's own orders with a delivery + status tracker, their producer, and
 * their invoice number. All data comes from /api/portal/* server routes,
 * which scope every read to the signed-in email. Invoices and Subscriptions
 * are placeholders for now.
 */
const STAGES = [
  { key: "paid", label: "Paid" },
  { key: "intake", label: "Intake" },
  { key: "production", label: "In production" },
  { key: "review", label: "Review" },
  { key: "delivered", label: "Delivered" },
] as const;

/* Payment states, mapped onto the shared chip tones rather than painted
 * here. One order should never wear two different greens depending on which
 * screen it is being looked at from. */
const PAYMENT_TONE: Record<string, "neutral" | "good" | "warn" | "bad" | "info"> = {
  paid: "good",
  pending: "warn",
  failed: "bad",
  refunded: "neutral",
};

const money = (cents: number, cur = "usd") =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: cur.toUpperCase(), minimumFractionDigits: 0 });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const ACT_FOR_KEY = "ghlv-portal-act-for";

async function authedFetch(path: string, init?: RequestInit) {
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

type MyProfile = {
  email: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  avatarUrl: string | null;
  isOwner: boolean;
  features: string[] | null;
  hiddenSections?: string[] | null;
  actingFor: { email: string; name: string | null } | null;
  memberships: { ownerEmail: string; ownerName: string | null; status: string }[];
};

type OrderSummary = {
  id: string;
  productName: string | null;
  productCode: string | null;
  amountCents: number;
  currency: string;
  status: string;
  stage: string;
  invoiceNumber: string | null;
  createdAt: string;
  intakeCompleted: boolean;
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative flex-1 py-12 md:py-16">
      <div className="shell">{children}</div>
    </section>
  );
}

/* ---- login ---- */
const LOGIN_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const authFieldCls =
  "w-full rounded-[8px] border border-hair bg-surface px-4 py-3.5 text-body text-ink placeholder:text-dim focus:border-gold focus:outline-none";

const LOGIN_HEADINGS = {
  signin: "Sign in to your portal.",
  reset: "Set or reset your password.",
  link: "Email me a sign-in link.",
} as const;
const LOGIN_INTROS = {
  signin: "Use the email from your order. New here? Set your password with the link below.",
  reset: "Enter your email and we will send a link to set your password.",
  link: "Enter your email and we will send a one-click sign-in link, no password needed.",
} as const;

function LoginView() {
  const [mode, setMode] = useState<"signin" | "reset" | "link">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const cleanEmail = () => email.trim().toLowerCase();
  const switchMode = (m: "signin" | "reset" | "link") => {
    setMode(m);
    setErr("");
    setNotice(null);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (mode !== "signin" && !LOGIN_EMAIL_RE.test(cleanEmail())) {
      setErr("Enter your email.");
      return;
    }
    setBusy(true);
    setErr("");
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail(), password });
      setBusy(false);
      if (error)
        setErr("That email and password did not match. New here or forgot it? Use the link below.");
      // success: onAuthStateChange swaps this view for the portal
    } else if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail(), {
        redirectTo: `${window.location.origin}/portal/set-password/`,
      });
      setBusy(false);
      if (error) setErr(error.message);
      else setNotice(`We sent a link to ${cleanEmail()}. Open it to set your password.`);
    } else {
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail(),
        options: { emailRedirectTo: `${window.location.origin}/portal/`, shouldCreateUser: true },
      });
      setBusy(false);
      if (error) setErr(error.message);
      else setNotice(`We sent a one-click sign-in link to ${cleanEmail()}.`);
    }
  }

  const submitLabel = busy
    ? "Sending..."
    : mode === "signin"
      ? "Sign in"
      : mode === "reset"
        ? "Send reset link"
        : "Send sign-in link";

  return (
    <Shell>
      <div className="mx-auto max-w-md">
        <p className="font-mono text-label uppercase text-gold">[ Your portal ]</p>
        <h1 className="mt-4 font-display text-h2 text-ink">{LOGIN_HEADINGS[mode]}</h1>

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
              <p className="text-body text-muted">{LOGIN_INTROS[mode]}</p>
              <label className="grid gap-2">
                <span className="font-mono text-label uppercase text-muted">Email</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={authFieldCls}
                />
              </label>
              {mode === "signin" && (
                <label className="grid gap-2">
                  <span className="font-mono text-label uppercase text-muted">Password</span>
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={authFieldCls}
                  />
                </label>
              )}
              {err && <p className="text-body-sm text-error">{err}</p>}
              <button
                type="submit"
                disabled={busy}
                className="tap mt-1 rounded-[8px] bg-brand-gradient px-8 py-3.5 text-body font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60"
              >
                {submitLabel}
              </button>
            </form>

            <div className="mt-6 grid gap-3 border-t border-hair pt-6">
              {mode !== "signin" && (
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className="tap text-left text-body-sm text-muted transition-colors hover:text-gold"
                >
                  Back to sign in with a password
                </button>
              )}
              {mode !== "reset" && (
                <button
                  type="button"
                  onClick={() => switchMode("reset")}
                  className="tap text-left text-body-sm text-muted transition-colors hover:text-gold"
                >
                  First time here, or forgot your password? Set it by email
                </button>
              )}
              {mode !== "link" && (
                <button
                  type="button"
                  onClick={() => switchMode("link")}
                  className="tap text-left text-body-sm text-muted transition-colors hover:text-gold"
                >
                  Prefer no password? Email me a one-click sign-in link
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}

/* ---- placeholder for not-yet-built sections ---- */

/* ---- order detail ---- */
type OrderDetail = {
  id: string;
  productName: string | null;
  productCode: string | null;
  amountCents: number;
  currency: string;
  status: string;
  stage: string;
  manager: string;
  deliveryUrl: string | null;
  invoiceNumber: string | null;
  intakeCompleted: boolean;
  createdAt: string;
};
/* same accents the My Videos tab uses, so one video never reads two ways */
const DELIVERABLE_TONE: Record<DeliverableStatus, string> = {
  queued: "border-hair text-dim",
  in_production: "border-gold/50 text-gold",
  ready: "border-blue/50 text-blue",
  revisions: "border-error/50 text-error",
  approved: "border-green/50 text-green",
};

type Update = { body: string; createdAt: string };
type OrderVideo = {
  id: string;
  title: string;
  code: string | null;
  groupLabel: string | null;
  status: DeliverableStatus;
  videoUrl: string | null;
};

function ProgressTracker({ stage }: { stage: string }) {
  const current = Math.max(0, STAGES.findIndex((s) => s.key === stage));
  return (
    <ol className="grid grid-cols-5 gap-2">
      {STAGES.map((s, i) => {
        const done = i <= current;
        return (
          <li key={s.key} className="grid gap-2 text-center">
            <span className={`h-1.5 rounded-full ${done ? "bg-gold" : "bg-hair"}`} />
            <span className={`font-mono text-label uppercase ${i === current ? "text-gold" : done ? "text-muted" : "text-dim"}`}>
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function OrderDetailView({
  id,
  onBack,
  onMessageStudio,
  canMessage = true,
}: {
  id: string;
  onBack: () => void;
  onMessageStudio: (orderId: string) => void;
  canMessage?: boolean;
}) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [videos, setVideos] = useState<OrderVideo[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    authedFetch(`/api/portal/orders/${id}`).then((j) => {
      if (j.order) {
        setOrder(j.order);
        setUpdates(j.updates ?? []);
        setVideos(j.videos ?? []);
      }
      setLoaded(true);
    });
  }, [id]);

  if (!loaded) return <p className="text-body text-muted">Loading...</p>;
  if (!order) return <p className="text-body text-muted">We could not find that order.</p>;

  return (
    <div className="grid gap-8">
      <div className="justify-self-start">
        <Button variant="ghost" size="sm" icon={<ArrowLeft />} onClick={onBack}>
          All orders
        </Button>
      </div>

      <div>
        {order.productCode && (
          <p className="font-mono text-label uppercase tracking-[0.12em] text-gold/80">
            {order.productCode}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-h3 text-ink">{order.productName ?? "Order"}</h2>
          <Chip tone={PAYMENT_TONE[order.status] ?? "neutral"}>{order.status}</Chip>
        </div>
        <p className="mt-1 font-mono text-label uppercase text-dim">
          {day(order.createdAt)} / {money(order.amountCents, order.currency)}
          {order.invoiceNumber ? ` / Invoice ${order.invoiceNumber}` : ""}
        </p>
      </div>

      {order.status !== "refunded" && (
        <div className="rounded-[12px] border border-hair bg-surface p-6 md:p-8">
          <p className="mb-5 font-mono text-label uppercase text-muted">Progress</p>
          <ProgressTracker stage={order.stage} />
        </div>
      )}

      {/* branding brief */}
      {order.status !== "refunded" && (
        <div className="rounded-[12px] border border-hair bg-surface p-6 md:p-8">
          <p className="font-mono text-label uppercase text-muted">Branding brief</p>
          {order.intakeCompleted ? (
            <>
              <p className="mt-3 text-body text-muted">
                <span className="text-gold">Submitted.</span> We are on it. You can
                update it anytime.
              </p>
              <a
                href={`/checkout/intake/${id}`}
                className="tap mt-5 inline-flex items-center gap-2 rounded-[8px] border border-hair px-6 py-3 font-mono text-label uppercase text-ink transition-colors hover:border-gold/60 hover:text-gold"
              >
                View or update brief
              </a>
            </>
          ) : (
            <>
              <p className="mt-3 text-body text-muted">
                One step to start production: your logo, colors, dashboard screens,
                and how your brand name is said.
              </p>
              <a
                href={`/checkout/intake/${id}`}
                className="tap mt-5 inline-flex items-center gap-2 rounded-[8px] bg-brand-gradient px-8 py-3.5 text-body font-semibold text-canvas transition-all hover:brightness-110"
              >
                Complete your branding brief
                <span aria-hidden="true">&rarr;</span>
              </a>
            </>
          )}
        </div>
      )}

      {/* delivery */}
      <div className="rounded-[12px] border border-hair bg-surface p-6 md:p-8">
        <p className="font-mono text-label uppercase text-muted">Delivery</p>
        {order.deliveryUrl ? (
          <>
            <p className="mt-3 text-body text-muted">Your videos are ready on PlayBook.</p>
            <a
              href={order.deliveryUrl}
              target="_blank"
              rel="noopener"
              className="tap mt-5 inline-flex items-center gap-2 rounded-[8px] bg-brand-gradient px-8 py-3.5 text-body font-semibold text-canvas transition-all hover:brightness-110"
            >
              Access your files
              <span aria-hidden="true">&rarr;</span>
            </a>
          </>
        ) : (
          <p className="mt-3 text-body text-muted">
            Your finished files will appear here the moment they are delivered.
          </p>
        )}
      </div>

      {/* producer */}
      <div className="rounded-[12px] border border-hair bg-surface p-6 md:p-8">
        <p className="font-mono text-label uppercase text-muted">Your producer</p>
        <div className="mt-4 flex items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-gradient font-display text-body font-bold text-canvas">
            {order.manager.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </span>
          <div>
            <p className="text-body font-semibold text-ink">{order.manager}</p>
            <p className="font-mono text-label uppercase text-dim">Executive Producer</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {canMessage ? (
            <button
              type="button"
              onClick={() => onMessageStudio(id)}
              className="tap inline-flex items-center gap-2 rounded-[8px] border border-chrome bg-chrome px-4 py-2 text-body-sm text-chrome-text transition-colors hover:bg-chrome-2"
            >
              Message the studio
            </button>
          ) : null}
          <a href="mailto:hi@ghlvideo.com" className="tap inline-flex items-center gap-2 rounded-[8px] border border-hair bg-surface px-4 py-2 text-body-sm text-ink transition-colors hover:border-gold/60 hover:text-gold">
            Email
          </a>
          <a href="https://wa.me/" target="_blank" rel="noopener" className="tap inline-flex items-center gap-2 rounded-[8px] border border-hair bg-surface px-4 py-2 text-body-sm text-ink transition-colors hover:border-gold/60 hover:text-gold">
            WhatsApp
          </a>
          <a href="/contact/" className="tap inline-flex items-center gap-2 rounded-[8px] border border-hair bg-surface px-4 py-2 text-body-sm text-ink transition-colors hover:border-gold/60 hover:text-gold">
            Book a call
          </a>
        </div>
      </div>

      {/* the videos this order owes, one line each. The full players live in
          My Videos; here it is the checklist view of the same truth. */}
      {videos.length > 0 && (
        <div className="rounded-[12px] border border-hair bg-surface p-6 md:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="font-mono text-label uppercase text-muted">
              {videos.length === 1 ? "Your video" : `Your videos (${videos.length})`}
            </p>
            <p className="font-mono text-label uppercase text-dim">
              {videos.filter((v) => v.status === "ready" || v.status === "approved").length} ready
            </p>
          </div>
          <ul className="mt-4 grid gap-2.5">
            {videos.map((v) => (
              <li
                key={v.id}
                className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5 border-b border-hair pb-2.5 last:border-0 last:pb-0"
              >
                <div className="min-w-[10rem] flex-1">
                  <p className="text-body-sm text-ink">{v.title}</p>
                  {(v.code || v.groupLabel) && (
                    <p className="mt-0.5 font-mono text-label uppercase tracking-[0.1em] text-dim">
                      {v.code ? v.code.toUpperCase() : ""}
                      {v.code && v.groupLabel ? " / " : ""}
                      {v.groupLabel ?? ""}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${DELIVERABLE_TONE[v.status]}`}
                >
                  {STATUS_LABEL[v.status]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* updates */}
      <div className="rounded-[12px] border border-hair bg-surface p-6 md:p-8">
        <p className="font-mono text-label uppercase text-muted">Updates</p>
        {updates.length === 0 ? (
          <p className="mt-3 text-body text-muted">No updates yet. Your producer will post progress here.</p>
        ) : (
          <ul className="mt-4 grid gap-4">
            {updates.map((u, i) => (
              <li key={i} className="border-l-2 border-gold/40 pl-4">
                <p className="text-body text-ink">{u.body}</p>
                <p className="mt-0.5 font-mono text-label uppercase text-dim">{day(u.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---- orders list ---- */
/*
 * Orders, as a list you can compare down rather than a stack of full width
 * buttons. Every row carries the same four facts in the same places, which
 * is the whole reason a table beats a pile of cards here: somebody scanning
 * for "which one is stuck" should not have to read each entry to find out.
 *
 * The state column deliberately says "waiting on your brief" rather than the
 * internal stage name. It is the one row state the client can act on, and
 * naming it in their words is what turns a list into something useful.
 */
type Invoice = {
  id: string;
  number: string | null;
  payUrl: string | null;
  lineItems: { label: string; amountCents: number }[];
  totalCents: number;
  currency: string;
  notes: string | null;
  dueDate: string | null;
  overdue: boolean;
  settled: boolean;
  voided: boolean;
  createdAt: string;
};

/*
 * What they still owe, above everything they have paid.
 *
 * An open invoice used to be visible to us and invisible to them, so the only
 * way a client learned they owed us something was an email they may or may
 * not still have had. It is the one thing on this screen that needs an
 * action, so it goes first and it carries the button.
 */
function OpenInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    authedFetch("/api/portal/invoices")
      .then((j) => setInvoices((j.invoices as Invoice[]) ?? []))
      .catch(() => setInvoices([]));
  }, []);

  const owing = invoices.filter((i) => !i.settled && !i.voided);
  if (owing.length === 0) return null;

  const total = owing.reduce((sum, i) => sum + i.totalCents, 0);

  return (
    <div className="mb-3">
      <Card
        tone="dark"
        title={owing.length === 1 ? "One invoice to pay" : `${owing.length} invoices to pay`}
      >
        <p className="text-body-sm text-chrome-muted">
          {money(total, owing[0].currency)} outstanding.
        </p>
        <ul className="mt-4 grid gap-3">
          {owing.map((i) => (
            <li
              key={i.id}
              className="flex flex-wrap items-start justify-between gap-3 border-t border-white/10 pt-3 first:border-t-0 first:pt-0"
            >
              <div className="min-w-0">
                <p className="text-body-sm font-semibold text-chrome-text">
                  {i.lineItems[0]?.label ?? "Invoice"}
                  {i.lineItems.length > 1 ? ` and ${i.lineItems.length - 1} more` : ""}
                </p>
                <p className="mt-0.5 font-mono text-label uppercase text-chrome-muted">
                  {i.number ?? "invoice"}
                  {i.dueDate ? ` / due ${day(i.dueDate)}` : ""}
                </p>
                {i.overdue && (
                  <p className="mt-1 text-body-sm text-error">This one is past its date.</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-mono text-price font-bold tabular-nums text-chrome-text">
                  {money(i.totalCents, i.currency)}
                </span>
                {i.payUrl && (
                  <Button variant="brand" size="sm" href={i.payUrl}>
                    Pay it
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function OrdersList({ onOpen }: { onOpen: (id: string) => void }) {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    authedFetch("/api/portal/orders")
      .then((j) => {
        if (j.error) setFailed(true);
        else setOrders(j.orders ?? []);
        setLoaded(true);
      })
      .catch(() => {
        setFailed(true);
        setLoaded(true);
      });
  }, []);

  if (!loaded) return <p className="text-body text-muted">Loading your orders...</p>;

  /* Failed and empty are different problems and get different words. One is
   * ours to fix, the other is simply a client who has not bought yet. */
  if (failed)
    return (
      <EmptyState
        title="We could not load your orders"
        description="Refresh the page, or sign in again if your session has expired. Nothing is lost."
      />
    );

  if (orders.length === 0)
    return (
      <EmptyState
        title="Nothing paid yet"
        description="Everything you buy shows up here, whether you ordered it from the library or paid an invoice for it, with its receipt and where it is up to."
      />
    );

  return (
    <Card padded={false}>
      <div className="px-5 py-5">
        <Table>
          <thead>
            <tr>
              <Th>What it was</Th>
              <Th>Where it is up to</Th>
              <Th>Invoice</Th>
              <Th align="right">Amount</Th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr
                key={o.id}
                onClick={() => onOpen(o.id)}
                className="tap cursor-pointer transition-colors hover:bg-hair/30"
              >
                <Td strong>
                  <span className="block">{o.productName ?? "Order"}</span>
                  <span className="mt-0.5 block font-mono text-label uppercase text-dim">
                    {o.productCode ? `${o.productCode} / ` : ""}
                    {day(o.createdAt)}
                  </span>
                </Td>
                <Td>
                  {o.status === "paid" && !o.intakeCompleted ? (
                    <Chip tone="warn">Waiting on your brief</Chip>
                  ) : o.status !== "paid" ? (
                    <Chip tone="neutral">{o.status}</Chip>
                  ) : o.stage === "delivered" ? (
                    <Chip tone="good">Delivered</Chip>
                  ) : (
                    <Chip tone="info">
                      {STAGES.find((s) => s.key === o.stage)?.label ?? o.stage}
                    </Chip>
                  )}
                </Td>
                <Td>{o.invoiceNumber ?? "-"}</Td>
                <Td align="right" strong>
                  {money(o.amountCents, o.currency)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </Card>
  );
}

/* ---- subscriptions ---- */
type Sub = {
  id: string;
  planName: string | null;
  status: string;
  amountCents: number;
  currency: string;
  interval: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

function SubscriptionsView({ canBilling = true }: { canBilling?: boolean }) {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    authedFetch("/api/portal/subscriptions").then((j) => {
      setSubs(j.subscriptions ?? []);
      setLoaded(true);
    });
  }, []);

  async function manage() {
    setBusy(true);
    setErr("");
    const { data } = await supabase.auth.getSession();
    const r = await fetch("/api/portal/billing-portal", {
      method: "POST",
      headers: data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {},
    });
    const j = await r.json();
    if (j.url) window.location.href = j.url;
    else {
      setErr(j.error ?? "Could not open billing.");
      setBusy(false);
    }
  }

  async function refresh() {
    const j = await authedFetch("/api/portal/subscriptions");
    setSubs(j.subscriptions ?? []);
  }

  async function setCancel(id: string, cancel: boolean) {
    setBusy(true);
    setErr("");
    const { data } = await supabase.auth.getSession();
    const r = await fetch(`/api/portal/subscriptions/${id}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
      },
      body: JSON.stringify({ cancelAtPeriodEnd: cancel }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setErr(j.error ?? "Could not update your plan.");
    else await refresh();
    setBusy(false);
  }

  if (!loaded) return <p className="text-body text-muted">Loading...</p>;
  if (subs.length === 0)
    return (
      <EmptyState
        title="No active plan"
        description="When you start a monthly editing plan it appears here, with everything you need to change or stop it."
      />
    );

  return (
    <div className="grid gap-4">
      {subs.map((s) => (
        <Card
          key={s.id}
          title={s.planName ?? "Your plan"}
          description={`${money(s.amountCents, s.currency)} a month${
            s.currentPeriodEnd
              ? `, ${s.cancelAtPeriodEnd ? "ends" : "renews"} ${day(s.currentPeriodEnd)}`
              : ""
          }`}
          actions={
            /* A plan set to stop says so plainly. "Active" on something the
               client already cancelled is the kind of half truth that turns
               into a billing complaint. */
            s.cancelAtPeriodEnd ? (
              <Chip tone="warn">
                {s.currentPeriodEnd ? `Ends ${day(s.currentPeriodEnd)}` : "Ending"}
              </Chip>
            ) : (
              <Chip tone={s.status === "active" ? "good" : "warn"}>{s.status}</Chip>
            )
          }
        >
          {!canBilling ? (
            <p className="mt-4 text-body-sm text-dim">
              Billing changes are limited on your access. The account owner
              manages the plan.
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            {canBilling && (s.status === "active" || s.status === "trialing") && !s.cancelAtPeriodEnd ? (
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Cancel this plan at the end of the current billing period? You keep access until then.",
                    )
                  )
                    setCancel(s.id, true);
                }}
              >
                Cancel plan
              </Button>
            ) : null}
            {canBilling && s.cancelAtPeriodEnd ? (
              <Button variant="primary" disabled={busy} onClick={() => setCancel(s.id, false)}>
                Resume plan
              </Button>
            ) : null}
            {canBilling ? (
              <Button variant="secondary" disabled={busy} onClick={manage}>
                {busy ? "Opening..." : "Manage billing"}
              </Button>
            ) : null}
          </div>
          {err && <p className="mt-3 text-body-sm text-error">{err}</p>}
        </Card>
      ))}
    </div>
  );
}

/* ---- settings: Profile / Account / Team tabs ---- */
type SettingsTab = "profile" | "account" | "team";

function SettingsView({
  profile,
  onSaved,
}: {
  profile: MyProfile;
  onSaved: () => void;
}) {
  const isOwner = profile.isOwner;
  const [tab, setTab] = useState<SettingsTab>("profile");
  const [name, setName] = useState(profile.name ?? "");
  const [company, setCompany] = useState(profile.company ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const tabs: { key: SettingsTab; label: string }[] = [
    { key: "profile", label: "Profile" },
    { key: "account", label: "Account" },
    ...(isOwner ? [{ key: "team" as SettingsTab, label: "Team" }] : []),
  ];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setErr("");
    // the parent holds all fields, so a save from either tab sends the
    // full set and never wipes the other tab's values
    const j = await authedFetch("/api/portal/me", {
      method: "PATCH",
      body: JSON.stringify(isOwner ? { name, company, phone } : { name }),
    });
    setBusy(false);
    if (j.ok) {
      setMsg("Saved.");
      onSaved();
    } else setErr(j.error ?? "Could not save. Try again.");
  }

  const saveBtn = (
    <div>
      <button
        type="submit"
        disabled={busy}
        className="tap rounded-[8px] bg-brand-gradient px-6 py-2.5 text-body font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60"
      >
        {busy ? "Saving" : "Save changes"}
      </button>
    </div>
  );
  const feedback = (
    <>
      {msg && <p className="text-body-sm text-green">{msg}</p>}
      {err && <p className="text-body-sm text-error">{err}</p>}
    </>
  );

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-h2 text-ink">Settings</h1>
      <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
        {isOwner
          ? "Your profile, your account, and your team."
          : "Your profile and your account."}
      </p>

      {!isOwner && profile.actingFor ? (
        <div className="mt-6 rounded-[12px] border border-gold/30 bg-gold/[0.04] p-5">
          <p className="text-body-sm text-muted">
            You are working in{" "}
            <span className="font-semibold text-ink">
              {profile.actingFor.name || profile.actingFor.email}
            </span>
            &apos;s portal. What you edit here is your own profile and login.
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
          <div className="rounded-[12px] border border-hair bg-surface p-6">
            <AvatarUploader
              name={profile.name}
              email={profile.email}
              avatarUrl={profile.avatarUrl}
              endpoint="/api/portal/me/avatar"
              onChanged={() => onSaved()}
            />
            <form onSubmit={save} className="mt-6 grid gap-4 border-t border-hair pt-6">
              <label className="grid gap-2">
                <span className="font-mono text-label uppercase text-muted">Your name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={120}
                  className={authFieldCls}
                />
              </label>
              <p className="text-body-sm text-dim">
                Shown on your messages to the studio and in your portal.
              </p>
              {feedback}
              {saveBtn}
            </form>
          </div>
        ) : tab === "account" ? (
          <div className="grid gap-6">
            <div className="rounded-[12px] border border-hair bg-surface p-6">
              <p className="font-mono text-label uppercase text-muted">Account details</p>
              <form onSubmit={save} className="mt-4 grid gap-4">
                {isOwner ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="font-mono text-label uppercase text-muted">
                        Company / SaaS
                      </span>
                      <input
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        maxLength={160}
                        className={authFieldCls}
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="font-mono text-label uppercase text-muted">Phone</span>
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        maxLength={40}
                        className={authFieldCls}
                      />
                    </label>
                  </div>
                ) : null}
                <div className="grid gap-2">
                  <span className="font-mono text-label uppercase text-muted">Sign-in email</span>
                  <p className="text-body text-ink">{profile.email}</p>
                  <p className="text-body-sm text-dim">
                    {isOwner
                      ? "Your orders and login hang on this email. To change it, write to hi@ghlvideo.com."
                      : "Your login. To change it, ask the account owner to re-add you with the new one."}
                  </p>
                </div>
                {feedback}
                {isOwner ? saveBtn : null}
              </form>
            </div>
            <PasswordCard resetRedirect="/portal/set-password/" />
          </div>
        ) : (
          <TeamCard endpoint="/api/portal/team/" accountType="customer" />
        )}
      </div>
    </div>
  );
}

/* ---- signed-in portal (app shell) ---- */
const pathFor = (s: PortalSection, sub?: string | null) =>
  s === "dashboard"
    ? "/portal/"
    : (s === "orders" || s === "library") && sub
      ? `/portal/${s}/${sub}/`
      : `/portal/${s}/`;

function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h1 className="font-display text-h2 text-ink">{title}</h1>
      {subtitle ? <p className="mt-2 text-body text-muted">{subtitle}</p> : null}
    </div>
  );
}



function Portal({
  session,
  initialView,
  initialOrderId,
  initialItemCode,
}: {
  session: Session;
  initialView: PortalSection;
  initialOrderId: string | null;
  initialItemCode: string | null;
}) {
  const [section, setSection] = useState<PortalSection>(initialView);
  const [openOrder, setOpenOrder] = useState<string | null>(initialOrderId);
  /* the library item open at /portal/library/<code>/, if any */
  const [openItem, setOpenItem] = useState<string | null>(initialItemCode);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  /* a video to open on arrival, set when somebody presses Watch it on the
   * dashboard. The three line screens each know how to honour it. */
  const [focusVideo, setFocusVideo] = useState<string | null>(null);
  const [msgUnread, setMsgUnread] = useState(0);
  const [brandIncomplete, setBrandIncomplete] = useState(false);
  const [profile, setProfile] = useState<MyProfile | null>(null);

  /* clicking around pushes real URLs; back/forward walk the sections */
  const pushUrl = (s: PortalSection, sub?: string | null) => {
    const path = pathFor(s, sub);
    if (window.location.pathname !== path) window.history.pushState(null, "", path);
  };
  useEffect(() => {
    const onPop = () => {
      const segs = window.location.pathname.replace(/^\/portal\/?/, "").split("/").filter(Boolean);
      const seg = segs[0] ?? "dashboard";
      const next = (PORTAL_SECTIONS as readonly string[]).includes(seg)
        ? (seg as PortalSection)
        : "dashboard";
      setSection(next);
      setOpenOrder(next === "orders" && segs[1] ? segs[1] : null);
      setOpenItem(next === "library" && segs[1] ? segs[1] : null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /* which account this person works in, and what they may use there */
  const can = (key: string) =>
    !profile || profile.isOwner || memberCan(profile.features, key);

  /*
   * Sections switched off for this account by us.
   *
   * Separate from `can`, which is the owner deciding what their teammates
   * reach. This is us deciding what the whole account sees, because a client
   * who only ever buys custom video should not be shown a premade library.
   * It gates the menu AND the section itself, so a hidden screen cannot be
   * reached by typing its URL.
   */
  const hiddenSections = new Set(profile?.hiddenSections ?? []);
  const shows = (key: string) => !hiddenSections.has(key);
  /* Typing the URL of a switched-off section lands on the dashboard. Gating
   * only the menu would hide the door and leave the room open. */
  const view: PortalSection = shows(section) ? section : "dashboard";

  // Who is signed in and which account they act for. Handles two edge
  // cases: a stale saved account (membership revoked -> fall back to self),
  // and a member's first sign-in (auto-enter their only membership).
  const loadProfile = async () => {
    initActFor(ACT_FOR_KEY);
    let j = await authedFetch("/api/portal/me").catch(() => null);
    if ((!j || j.error) && getActFor()) {
      setActFor(ACT_FOR_KEY, null);
      j = await authedFetch("/api/portal/me").catch(() => null);
    }
    if (j?.email) {
      const p = j as MyProfile;
      if (
        p.isOwner &&
        !hasChosenAccount(ACT_FOR_KEY) &&
        p.memberships.length === 1
      ) {
        setActFor(ACT_FOR_KEY, p.memberships[0].ownerEmail);
        const acted = await authedFetch("/api/portal/me").catch(() => null);
        if (acted?.email) {
          setProfile(acted as MyProfile);
          return;
        }
      }
      setProfile(p);
      return;
    }
    // a session the server no longer accepts (revoked or deleted account):
    // sign out locally so the login screen appears instead of a stuck loader
    await supabase.auth.signOut();
  };
  useEffect(() => {
    loadProfile();
     
  }, []);

  /* The Brand Kit nag. Read once, then re-read only on the way OUT of the
   * Brand screen, which is the only place it can change: saving there still
   * clears the dot immediately, without the old version's identical fetch on
   * every single navigation. */
  const prevSectionRef = useRef<PortalSection | null>(null);
  useEffect(() => {
    const first = prevSectionRef.current === null;
    const leftBrand = prevSectionRef.current === "brand" && section !== "brand";
    prevSectionRef.current = section;
    if (!profile || !can("orders") || (!first && !leftBrand)) return;
    authedFetch("/api/portal/brand-kit")
      .then((j) => {
        const c = (j as { completeness?: { ready?: boolean } }).completeness;
        setBrandIncomplete(c ? !c.ready : false);
      })
      .catch(() => setBrandIncomplete(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, section]);

  // Poll the unread count so the Messages badge stays live from any section.
  useEffect(() => {
    if (!profile || !can("messages")) return;
    let active = true;
    const tick = async () => {
      const j = await chatGet<{ unreadCount?: number }>("/api/portal/conversations");
      if (active) setMsgUnread(j.unreadCount ?? 0);
    };
    tick();
    const t = window.setInterval(tick, 20000);
    return () => {
      active = false;
      window.clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart when access changes
  }, [profile]);

  const go = (s: PortalSection) => {
    setSection(s);
    setOpenOrder(null);
    setOpenItem(null);
    setFocusVideo(null);
    pushUrl(s);
  };

  /*
   * Open one video, on whichever screen it lives.
   *
   * Every video knows its line, so the caller never has to. Before this, the
   * dashboard sent everybody to Pre-made whatever they had pressed, which for
   * a custom or editing video meant landing on a screen it was not on.
   */
  const LINE_SECTION: Record<string, PortalSection> = {
    premade: "videos",
    custom: "projects",
    editing: "subscriptions",
  };
  const openVideo = (line: string, videoId: string) => {
    const s = LINE_SECTION[line] ?? "videos";
    setSection(s);
    setOpenOrder(null);
    setOpenItem(null);
    setFocusVideo(videoId);
    pushUrl(s);
  };
  const openOrderById = (id: string) => {
    setSection("orders");
    setOpenOrder(id);
    pushUrl("orders", id);
  };
  const messageStudio = (orderId: string) => {
    setPendingOrderId(orderId);
    setSection("messages");
    pushUrl("messages");
  };

  const switchAccount = (ownerEmail: string | null) => {
    setActFor(ACT_FOR_KEY, ownerEmail);
    window.location.reload();
  };

  /* bell links: "orders", "orders/<id>", "messages", "subscriptions" */
  const openHref = (href: string) => {
    const [head, tail] = href.split("/");
    if (head === "orders" && tail && can("orders")) {
      openOrderById(tail);
      return;
    }
    if (["orders", "messages", "subscriptions"].includes(head) && !can(head)) return;
    if ((PORTAL_SECTIONS as readonly string[]).includes(head)) {
      go(head as PortalSection);
    }
  };

  const email = session.user.email ?? "";

  if (!profile) {
    return (
      <>
        <PortalTopbar area="Portal" />
        <Shell>
          <p className="text-body text-muted">Loading your portal...</p>
        </Shell>
      </>
    );
  }

  const acting = profile.actingFor;

  /*
   * The menu, grouped the way a client thinks rather than the way we built it.
   *
   * The flat list this replaces was in the order the screens happened to be
   * written, which put Orders second: our idea of the relationship, not
   * theirs. Somebody logging in wants their videos. Everything else is either
   * getting more of them, or admin.
   *
   * My Videos is a category rather than a screen, holding the three service
   * lines the way admin does, because one mixed list of premade, custom and
   * editing work answers "where is my video" by making you read all of it.
   * The same three words on both sides also means a call about a video is
   * about the same screen for both people on it.
   *
   * Messages sits with Dashboard. It is the only badged thing in here and the
   * only one where somebody is waiting on an answer; it used to be filed
   * under My account next to the Brand Kit, which is where you put a thing
   * you want ignored.
   *
   * Editing used to live under My account too, as though a service line were
   * account admin. It is work, so it is under My Videos with the other work,
   * and its billing moved to Orders and Invoices where the rest of the money
   * already was.
   */
  const groups = [
    {
      title: "",
      items: [
        { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard /> },
        ...(can("orders")
          ? [
              {
                key: "brand",
                label: "Brand Kit",
                icon: <Palette />,
                /* the portal's one nag, and it only appears when an order is
                   genuinely stuck for want of these */
                badge: brandIncomplete ? 1 : undefined,
              },
            ]
          : []),
        ...(can("messages")
          ? [
              {
                key: "messages",
                label: "Messages",
                icon: <MessageSquare />,
                badge: msgUnread || undefined,
              },
            ]
          : []),
      ],
    },
    {
      title: "My Videos",
      defaultOpen: true,
      items: [
        ...(can("orders")
          ? [
              { key: "videos", label: "Pre-made", icon: <Clapperboard /> },
              { key: "projects", label: "Custom", icon: <Sparkles /> },
            ]
          : []),
        ...(can("subscriptions")
          ? [{ key: "subscriptions", label: "Editing", icon: <Scissors /> }]
          : []),
      ],
    },
    {
      title: "Get more videos",
      defaultOpen: true,
      items: [
        ...(can("orders")
          ? [{ key: "library", label: "Video Library", icon: <LibraryBig /> }]
          : []),
        { key: "coming-soon", label: "Coming Soon", icon: <Sparkles /> },
        /* the existing route to a custom video, until the quote thread lands */
        { key: "book", label: "Book a Call", icon: <PhoneCall /> },
      ],
    },
    {
      /*
       * Everything they pay, in two items rather than three.
       *
       * Orders and Invoices are one screen because they are the same money
       * seen from two sides: paying an invoice creates an order, so listing
       * both separately shows a client the same $450 twice and invites them
       * to wonder whether they were charged for it twice. What they still owe
       * sits at the top of it, because that is the only part that needs
       * them to do something.
       *
       * Subscriptions is separate because it is the opposite kind of money:
       * nothing to do, until the once a year when there is.
       */
      title: "Billings",
      defaultOpen: true,
      items: [
        ...(can("orders")
          ? [{ key: "orders", label: "Orders and Invoices", icon: <ShoppingCart /> }]
          : []),
        ...(can("subscriptions")
          ? [{ key: "billing", label: "Subscriptions", icon: <Repeat /> }]
          : []),
      ],
    },
    /* these are offers aimed at the account owner, not at their team */
    ...(profile.isOwner
      ? [
          {
            title: "More from us",
            defaultOpen: true,
            items: [
              { key: "affiliate", label: "Affiliate program", icon: <Handshake /> },
              { key: "whitelabel", label: "White-label", icon: <Layers /> },
              { key: "socialx", label: "SocialX", icon: <Megaphone /> },
            ],
          },
        ]
      : []),
    /* a teammate with narrow access can empty a whole group, and a heading
     * over nothing looks like something failed to load */
  ]
    .map((g) => ({ ...g, items: g.items.filter((i) => shows(i.key)) }))
    .filter((g) => g.items.length > 0);

  /* the account switcher inside the profile menu, shown to anyone on a team */
  const switcher =
    profile.memberships.length > 0 ? (
      <div>
        <p className="px-3 pb-1 pt-2 font-mono text-label font-bold uppercase tracking-[0.1em] text-dim">
          Switch account
        </p>
        <button
          type="button"
          onClick={() => switchAccount(null)}
          className={`tap flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-left text-body-sm transition-colors ${
            profile.isOwner ? "font-semibold text-gold" : "text-muted hover:bg-hair/40 hover:text-ink"
          }`}
        >
          Your account
          {profile.isOwner ? <span aria-hidden="true">&#10003;</span> : null}
        </button>
        {profile.memberships.map((m) => (
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
    <>
      <PortalTopbar
        area="Portal"
        right={
          <>
            {can("messages") ? (
              <TopIconButton label="Messages" badge={msgUnread} onClick={() => go("messages")}>
                <MessageSquare size={16} />
              </TopIconButton>
            ) : null}
            <TopIconButton label="Help & guide" mobileHidden onClick={() => go("help")}>
              <LifeBuoy size={16} />
            </TopIconButton>
            <NotificationsBell
              endpoint="/api/portal/notifications"
              fetcher={authedFetch}
              onOpenHref={openHref}
            />
            <ProfileMenu
              name={profile.name}
              email={email}
              avatarUrl={profile.avatarUrl}
              onSettings={() => go("settings")}
              onHelp={() => go("help")}
              onSignOut={() => supabase.auth.signOut()}
              extra={switcher}
            />
          </>
        }
      />
      <div className="flex flex-1 flex-col md:flex-row">
        <PortalSidebar
          groups={groups}
          active={section}
          onSelect={(k) => go(k as PortalSection)}
          storageKey="ghlv-portal-nav"
          bottom={[{ key: "settings", label: "Settings", icon: <Settings /> }]}
        />

        <section className="min-w-0 flex-1 p-4 md:p-8">
          <div key={section + (openOrder ?? "") + (focusVideo ?? "")} className="portal-view">
          {view === "dashboard" ? (
            <DashboardView
              firstName={profile.name?.split(" ")[0] ?? null}
              subtitle={
                acting
                  ? `Working in ${acting.name || acting.email}'s portal`
                  : (session.user.email ?? "")
              }
              can={can}
              authedFetch={authedFetch}
              onOpenOrder={openOrderById}
              onOpenVideo={openVideo}
              onGo={(s) => go(s as PortalSection)}
            />
          ) : view === "orders" && can("orders") ? (
            openOrder ? (
              <OrderDetailView
                id={openOrder}
                onBack={() => {
                  setOpenOrder(null);
                  pushUrl("orders");
                }}
                onMessageStudio={messageStudio}
                canMessage={can("messages")}
              />
            ) : (
              <div>
                <PageHeader
                  title="Orders and Invoices"
                  subtitle="Everything you have paid for, and anything still to pay."
                />
                <div className="mt-6">
                  {/* what needs them first, then the record */}
                  <OpenInvoices />
                  <OrdersList onOpen={openOrderById} />
                </div>
              </div>
            )
          ) : view === "videos" && can("orders") ? (
            <div>
              <PageHeader
                title="Pre-made"
                subtitle="Videos you ordered from the library, and where each one is."
              />
              <div className="mt-6">
                <MyVideosView
                  authedFetch={authedFetch}
                  focusVideoId={focusVideo}
                  onFocused={() => setFocusVideo(null)}
                  onMessageStudio={can("messages") ? () => go("messages") : undefined}
                />
              </div>
            </div>
          ) : view === "library" && can("orders") ? (
            <LibraryView
              authedFetch={authedFetch}
              openCode={openItem}
              onOpenItem={(code) => {
                setOpenItem(code);
                pushUrl("library", code);
                window.scrollTo({ top: 0 });
              }}
            />
          ) : view === "coming-soon" ? (
            <ComingSoonView authedFetch={authedFetch} />
          ) : view === "brand" && can("orders") ? (
            <BrandKitView authedFetch={authedFetch} canEdit={can("orders")} />
          ) : view === "messages" && can("messages") ? (
            <MessagesView
              pendingOrderId={pendingOrderId}
              onConsumePending={() => setPendingOrderId(null)}
              onUnread={setMsgUnread}
            />
          ) : view === "book" ? (
            <BookACallView />
          ) : view === "affiliate" && profile.isOwner ? (
            <AffiliateApplyView
              prefillName={profile.name ?? ""}
              prefillEmail={profile.email}
            />
          ) : view === "whitelabel" && profile.isOwner ? (
            <WhiteLabelView />
          ) : view === "socialx" && profile.isOwner ? (
            <SocialXView authedFetch={authedFetch} />
          ) : view === "settings" ? (
            <SettingsView profile={profile} onSaved={loadProfile} />
          ) : view === "help" ? (
            <PortalHelp />
          ) : view === "subscriptions" && can("subscriptions") ? (
            /* Only the work. Billing moved to Orders and Invoices where the
               rest of the money already was (owner decision). */
            <EditingView
              authedFetch={authedFetch}
              focusVideoId={focusVideo}
              onFocused={() => setFocusVideo(null)}
              onMessageStudio={can("messages") ? () => go("messages") : undefined}
            />
          ) : view === "billing" && can("subscriptions") ? (
            <div>
              <PageHeader
                title="Subscriptions"
                subtitle="Your recurring plans, what they cost, and when they renew."
              />
              <div className="mt-6">
                <SubscriptionsView canBilling={can("billing")} />
              </div>
            </div>
          ) : view === "projects" && can("orders") ? (
            <CustomView
              authedFetch={authedFetch}
              focusVideoId={focusVideo}
              onFocused={() => setFocusVideo(null)}
              onMessageStudio={can("messages") ? () => go("messages") : undefined}
            />
          ) : (
            <DashboardView
              firstName={profile.name?.split(" ")[0] ?? null}
              subtitle={
                acting
                  ? `Working in ${acting.name || acting.email}'s portal`
                  : (session.user.email ?? "")
              }
              can={can}
              authedFetch={authedFetch}
              onOpenOrder={openOrderById}
              onOpenVideo={openVideo}
              onGo={(s) => go(s as PortalSection)}
            />
          )}
          </div>
        </section>
      </div>
    </>
  );
}

export function PortalClient({
  initialView,
  initialOrderId,
  initialItemCode,
}: {
  initialView: PortalSection;
  initialOrderId: string | null;
  initialItemCode: string | null;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      {!ready ? (
        <>
          <PortalTopbar area="Portal" />
          <Shell>
            <p className="text-body text-muted">Loading...</p>
          </Shell>
        </>
      ) : session ? (
        <Portal
          session={session}
          initialView={initialView}
          initialOrderId={initialOrderId}
          initialItemCode={initialItemCode}
        />
      ) : (
        <>
          <PortalTopbar area="Portal" />
          <LoginView />
        </>
      )}
    </div>
  );
}
