"use client";

import { useCallback, useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { useRouter } from "next/navigation";
import { SecurePaymentsBand } from "@/components/checkout/SecurePaymentsBand";
import { dialCodes, toE164 } from "@/lib/dial-codes";

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

/*
 * How the card fields are painted.
 *
 * Stripe renders them in a cross-origin iframe, so our custom properties do
 * not reach it and this object has to hand over concrete colours. That used
 * to mean eight hex literals copied from globals.css, which is the one leak
 * a reskin could not close: change the skin and the checkout page restyles
 * while the card fields sit there on the old palette, which reads as broken
 * on the one screen where trust matters most.
 *
 * So the values are resolved from the tokens at runtime instead of copied.
 * Same trick the scroll animation uses, for the same reason.
 *
 * Read from the checkout surface, NOT from documentElement: checkout has its
 * own skin, so the root would hand back the main site's values and the card
 * fields would quietly match the wrong surface.
 */
function appearance() {
  const el =
    (typeof document !== "undefined" &&
      document.querySelector("[data-surface='checkout']")) ||
    (typeof document !== "undefined" ? document.documentElement : null);

  /* Server render and the first paint before the surface exists both land
   * here. The fallbacks are the shipping skin, so the worst case is what
   * this file used to do unconditionally. */
  const s = el ? getComputedStyle(el) : null;
  const t = (name: string, fallback: string) =>
    s?.getPropertyValue(name).trim() || fallback;

  const gold = t("--gold", "#FCC000");
  const hair = t("--hair", "#2b2f40");
  const canvas = t("--canvas", "#08090D");
  const muted = t("--muted", "#9096A8");

  return {
    theme: "night" as const,
    variables: {
      colorPrimary: gold,
      colorBackground: t("--surface", "#111219"),
      colorText: t("--text", "#EEF0F6"),
      colorTextSecondary: muted,
      colorDanger: t("--error", "#FF6B6B"),
      fontFamily: "system-ui, sans-serif",
      borderRadius: "4px",
      spacingUnit: "3px",
    },
    rules: {
      /* match the native name/email fields beside these: hair border, canvas fill, 4px */
      ".Input": { border: `1px solid ${hair}`, backgroundColor: canvas },
      ".Input:focus": { border: `1px solid ${gold}`, boxShadow: "none" },
      ".Label": { color: muted },
      ".Tab": { border: `1px solid ${hair}`, backgroundColor: canvas },
      ".Tab:hover": { borderColor: gold },
      ".Tab--selected": {
        borderColor: gold,
        backgroundColor: t("--card", "#161821"),
      },
    },
  };
}

export type CheckoutBump = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
};

type Details = { name: string; email: string; company: string; phone: string; country: string };
const EMPTY: Details = { name: "", email: "", company: "", phone: "", country: "US" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* Tell FirstPromoter which email this tracked visitor is, right before we
 * take payment. This is FP's "signup" binding: it creates the lead its
 * Stripe integration attaches the sale to. Without it a click stays an
 * anonymous visitor and the sale never attributes. Fail-soft: tracking
 * must never break checkout. */
function fpReferral(email: string) {
  try {
    const w = window as unknown as { fpr?: (...args: unknown[]) => void };
    if (typeof w.fpr === "function") w.fpr("referral", { email });
  } catch {
    /* never block payment on tracking */
  }
}

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
const selectCls =
  "shrink-0 max-w-[8.5rem] rounded-[4px] border border-hair bg-canvas px-2.5 py-3 text-body-sm text-ink focus:border-gold focus:outline-none";
const payBtnCls =
  "group inline-flex w-full items-center justify-center gap-2.5 rounded-[3px] bg-brand-gradient px-8 py-[15px] text-body font-semibold text-canvas shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_28px_rgba(var(--green-rgb),0.25)] transition-all duration-200 hover:brightness-[1.07] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100";

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
  /* a ?code= in the checkout URL (campaign + partner links); auto-applied on
     load. The coupon is the ONE discount rail, one-time and subscription alike. */
  initialCouponCode?: string | null;
  /* the referring partner's ref (attribution only, never a discount); sent
     back with the subscription so the sale credits them */
  partnerRef?: string | null;
};

type AppliedCoupon = { code: string; label: string; discountCents: number };
/* a coupon applied on the subscription checkout: carries the terms needed to
   show how the discount lands on a recurring plan */
