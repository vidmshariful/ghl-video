"use client";

import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { useRouter } from "next/navigation";
import { SecurePaymentsBand } from "@/components/checkout/SecurePaymentsBand";

/*
 * On-domain checkout, a two-step accordion inside one card. The buyer fills
 * their details, presses Next, and the Payment step unfolds. For one-time
 * purchases the PaymentIntent is created on load, so payment appears the
 * instant Next is pressed and /finalize writes the order at pay time. For
 * subscriptions, Next creates the plan (the plan needs the email). Card data
 * goes straight to Stripe, never our server.
 */
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
);

const appearance = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#FCC000",
    colorBackground: "#111219",
    colorText: "#EEF0F6",
    colorTextSecondary: "#9096A8",
    colorDanger: "#FF6B6B",
    fontFamily: "system-ui, sans-serif",
    borderRadius: "3px",
    spacingUnit: "3px",
  },
  rules: {
    ".Input": { border: "1px solid #242736", backgroundColor: "#0E0F15" },
    ".Input:focus": { border: "1px solid #FCC000", boxShadow: "none" },
    ".Label": { color: "#9096A8" },
    ".Tab": { border: "1px solid #242736", backgroundColor: "#0E0F15" },
    ".Tab:hover": { borderColor: "#FCC000" },
    ".Tab--selected": { borderColor: "#FCC000", backgroundColor: "#161821" },
  },
};

export type CheckoutBump = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
};

type Details = { name: string; email: string; company: string; phone: string };
const EMPTY: Details = { name: "", email: "", company: "", phone: "" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const money = (cents: number, currency: string) =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });

const inputCls =
  "w-full rounded-[4px] border border-hair bg-canvas px-4 py-3 text-body text-ink placeholder:text-dim/70 focus:border-gold focus:outline-none";
const labelCls =
  "mb-1.5 block font-mono text-label uppercase tracking-[0.08em] text-muted";
const payBtnCls =
  "group inline-flex w-full items-center justify-center gap-2.5 rounded-[4px] bg-brand-gradient px-8 py-[15px] text-body font-semibold text-canvas shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_28px_rgba(0,204,0,0.28)] transition-all duration-200 hover:brightness-[1.07] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100";

type CommonProps = {
  sku: string;
  code: string | null;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  type: "one_time" | "subscription";
  included: string[];
  bumps: CheckoutBump[];
  rating: string;
  clients: number;
};

export function CheckoutClient(props: CommonProps) {
  return props.type === "subscription" ? (
    <SubscriptionCheckout {...props} />
  ) : (
    <OneTimeCheckout {...props} />
  );
}

/* ---------------------------------------------------------------- */
/* One-time                                                           */
/* ---------------------------------------------------------------- */

function OneTimeCheckout({
  sku,
  code,
  name,
  description,
  priceCents,
  currency,
  included,
  bumps,
  rating,
}: CommonProps) {
  const [details, setDetails] = useState<Details>(EMPTY);
  const [selected, setSelected] = useState<string[]>([]);
  const [step, setStep] = useState<"details" | "payment">("details");
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await fetch("/api/checkout/create-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sku }),
        });
        const j = await r.json();
        if (!active) return;
        if (!r.ok) return setInitError(j.error ?? "Could not load checkout.");
        setClientSecret(j.clientSecret);
        setPaymentIntentId(j.paymentIntentId);
      } catch {
        if (active) setInitError("Could not load checkout.");
      }
    })();
    return () => {
      active = false;
    };
  }, [sku]);

  const chosen = bumps.filter((b) => selected.includes(b.id));
  const bumpsCents = chosen.reduce((s, b) => s + b.priceCents, 0);
  const totalCents = priceCents + bumpsCents;
  const totalLabel = money(totalCents, currency);

  const set =
    (k: keyof Details) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setDetails((d) => ({ ...d, [k]: e.target.value }));
  const toggleBump = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  function next() {
    if (!details.name.trim()) return setDetailErr("Your name is required.");
    if (!EMAIL_RE.test(details.email)) return setDetailErr("A valid email is required.");
    setDetailErr(null);
    setStep("payment");
  }

  return (
    <div className="grid gap-px bg-hair lg:grid-cols-2">
      <CheckoutCard>
        <DetailsBlock
          step={step}
          details={details}
          onChange={set}
          error={detailErr}
          onNext={next}
          onEdit={() => setStep("details")}
          nextLabel="Next"
        />
        <PaymentBlock open={step === "payment"}>
          {step === "payment" ? (
            clientSecret && paymentIntentId ? (
              <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
                <PayBox
                  paymentIntentId={paymentIntentId}
                  details={details}
                  selected={selected}
                  totalLabel={totalLabel}
                />
              </Elements>
            ) : initError ? (
              <ErrorLine msg={initError} />
            ) : (
              <PaymentLoading />
            )
          ) : null}
        </PaymentBlock>
      </CheckoutCard>

      <OrderSummary
        code={code}
        name={name}
        description={description}
        included={included}
        isSub={false}
        bumps={bumps}
        selected={selected}
        onToggle={toggleBump}
        baseLabel={money(priceCents, currency)}
        chosen={chosen}
        currency={currency}
        totalLabel={totalLabel}
        rating={rating}
      />
    </div>
  );
}

