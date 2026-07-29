"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";
import { MessagesView } from "./MessagesView";
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

const STATUS_STYLE: Record<string, string> = {
  paid: "border-green/40 text-green",
  pending: "border-gold/40 text-gold",
  failed: "border-error/40 text-error",
  refunded: "border-hair text-dim",
};

const money = (cents: number, cur = "usd") =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: cur.toUpperCase(), minimumFractionDigits: 0 });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

async function authedFetch(path: string) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const r = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" });
  return r.json();
}

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
  "w-full rounded-[3px] border border-hair bg-surface px-4 py-3.5 text-body text-ink placeholder:text-dim focus:border-gold focus:outline-none";

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
          <div className="mt-8 rounded-card border border-gold/40 bg-gold/[0.06] px-6 py-8">
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
                className="tap mt-1 rounded-[3px] bg-brand-gradient px-8 py-3.5 text-body font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60"
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
function ComingSoon({ title, line }: { title: string; line: string }) {
  return (
    <div className="rounded-card border border-hair bg-surface px-6 py-12 text-center">
      <p className="font-mono text-label uppercase text-gold">[ Coming soon ]</p>
      <p className="mt-4 font-display text-h3 text-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-body text-muted">{line}</p>
    </div>
  );
}

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
type Update = { body: string; createdAt: string };

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
}: {
  id: string;
  onBack: () => void;
  onMessageStudio: (orderId: string) => void;
}) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    authedFetch(`/api/portal/orders/${id}`).then((j) => {
      if (j.order) {
        setOrder(j.order);
        setUpdates(j.updates ?? []);
      }
      setLoaded(true);
    });
  }, [id]);

  if (!loaded) return <p className="text-body text-muted">Loading...</p>;
  if (!order) return <p className="text-body text-muted">We could not find that order.</p>;

  return (
    <div className="grid gap-8">
      <button type="button" onClick={onBack} className="justify-self-start font-mono text-label uppercase text-muted transition-colors hover:text-gold">
        &larr; All orders
      </button>

      <div>
        {order.productCode && (
          <p className="font-mono text-label uppercase tracking-[0.12em] text-gold/80">
            {order.productCode}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-h3 text-ink">{order.productName ?? "Order"}</h2>
          <span className={`rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${STATUS_STYLE[order.status]}`}>
            {order.status}
          </span>
        </div>
        <p className="mt-1 font-mono text-label uppercase text-dim">
          {day(order.createdAt)} / {money(order.amountCents, order.currency)}
          {order.invoiceNumber ? ` / Invoice ${order.invoiceNumber}` : ""}
        </p>
      </div>

      {order.status !== "refunded" && (
        <div className="rounded-card border border-hair bg-surface p-6 md:p-8">
          <p className="mb-5 font-mono text-label uppercase text-muted">Progress</p>
          <ProgressTracker stage={order.stage} />
        </div>
      )}

      {/* branding brief */}
      {order.status !== "refunded" && (
        <div className="rounded-card border border-hair bg-surface p-6 md:p-8">
          <p className="font-mono text-label uppercase text-muted">Branding brief</p>
          {order.intakeCompleted ? (
            <>
              <p className="mt-3 text-body text-muted">
                <span className="text-gold">Submitted.</span> We are on it. You can
                update it anytime.
              </p>
              <a
                href={`/checkout/intake/${id}`}
                className="tap mt-5 inline-flex items-center gap-2 rounded-[3px] border border-hair px-6 py-3 font-mono text-label uppercase text-ink transition-colors hover:border-gold/60 hover:text-gold"
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
                className="tap mt-5 inline-flex items-center gap-2 rounded-[3px] bg-brand-gradient px-8 py-3.5 text-body font-semibold text-canvas transition-all hover:brightness-110"
              >
                Complete your branding brief
                <span aria-hidden="true">&rarr;</span>
              </a>
            </>
          )}
        </div>
      )}

      {/* delivery */}
      <div className="rounded-card border border-hair bg-surface p-6 md:p-8">
        <p className="font-mono text-label uppercase text-muted">Delivery</p>
        {order.deliveryUrl ? (
          <>
            <p className="mt-3 text-body text-muted">Your videos are ready on PlayBook.</p>
            <a
              href={order.deliveryUrl}
              target="_blank"
              rel="noopener"
              className="tap mt-5 inline-flex items-center gap-2 rounded-[3px] bg-brand-gradient px-8 py-3.5 text-body font-semibold text-canvas transition-all hover:brightness-110"
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
      <div className="rounded-card border border-hair bg-surface p-6 md:p-8">
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
          <button
            type="button"
            onClick={() => onMessageStudio(id)}
            className="tap rounded-[3px] border border-gold/50 bg-gold/[0.06] px-4 py-2 font-mono text-label uppercase text-gold transition-colors hover:bg-gold/[0.12]"
          >
            Message the studio
          </button>
          <a href="mailto:hi@ghlvideo.com" className="tap rounded-[3px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold">
            Email
          </a>
          <a href="https://wa.me/" target="_blank" rel="noopener" className="tap rounded-[3px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold">
            WhatsApp
          </a>
          <a href="/contact/" className="tap rounded-[3px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold">
            Book a call
          </a>
        </div>
      </div>

      {/* updates */}
      <div className="rounded-card border border-hair bg-surface p-6 md:p-8">
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
  if (failed)
    return (
      <div className="rounded-card border border-hair bg-surface px-6 py-12 text-center">
        <p className="font-display text-h4 text-ink">We could not load your orders.</p>
        <p className="mt-2 text-body text-muted">
          Please refresh the page, or sign in again if your session has expired.
        </p>
      </div>
    );
  if (orders.length === 0)
    return (
      <div className="rounded-card border border-hair bg-surface px-6 py-12 text-center">
        <p className="font-display text-h4 text-ink">No orders yet.</p>
        <p className="mt-2 text-body text-muted">When you place an order it will show up here.</p>
      </div>
    );

  return (
    <ul className="grid gap-3">
      {orders.map((o) => (
        <li key={o.id}>
          <button
            type="button"
            onClick={() => onOpen(o.id)}
            className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-card border border-hair bg-surface px-5 py-5 text-left transition-colors hover:border-gold/40"
          >
            <div className="min-w-0">
              {o.productCode && (
                <p className="font-mono text-label uppercase tracking-[0.12em] text-gold/80">
                  {o.productCode}
                </p>
              )}
              <p className="mt-0.5 font-display text-h4 text-ink">{o.productName ?? "Order"}</p>
              <p className="mt-1 font-mono text-label uppercase text-dim">
                {day(o.createdAt)}
                {o.invoiceNumber ? ` / ${o.invoiceNumber}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <span className="font-mono text-label uppercase text-muted">
                {STAGES.find((s) => s.key === o.stage)?.label ?? o.stage}
              </span>
              <span className={`rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${STATUS_STYLE[o.status]}`}>
                {o.status}
              </span>
              <span className="font-mono text-price font-bold text-ink [font-variant-numeric:tabular-nums]">
                {money(o.amountCents, o.currency)}
              </span>
            </div>
          </button>
        </li>
      ))}
    </ul>
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

function SubscriptionsView() {
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
      <ComingSoon
        title="No active plan."
        line="When you start a monthly editing plan it will show up here to manage."
      />
    );

  return (
    <div className="grid gap-4">
      {subs.map((s) => (
        <div key={s.id} className="rounded-card border border-hair bg-surface p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-display text-h4 text-ink">{s.planName}</p>
              <p className="mt-1 font-mono text-label uppercase text-dim">
                {money(s.amountCents, s.currency)}/mo
                {s.currentPeriodEnd
                  ? ` / ${s.cancelAtPeriodEnd ? "ends" : "renews"} ${day(s.currentPeriodEnd)}`
                  : ""}
              </p>
            </div>
            <span
              className={`rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${
                s.status === "active" ? "border-green/40 text-green" : "border-gold/40 text-gold"
              }`}
            >
              {s.status}
            </span>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            {(s.status === "active" || s.status === "trialing") && !s.cancelAtPeriodEnd ? (
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Cancel this plan at the end of the current billing period? You keep access until then.",
                    )
                  )
                    setCancel(s.id, true);
                }}
                disabled={busy}
                className="tap rounded-[3px] border border-hair px-5 py-2.5 font-mono text-label uppercase text-muted transition-colors hover:border-error/60 hover:text-error disabled:opacity-50"
              >
                Cancel plan
              </button>
            ) : null}
            {s.cancelAtPeriodEnd ? (
              <button
                type="button"
                onClick={() => setCancel(s.id, false)}
                disabled={busy}
                className="tap rounded-[3px] border border-gold/40 px-5 py-2.5 font-mono text-label uppercase text-gold transition-colors hover:border-gold disabled:opacity-50"
              >
                Resume plan
              </button>
            ) : null}
            <button
              type="button"
              onClick={manage}
              disabled={busy}
              className="tap rounded-[3px] border border-hair px-5 py-2.5 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-50"
            >
              {busy ? "..." : "Manage billing"}
            </button>
          </div>
          {err && <p className="mt-3 text-body-sm text-error">{err}</p>}
        </div>
      ))}
    </div>
  );
}

/* ---- signed-in portal (app shell) ---- */
type PortalSection = "dashboard" | "orders" | "messages" | "subscriptions";

function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h1 className="font-display text-h3 text-ink">{title}</h1>
      {subtitle ? <p className="mt-2 text-body text-muted">{subtitle}</p> : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  onClick,
}: {
  label: string;
  value: string;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap rounded-card border border-hair bg-surface px-5 py-4 text-left transition-colors hover:border-gold/40"
    >
      <p className="font-mono text-label uppercase text-dim">{label}</p>
      <p
        className={`mt-1 font-display text-h3 [font-variant-numeric:tabular-nums] ${
          accent ? "text-gold" : "text-ink"
        }`}
      >
        {value}
      </p>
    </button>
  );
}

function PortalDashboard({
  session,
  unread,
  onOpenOrder,
  onGo,
}: {
  session: Session;
  unread: number;
  onOpenOrder: (id: string) => void;
  onGo: (s: PortalSection) => void;
}) {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  useEffect(() => {
    authedFetch("/api/portal/orders")
      .then((j) => setOrders(j.orders ?? []))
      .catch(() => setOrders([]));
  }, []);

  const list = orders ?? [];
  const active = list.filter((o) => o.status === "paid" && o.stage !== "delivered");
  const delivered = list.filter((o) => o.stage === "delivered");
  const latest = list[0] ?? null;
  const num = (v: number) => (orders === null ? "—" : String(v));

  const primary =
    "tap inline-flex items-center gap-2 rounded-[3px] bg-brand-gradient px-6 py-3 text-body font-semibold text-canvas transition-all hover:brightness-110";
  const ghost =
    "tap inline-flex items-center gap-2 rounded-[3px] border border-hair px-6 py-3 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold";

  return (
    <div>
      <p className="font-mono text-label uppercase text-gold">[ Your portal ]</p>
      <h1 className="mt-3 font-display text-h2 text-ink">Welcome back.</h1>
      <p className="mt-1 font-mono text-label uppercase text-dim">{session.user.email}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Active projects" value={num(active.length)} onClick={() => onGo("orders")} />
        <StatCard
          label="Unread messages"
          value={String(unread)}
          accent={unread > 0}
          onClick={() => onGo("messages")}
        />
        <StatCard label="Delivered" value={num(delivered.length)} onClick={() => onGo("orders")} />
      </div>

      {latest ? (
        <div className="mt-6 rounded-card border border-hair bg-surface p-6">
          <p className="font-mono text-label uppercase text-muted">Latest project</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              {latest.productCode ? (
                <p className="font-mono text-label uppercase tracking-[0.12em] text-gold/80">
                  {latest.productCode}
                </p>
              ) : null}
              <p className="mt-0.5 font-display text-h4 text-ink">{latest.productName ?? "Order"}</p>
              <p className="mt-1 font-mono text-label uppercase text-dim">
                {STAGES.find((s) => s.key === latest.stage)?.label ?? latest.stage}
                {latest.invoiceNumber ? ` / ${latest.invoiceNumber}` : ""}
              </p>
            </div>
            <button type="button" onClick={() => onOpenOrder(latest.id)} className={ghost}>
              Open project
            </button>
          </div>
        </div>
      ) : orders !== null && list.length === 0 ? (
        <div className="mt-6 rounded-card border border-hair bg-surface p-6">
          <p className="font-display text-h4 text-ink">No projects yet.</p>
          <p className="mt-2 text-body text-muted">
            Browse the premade library or book a call to start a custom video.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href="/premade/" className={primary}>
              Browse videos<span aria-hidden="true">&rarr;</span>
            </a>
            <a href="/contact/" className={ghost}>
              Book a call
            </a>
          </div>
        </div>
      ) : null}

      <p className="mt-10 font-mono text-label uppercase text-dim">Quick actions</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" onClick={() => onGo("messages")} className={ghost}>
          Message the studio
        </button>
        <a href="/contact/" className={ghost}>
          Book a call
        </a>
        <a href="/premade/" className={ghost}>
          Browse videos
        </a>
        <a href="mailto:hi@ghlvideo.com" className={ghost}>
          Email us
        </a>
      </div>
    </div>
  );
}

function Portal({ session }: { session: Session }) {
  const [section, setSection] = useState<PortalSection>("dashboard");
  const [openOrder, setOpenOrder] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [msgUnread, setMsgUnread] = useState(0);

  // Poll the unread count so the Messages badge stays live from any section.
  useEffect(() => {
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
  }, []);

  const go = (s: PortalSection) => {
    setSection(s);
    setOpenOrder(null);
  };
  const messageStudio = (orderId: string) => {
    setPendingOrderId(orderId);
    setSection("messages");
  };

  const nav: { key: PortalSection; label: string }[] = [
    { key: "dashboard", label: "Dashboard" },
    { key: "orders", label: "Orders" },
    { key: "messages", label: "Messages" },
    { key: "subscriptions", label: "Subscriptions" },
  ];

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <nav className="border-b border-hair bg-surface/50 p-4 md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <ul className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
          {nav.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => go(item.key)}
                className={`tap flex items-center justify-between gap-2 whitespace-nowrap rounded-[6px] px-4 py-2.5 text-left text-body transition-colors md:w-full ${
                  section === item.key
                    ? "bg-gold/15 font-semibold text-gold"
                    : "text-muted hover:bg-white/[0.04] hover:text-ink"
                }`}
              >
                <span>{item.label}</span>
                {item.key === "messages" && msgUnread > 0 ? (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-gold" />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <section className="min-w-0 flex-1 p-6 md:p-10">
        {section === "dashboard" ? (
          <PortalDashboard
            session={session}
            unread={msgUnread}
            onOpenOrder={(id) => {
              setSection("orders");
              setOpenOrder(id);
            }}
            onGo={go}
          />
        ) : section === "orders" ? (
          openOrder ? (
            <OrderDetailView
              id={openOrder}
              onBack={() => setOpenOrder(null)}
              onMessageStudio={messageStudio}
            />
          ) : (
            <div>
              <PageHeader title="Orders" subtitle="Your projects, delivery, and invoices." />
              <div className="mt-6">
                <OrdersList onOpen={setOpenOrder} />
              </div>
            </div>
          )
        ) : section === "messages" ? (
          <MessagesView
            pendingOrderId={pendingOrderId}
            onConsumePending={() => setPendingOrderId(null)}
            onUnread={setMsgUnread}
          />
        ) : (
          <div>
            <PageHeader title="Subscriptions" subtitle="Manage your editing plan and billing." />
            <div className="mt-6">
              <SubscriptionsView />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/* ---- top bar + profile menu ---- */
function ProfileMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const initials = (email.trim()[0] ?? "?").toUpperCase();

  async function changePassword() {
    setNotice("Sending...");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/portal/set-password/`,
    });
    setNotice(error ? error.message : "Check your email for a link to change your password.");
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="tap flex items-center gap-2 rounded-full border border-hair py-1 pl-1 pr-2.5 transition-colors hover:border-gold/50"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-gradient font-display text-label font-bold text-canvas">
          {initials}
        </span>
        <span className="hidden max-w-[14rem] truncate font-mono text-label uppercase text-muted sm:inline">
          {email}
        </span>
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="text-dim">
          <path
            d="M5 8l5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-card border border-hair bg-surface p-2 shadow-2xl">
          <p className="break-all px-3 py-2 font-mono text-label uppercase text-dim">{email}</p>
          <div className="my-1 border-t border-hair" />
          <button
            type="button"
            onClick={changePassword}
            className="tap w-full rounded-[4px] px-3 py-2 text-left text-body-sm text-muted transition-colors hover:bg-white/[0.04] hover:text-ink"
          >
            Change password
          </button>
          {notice ? <p className="px-3 py-1 text-body-sm text-gold">{notice}</p> : null}
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="tap w-full rounded-[4px] px-3 py-2 text-left text-body-sm text-muted transition-colors hover:bg-white/[0.04] hover:text-error"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PortalTopBar({ session }: { session: Session | null }) {
  return (
    <header className="flex items-center justify-between border-b border-hair bg-surface px-6 py-3">
      <Link href="/portal" className="font-display text-body font-bold text-ink">
        GHL <span className="text-gradient">VIDEO</span>
        <span className="ml-2 font-mono text-label uppercase text-muted">/ Portal</span>
      </Link>
      {session ? <ProfileMenu email={session.user.email ?? ""} /> : null}
    </header>
  );
}

export function PortalClient() {
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
      <PortalTopBar session={session} />
      {!ready ? (
        <Shell>
          <p className="text-body text-muted">Loading...</p>
        </Shell>
      ) : session ? (
        <Portal session={session} />
      ) : (
        <LoginView />
      )}
    </div>
  );
}
