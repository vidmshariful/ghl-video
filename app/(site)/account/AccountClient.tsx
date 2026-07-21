"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";

/*
 * The customer portal at /account. Magic-link login (passwordless), then the
 * customer's own orders with a delivery + status tracker, their producer, and
 * their invoice number. All data comes from /api/account/* server routes,
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
  amountCents: number;
  currency: string;
  status: string;
  stage: string;
  invoiceNumber: string | null;
  createdAt: string;
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative section-pad">
      <div className="shell">{children}</div>
    </section>
  );
}

/* ---- login ---- */
function LoginView() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/account`, shouldCreateUser: true },
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setSent(true);
  }

  return (
    <Shell>
      <div className="mx-auto max-w-md">
        <p className="font-mono text-label uppercase text-gold">[ Your account ]</p>
        <h1 className="mt-4 font-display text-h2 text-ink">Sign in to your portal.</h1>
        {sent ? (
          <div className="mt-8 rounded-card border border-gold/40 bg-gold/[0.06] px-6 py-8">
            <p className="font-display text-h4 text-ink">Check your email.</p>
            <p className="mt-2 text-body text-muted">
              We sent a sign-in link to <span className="text-ink">{email}</span>. Click it and you are in. No
              password needed.
            </p>
          </div>
        ) : (
          <form onSubmit={send} className="mt-8 grid gap-4">
            <p className="text-body text-muted">
              Enter the email you used at checkout and we will send you a secure sign-in link.
            </p>
            <label className="grid gap-2">
              <span className="font-mono text-label uppercase text-muted">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-[3px] border border-hair bg-surface px-4 py-3.5 text-body text-ink placeholder:text-dim focus:border-gold focus:outline-none"
              />
            </label>
            {err && <p className="text-body-sm text-error">{err}</p>}
            <button
              type="submit"
              disabled={busy}
              className="tap mt-1 rounded-[3px] bg-brand-gradient px-8 py-3.5 text-body font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60"
            >
              {busy ? "Sending..." : "Email me a sign-in link"}
            </button>
          </form>
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

function OrderDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    authedFetch(`/api/account/orders/${id}`).then((j) => {
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
        <div className="flex flex-wrap items-baseline justify-between gap-3">
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

  useEffect(() => {
    authedFetch("/api/account/orders").then((j) => {
      setOrders(j.orders ?? []);
      setLoaded(true);
    });
  }, []);

  if (!loaded) return <p className="text-body text-muted">Loading your orders...</p>;
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
              <p className="font-display text-h4 text-ink">{o.productName ?? "Order"}</p>
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

/* ---- signed-in portal ---- */
function Portal({ session }: { session: Session }) {
  const [section, setSection] = useState<"orders" | "invoices" | "subscriptions">("orders");
  const [openOrder, setOpenOrder] = useState<string | null>(null);

  const tabs: [typeof section, string][] = [
    ["orders", "Orders"],
    ["invoices", "Invoices"],
    ["subscriptions", "Subscriptions"],
  ];

  return (
    <Shell>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="font-mono text-label uppercase text-gold">[ Your account ]</p>
          <h1 className="mt-3 font-display text-h2 text-ink">Welcome back.</h1>
          <p className="mt-1 font-mono text-label uppercase text-dim">{session.user.email}</p>
        </div>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="tap rounded-[3px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
        >
          Sign out
        </button>
      </div>

      <div className="mt-8 flex gap-6 border-b border-hair">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setSection(key);
              setOpenOrder(null);
            }}
            className={`-mb-px border-b-2 pb-3 font-mono text-label uppercase transition-colors ${
              section === key ? "border-gold text-gold" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {section === "orders" ? (
          openOrder ? (
            <OrderDetailView id={openOrder} onBack={() => setOpenOrder(null)} />
          ) : (
            <OrdersList onOpen={setOpenOrder} />
          )
        ) : section === "invoices" ? (
          <ComingSoon
            title="Invoices are on the way."
            line="Downloadable invoices for every order will live here shortly. Your invoice number is on each order in the meantime."
          />
        ) : (
          <ComingSoon
            title="Subscriptions are on the way."
            line="When you are on a monthly editing plan, you will manage it here: plan, next billing date, and changes."
          />
        )}
      </div>
    </Shell>
  );
}

export function AccountClient() {
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

  if (!ready)
    return (
      <Shell>
        <p className="text-body text-muted">Loading...</p>
      </Shell>
    );
  return session ? <Portal session={session} /> : <LoginView />;
}