function PayBox({
  paymentIntentId,
  details,
  selected,
  totalLabel,
}: {
  paymentIntentId: string;
  details: Details;
  selected: string[];
  totalLabel: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/checkout/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId, ...details, bumpIds: selected }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not complete checkout.");
      const successUrl = `/checkout/thank-you?order=${j.orderId}`;
      const { error: err } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}${successUrl}`,
          payment_method_data: {
            billing_details: {
              name: details.name,
              email: details.email,
              phone: details.phone || undefined,
            },
          },
        },
        redirect: "if_required",
      });
      if (err) {
        setError(err.message ?? "Payment could not be completed.");
        setLoading(false);
      } else {
        router.push(successUrl);
      }
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={pay} className="grid gap-5">
      <PaymentElement
        options={{
          fields: {
            billingDetails: { name: "never", email: "never", phone: "never", address: "auto" },
          },
        }}
      />
      {error ? <ErrorLine msg={error} /> : null}
      <button type="submit" disabled={!stripe || loading} className={payBtnCls}>
        {loading ? "Processing..." : `Pay ${totalLabel} and start my order`}
        {!loading ? (
          <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
            &rarr;
          </span>
        ) : null}
      </button>
      <SecurePaymentsBand />
    </form>
  );
}

/* ---------------------------------------------------------------- */
/* Subscription                                                       */
/* ---------------------------------------------------------------- */

function SubscriptionCheckout({
  code,
  name,
  description,
  priceCents,
  currency,
  included,
  sku,
  rating,
}: CommonProps) {
  const [details, setDetails] = useState<Details>(EMPTY);
  const [step, setStep] = useState<"details" | "payment">("details");
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [successPath, setSuccessPath] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const totalLabel = `${money(priceCents, currency)}/mo`;
  const set =
    (k: keyof Details) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setDetails((d) => ({ ...d, [k]: e.target.value }));

  async function next() {
    if (!details.name.trim()) return setDetailErr("Your name is required.");
    if (!EMAIL_RE.test(details.email)) return setDetailErr("A valid email is required.");
    setDetailErr(null);
    setStarting(true);
    try {
      const r = await fetch("/api/checkout/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku, ...details }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not start checkout.");
      setClientSecret(j.clientSecret);
      setSuccessPath(`/checkout/thank-you?plan=${encodeURIComponent(j.planName ?? "")}`);
      setStep("payment");
    } catch (err) {
      setDetailErr((err as Error).message);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="grid gap-px bg-hair lg:grid-cols-2">
      <CheckoutCard>
        <DetailsBlock
          step={step}
          details={details}
          onChange={set}
          error={detailErr}
          onNext={next}
          onEdit={() => setStep("details")}
          nextLabel={starting ? "Starting..." : "Continue"}
          nextBusy={starting}
        />
        <PaymentBlock open={step === "payment"}>
          {step === "payment" && clientSecret && successPath ? (
            <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
              <SubPayStep successUrl={successPath} totalLabel={totalLabel} />
            </Elements>
          ) : null}
        </PaymentBlock>
      </CheckoutCard>

      <OrderSummary
        code={code}
        name={name}
        description={description}
        included={included}
        isSub
        bumps={[]}
        selected={[]}
        onToggle={() => {}}
        baseLabel={totalLabel}
        chosen={[]}
        currency={currency}
        totalLabel={totalLabel}
        rating={rating}
      />
    </div>
  );
}

function SubPayStep({ successUrl, totalLabel }: { successUrl: string; totalLabel: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);
    const { error: err } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}${successUrl}` },
      redirect: "if_required",
    });
    if (err) {
      setError(err.message ?? "Payment could not be completed.");
      setLoading(false);
    } else {
      router.push(successUrl);
    }
  }

  return (
    <form onSubmit={pay} className="grid gap-5">
      <PaymentElement />
      {error ? <ErrorLine msg={error} /> : null}
      <button type="submit" disabled={!stripe || loading} className={payBtnCls}>
        {loading ? "Processing..." : `Pay ${totalLabel} and start`}
      </button>
      <SecurePaymentsBand />
    </form>
  );
}