type SubAppliedCoupon = {
  code: string;
  label: string;
  percentOff: number | null;
  amountOffCents: number | null;
  subDuration: "once" | "forever" | "repeating" | null;
  subDurationMonths: number | null;
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
  initialCouponCode,
}: CommonProps) {
  const [details, setDetails] = useState<Details>(EMPTY);
  const [selected, setSelected] = useState<string[]>([]);
  const [step, setStep] = useState<"details" | "payment">("details");
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [couponErr, setCouponErr] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

  /* display-time check only; /finalize re-validates at pay time */
  const applyCoupon = useCallback(
    async (raw: string) => {
      const attempt = raw.trim();
      if (!attempt) return;
      setCouponBusy(true);
      setCouponErr(null);
      try {
        const r = await fetch("/api/checkout/coupon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: attempt, sku }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Could not check that code.");
        if (!j.valid) {
          setCoupon(null);
          setCouponErr(j.reason ?? "That code is not valid.");
        } else {
          setCoupon({ code: j.code, label: j.label, discountCents: j.discountCents });
        }
      } catch (err) {
        setCouponErr((err as Error).message);
      } finally {
        setCouponBusy(false);
      }
    },
    [sku],
  );

  useEffect(() => {
    if (initialCouponCode) applyCoupon(initialCouponCode);
  }, [initialCouponCode, applyCoupon]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await fetch("/api/checkout/create-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sku }),
        });
        let j: { clientSecret?: string; paymentIntentId?: string; error?: string } = {};
        try {
          j = await r.json();
        } catch {
          /* empty or non-JSON response */
        }
        if (!active) return;
        if (!r.ok || !j.clientSecret || !j.paymentIntentId) {
          return setInitError(j.error ?? "Could not load checkout.");
        }
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
  const discountCents = coupon?.discountCents ?? 0;
  const totalCents = Math.max(0, priceCents + bumpsCents - discountCents);
  const totalLabel = money(totalCents, currency);

  const set =
    (k: keyof Details) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setDetails((d) => ({ ...d, [k]: e.target.value }));
  const toggleBump = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  function next() {
    if (!details.name.trim()) return setDetailErr("Your name is required.");
    if (!EMAIL_RE.test(details.email)) return setDetailErr("A valid email is required.");
    if (!details.company.trim()) return setDetailErr("Your SaaS or company name is required.");
    if (details.phone.replace(/\D/g, "").length < 6) return setDetailErr("A valid phone number is required.");
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
              <Elements stripe={stripePromise} options={{ clientSecret, appearance: appearance() }}>
                <PayBox
                  paymentIntentId={paymentIntentId}
                  details={details}
                  selected={selected}
                  couponCode={coupon?.code ?? null}
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
        couponBox={
          <CouponBox
            coupon={coupon}
            error={couponErr}
            busy={couponBusy}
            initialInput={initialCouponCode ?? ""}
            onApply={applyCoupon}
            onRemove={() => {
              setCoupon(null);
              setCouponErr(null);
            }}
          />
        }
        discount={
          coupon
            ? {
                label: `Code ${coupon.code}, ${coupon.label}`,
                amountLabel: `-${money(coupon.discountCents, currency)}`,
              }
            : null
        }
      />
    </div>
  );
}