/* ---------------------------------------------------------------- */
/* Shared layout pieces                                               */
/* ---------------------------------------------------------------- */

/* the left "checkout box": the one highlighted surface on the page. A restrained
   brand-gradient wash over canvas makes it lead the eye; its edges are still
   drawn by the surrounding hairline mesh, so it never reads as a floating card. */
function CheckoutCard({ children }: { children: React.ReactNode }) {
  return <div className="checkout-panel flex h-full flex-col">{children}</div>;
}

function StepHead({
  num,
  label,
  state,
}: {
  num: string;
  label: string;
  state: "active" | "done" | "folded";
}) {
  return (
    <p className="flex items-center gap-2.5 font-mono text-label uppercase tracking-[0.14em]">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-[0.7rem] [font-variant-numeric:tabular-nums] ${
          state === "folded"
            ? "border border-hair text-dim"
            : "border border-gold/50 bg-gold/10 text-gold"
        }`}
      >
        {state === "done" ? (
          <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" aria-hidden="true">
            <path d="M2.5 7.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          num
        )}
      </span>
      <span className={state === "folded" ? "text-dim" : "text-ink"}>{label}</span>
    </p>
  );
}

function DetailsBlock({
  step,
  details,
  onChange,
  error,
  onNext,
  onEdit,
  nextLabel,
  nextBusy = false,
}: {
  step: "details" | "payment";
  details: Details;
  onChange: (k: keyof Details) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  error: string | null;
  onNext: () => void;
  onEdit: () => void;
  nextLabel: string;
  nextBusy?: boolean;
}) {
  const open = step === "details";
  return (
    <div className="border-b border-hair p-6 md:p-7">
      <StepHead num="01" label="Your details" state={open ? "active" : "done"} />
      {open ? (
        <>
          {/* fields stacked one below another */}
          <div className="mt-5 grid gap-4">
            <label>
              <span className={labelCls}>Full name</span>
              <input required autoComplete="name" value={details.name} onChange={onChange("name")} className={inputCls} placeholder="Jordan Reeves" />
            </label>
            <label>
              <span className={labelCls}>Work email</span>
              <input type="email" required autoComplete="email" value={details.email} onChange={onChange("email")} className={inputCls} placeholder="jordan@yoursaas.com" />
            </label>
            <label>
              <span className={labelCls}>SaaS or company name</span>
              <input autoComplete="organization" value={details.company} onChange={onChange("company")} className={inputCls} placeholder="YourSaaS CRM" />
            </label>
            <label>
              <span className={labelCls}>Phone (optional)</span>
              <input type="tel" autoComplete="tel" value={details.phone} onChange={onChange("phone")} className={inputCls} placeholder="+1 555 000 0000" />
            </label>
          </div>
          {error ? <div className="mt-4"><ErrorLine msg={error} /></div> : null}
          <button
            type="button"
            onClick={onNext}
            disabled={nextBusy}
            className={`mt-5 ${payBtnCls}`}
          >
            {nextLabel}
            {!nextBusy ? (
              <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
                &rarr;
              </span>
            ) : null}
          </button>
        </>
      ) : (
        <div className="mt-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-body font-semibold text-ink">{details.name}</p>
            <p className="mt-0.5 truncate text-body-sm text-muted">{details.email}</p>
          </div>
          <button
            type="button"
            onClick={onEdit}
            className="tap shrink-0 rounded-[3px] border border-hair px-3.5 py-1.5 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}

function PaymentBlock({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col p-6 md:p-7">
      <StepHead num="02" label="Payment" state={open ? "active" : "folded"} />
      {open ? (
        <div className="mt-5">{children}</div>
      ) : (
        <p className="mt-4 text-body-sm text-dim">
          Enter your details, then continue to pay securely.
        </p>
      )}
    </div>
  );
}

function PaymentLoading() {
  return (
    <div className="flex min-h-[9rem] flex-col items-center justify-center gap-3 rounded-[6px] border border-dashed border-hair bg-canvas/50 p-6 text-center">
      <span aria-hidden="true" className="h-6 w-6 animate-spin rounded-full border-2 border-hair border-t-gold" />
      <p className="text-body-sm text-muted">Loading secure payment...</p>
    </div>
  );
}

function ErrorLine({ msg }: { msg: string }) {
  return (
    <p role="alert" className="text-body-sm text-error">
      {msg}
    </p>
  );
}

function OrderSummary({
  code,
  name,
  description,
  included,
  isSub,
  bumps,
  selected,
  onToggle,
  baseLabel,
  chosen,
  currency,
  totalLabel,
  rating,
}: {
  code: string | null;
  name: string;
  description: string | null;
  included: string[];
  isSub: boolean;
  bumps: CheckoutBump[];
  selected: string[];
  onToggle: (id: string) => void;
  baseLabel: string;
  chosen: CheckoutBump[];
  currency: string;
  totalLabel: string;
  rating: string;
}) {
  return (
    <aside className="flex h-full flex-col bg-canvas">
      <div className="flex flex-1 flex-col p-6 md:p-7">
        <p className="font-mono text-label uppercase tracking-[0.14em] text-muted">
          Order summary
        </p>

        <div className="mt-5 flex items-start gap-4">
          <span className="relative flex h-[68px] w-[68px] shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-hair bg-surface">
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-brand-gradient opacity-[0.16]" />
            <svg viewBox="0 0 24 24" className="relative h-5 w-5 text-ink/80" aria-hidden="true">
              <path d="M8 5v14l11-7z" fill="currentColor" />
            </svg>
          </span>
          <div className="min-w-0">
            {code ? (
              <p className="font-mono text-label uppercase tracking-[0.12em] text-gold/80">{code}</p>
            ) : null}
            <p className="mt-0.5 font-display text-h4 font-semibold leading-snug text-ink">{name}</p>
            {description ? (
              <p className="mt-1 line-clamp-2 text-body-sm text-muted">{description}</p>
            ) : null}
          </div>
        </div>

        <p className="mt-6 font-mono text-label uppercase tracking-[0.12em] text-dim">
          What is included
        </p>
        <ul className="mt-3 grid gap-2.5">
          {included.map((line) => (
            <li key={line} className="flex gap-2.5 text-body-sm text-muted">
              <span aria-hidden="true" className="mt-[3px] shrink-0 text-gold">
                <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none">
                  <path d="M2.5 7.5l3 3 6-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>

        {!isSub && bumps.length > 0 ? (
          <div className="mt-6 grid gap-3">
            {bumps.map((b) => {
              const on = selected.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onToggle(b.id)}
                  aria-pressed={on}
                  className={`group/bump flex items-start gap-3 rounded-[8px] border border-dashed p-3.5 text-left transition-colors ${
                    on ? "border-gold/70 bg-gold/[0.06]" : "border-hair hover:border-gold/40"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border ${
                      on ? "border-gold bg-gold text-canvas" : "border-dim"
                    }`}
                  >
                    {on ? (
                      <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none">
                        <path d="M2.5 7.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-body-sm font-semibold text-ink">
                      {b.name}
                      <span className="ml-1.5 font-mono text-gold">Add {money(b.priceCents, currency)}</span>
                    </span>
                    {b.description ? (
                      <span className="mt-0.5 block text-body-sm leading-snug text-muted">{b.description}</span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {/* totals pinned to the bottom so the card fills its height */}
        <div className="mt-auto">
          <div className="mt-6 grid gap-2 border-t border-hair pt-5">
            <div className="flex items-baseline justify-between text-body-sm text-muted">
              <span>Subtotal</span>
              <span className="font-mono [font-variant-numeric:tabular-nums]">{baseLabel}</span>
            </div>
            {chosen.map((b) => (
              <div key={b.id} className="flex items-baseline justify-between text-body-sm text-muted">
                <span className="truncate pr-3">{b.name}</span>
                <span className="font-mono [font-variant-numeric:tabular-nums]">+{money(b.priceCents, currency)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-baseline justify-between border-t border-hair pt-4">
            <span className="font-display text-h4 text-ink">Total</span>
            <span className="font-display text-price text-gold [font-variant-numeric:tabular-nums]">{totalLabel}</span>
          </div>
          <p className="mt-2 text-body-sm text-dim">
            {isSub ? "Billed monthly. Cancel anytime." : "One-time payment. No subscription."}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-hair pt-5 font-mono text-label uppercase tracking-[0.06em] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="text-gold">&#9733;</span> {rating}
              <span className="text-dim">on Google</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-dim">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true" fill="none">
                <path d="M6 10V8a6 6 0 0 1 12 0v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              Stripe secure
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