/* the "Have a code?" box in the order summary (one-time checkout only) */
function CouponBox({
  coupon,
  error,
  busy,
  initialInput,
  onApply,
  onRemove,
}: {
  coupon: AppliedCoupon | null;
  error: string | null;
  busy: boolean;
  initialInput: string;
  onApply: (code: string) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(Boolean(initialInput));
  const [input, setInput] = useState(initialInput.toUpperCase());

  if (coupon) {
    return (
      <div className="mt-6 flex items-center justify-between gap-3 rounded-[8px] border border-dashed border-gold/60 bg-gold/[0.06] px-3.5 py-3">
        <p className="min-w-0 text-body-sm">
          <span className="font-mono font-semibold uppercase tracking-[0.08em] text-gold">
            {coupon.code}
          </span>{" "}
          <span className="text-muted">applied, {coupon.label}</span>
        </p>
        <button
          type="button"
          onClick={onRemove}
          className="tap shrink-0 font-mono text-label uppercase text-dim transition-colors hover:text-error"
        >
          Remove
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap mt-6 self-start font-mono text-label uppercase tracking-[0.08em] text-muted transition-colors hover:text-gold"
      >
        Have a code?
      </button>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (!busy) onApply(input);
            }
          }}
          maxLength={32}
          placeholder="CODE"
          aria-label="Discount code"
          className="w-full min-w-0 rounded-[4px] border border-hair bg-canvas px-3.5 py-2.5 font-mono text-body-sm uppercase tracking-[0.08em] text-ink placeholder:text-dim/70 focus:border-gold focus:outline-none"
        />
        <button
          type="button"
          onClick={() => onApply(input)}
          disabled={busy || !input.trim()}
          className="tap shrink-0 rounded-[4px] border border-gold/50 bg-gold/10 px-4 py-2.5 font-mono text-label uppercase text-gold transition-colors hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Checking" : "Apply"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-body-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PayBox({
  paymentIntentId,
  details,
  selected,
  couponCode,
  totalLabel,
}: {
  paymentIntentId: string;
  details: Details;
  selected: string[];
  couponCode: string | null;
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
    fpReferral(details.email);
    try {
      const r = await fetch("/api/checkout/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentIntentId,
          name: details.name,
          email: details.email,
          company: details.company,
          phone: toE164(details.country, details.phone),
          bumpIds: selected,
          couponCode: couponCode ?? undefined,
        }),
      });
      let j: { orderId?: string; error?: string } = {};
      try {
        j = await r.json();
      } catch {
        /* empty or non-JSON response */
      }
      if (!r.ok || !j.orderId) {
        throw new Error(j.error ?? "Could not complete checkout. Please try again, or contact support.");
      }
      const successUrl = `/checkout/thank-you?order=${j.orderId}`;
      const { error: err } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}${successUrl}`,
          payment_method_data: {
            billing_details: {
              name: details.name,
              email: details.email,
              phone: toE164(details.country, details.phone) || undefined,
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
  partnerRef,
  initialCouponCode,
}: CommonProps) {
  const [details, setDetails] = useState<Details>(EMPTY);
  const [step, setStep] = useState<"details" | "payment">("details");
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [successPath, setSuccessPath] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [coupon, setCoupon] = useState<SubAppliedCoupon | null>(null);
  const [couponErr, setCouponErr] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

  /* display-time check only; create-subscription re-validates and applies. */
  const applyCoupon = useCallback(
    async (raw: string) => {
      const attempt = raw.trim();
      if (!attempt) return;
      setCouponBusy(true);
      setCouponErr(null);
      try {
        const r = await fetch("/api/checkout/coupon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: attempt, sku }),
        });
        let j: Record<string, unknown> = {};
        try {
          j = await r.json();
        } catch {
          /* empty or non-JSON */
        }
        if (!r.ok) throw new Error((j.error as string) ?? "Could not check that code.");
        if (!j.valid) {
          setCoupon(null);
          setCouponErr((j.reason as string) ?? "That code is not valid.");
        } else {
          setCoupon({
            code: j.code as string,
            label: j.label as string,
            percentOff: (j.percentOff as number | null) ?? null,
            amountOffCents: (j.amountOffCents as number | null) ?? null,
            subDuration: (j.subDuration as SubAppliedCoupon["subDuration"]) ?? null,
            subDurationMonths: (j.subDurationMonths as number | null) ?? null,
          });
        }
      } catch (err) {
        setCoupon(null);
        setCouponErr((err as Error).message);
      } finally {
        setCouponBusy(false);
      }
    },
    [sku],
  );

  /* partner links land with ?code=; apply it on arrival like the one-time flow */
  useEffect(() => {
    if (initialCouponCode) applyCoupon(initialCouponCode);
  }, [initialCouponCode, applyCoupon]);

  // The active discount: the applied coupon, the one discount rail. The
  // partner ref rides separately for attribution and never changes a price.
  const active: {
    label: string;
    percentOff: number | null;
    amountOffCents: number | null;
    duration: "once" | "forever" | "repeating";
    months: number | null;
  } | null = coupon
    ? {
        label: `Code ${coupon.code}`,
        percentOff: coupon.percentOff,
        amountOffCents: coupon.amountOffCents,
        duration: coupon.subDuration ?? "once",
        months: coupon.subDurationMonths,
      }
    : null;

  const monthlyDiscountCents = active
    ? active.percentOff != null
      ? Math.round((priceCents * active.percentOff) / 100)
      : Math.min(active.amountOffCents ?? 0, priceCents)
    : 0;
  const fullLabel = `${money(priceCents, currency)}/mo`;
  const payLabel = active ? `${money(priceCents - monthlyDiscountCents, currency)}/mo` : fullLabel;

  const discountAmountLabel = active
    ? active.percentOff != null
      ? `${active.percentOff}% off`
      : `${money(active.amountOffCents ?? 0, currency)} off`
    : "";
  const months = active?.months ?? 1;
  const subNote = !active
    ? undefined
    : active.duration === "forever"
      ? "Discount applies every month. Cancel anytime."
      : active.duration === "repeating"
        ? `Discount applies for your first ${months} month${months === 1 ? "" : "s"}, then ${fullLabel}. Cancel anytime.`
        : `Discount applies to your first payment, then ${fullLabel}. Cancel anytime.`;

  const set =
    (k: keyof Details) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setDetails((d) => ({ ...d, [k]: e.target.value }));

  async function next() {
    if (!details.name.trim()) return setDetailErr("Your name is required.");
    if (!EMAIL_RE.test(details.email)) return setDetailErr("A valid email is required.");
    if (!details.company.trim()) return setDetailErr("Your SaaS or company name is required.");
    if (details.phone.replace(/\D/g, "").length < 6) return setDetailErr("A valid phone number is required.");
    setDetailErr(null);
    setStarting(true);
    fpReferral(details.email);
    try {
      const r = await fetch("/api/checkout/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku,
          name: details.name,
          email: details.email,
          company: details.company,
          phone: toE164(details.country, details.phone),
          ref: partnerRef ?? undefined,
          couponCode: coupon?.code ?? undefined,
        }),
      });
      // A crashed function can return an empty body; tolerate that instead of
      // surfacing a raw "Unexpected end of JSON input" to the buyer.
      let j: { clientSecret?: string; planName?: string; error?: string } = {};
      try {
        j = await r.json();
      } catch {
        /* empty or non-JSON response */
      }
      if (!r.ok || !j.clientSecret) {
        throw new Error(j.error ?? "Could not start checkout. Please try again, or contact support.");
      }
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
            <Elements stripe={stripePromise} options={{ clientSecret, appearance: appearance() }}>
              <SubPayStep successUrl={successPath} totalLabel={payLabel} />
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
        baseLabel={fullLabel}
        chosen={[]}
        currency={currency}
        totalLabel={payLabel}
        rating={rating}
        couponBox={
          <CouponBox
            coupon={coupon ? { code: coupon.code, label: coupon.label, discountCents: monthlyDiscountCents } : null}
            error={couponErr}
            busy={couponBusy}
            initialInput={initialCouponCode ?? ""}
            onApply={applyCoupon}
            onRemove={() => {
              setCoupon(null);
              setCouponErr(null);
            }}
          />
        }
        discount={
          active
            ? {
                label: `${active.label}, ${discountAmountLabel}`,
                amountLabel: `-${money(monthlyDiscountCents, currency)}/mo`,
              }
            : null
        }
        subNote={subNote}
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
  onChange: (k: keyof Details) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
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
              <input required autoComplete="organization" value={details.company} onChange={onChange("company")} className={inputCls} placeholder="YourSaaS CRM" />
            </label>
            <label>
              <span className={labelCls}>Phone</span>
              <div className="flex gap-2">
                <select
                  aria-label="Country dial code"
                  value={details.country}
                  onChange={onChange("country")}
                  className={selectCls}
                >
                  {dialCodes.map((c) => (
                    <option key={c.iso} value={c.iso}>
                      {c.name} ({c.dial})
                    </option>
                  ))}
                </select>
                <input type="tel" required autoComplete="tel" value={details.phone} onChange={onChange("phone")} className={`${inputCls} min-w-0 flex-1`} placeholder="555 000 0000" />
              </div>
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
  couponBox = null,
  discount = null,
  subNote,
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
  couponBox?: React.ReactNode;
  discount?: { label: string; amountLabel: string } | null;
  /* overrides the default "Billed monthly / One-time" line (e.g. to spell out
     an intro discount term) */
  subNote?: string;
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
          {couponBox}
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
            {discount ? (
              <div className="flex items-baseline justify-between text-body-sm text-gold">
                <span className="truncate pr-3">{discount.label}</span>
                <span className="font-mono [font-variant-numeric:tabular-nums]">{discount.amountLabel}</span>
              </div>
            ) : null}
          </div>
          <div className="mt-4 flex items-baseline justify-between border-t border-hair pt-4">
            <span className="font-display text-h4 text-ink">Total</span>
            <span className="font-display text-price text-gold [font-variant-numeric:tabular-nums]">{totalLabel}</span>
          </div>
          <p className="mt-2 text-body-sm text-dim">
            {subNote ?? (isSub ? "Billed monthly. Cancel anytime." : "One-time payment. No subscription.")}
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
