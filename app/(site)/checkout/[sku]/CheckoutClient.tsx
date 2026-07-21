"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { useRouter } from "next/navigation";

/*
 * On-domain checkout. Two steps so the Payment Element can mount with a
 * real client_secret: collect the buyer's details, call create-intent
 * (which reads the price server-side), then render the Stripe Payment
 * Element themed to the dark brand. Card data goes straight to Stripe and
 * never touches our server (keeps us SAQ A).
 */
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
);

const inputCls =
  "w-full rounded-[3px] border border-hair bg-surface px-4 py-3.5 text-body text-ink placeholder:text-dim focus:border-gold focus:outline-none";
const labelCls = "font-mono text-label uppercase text-muted";
const payBtnCls =
  "group inline-flex w-full items-center justify-center gap-2.5 rounded-[3px] bg-brand-gradient px-10 py-[18px] text-body font-semibold text-canvas shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_28px_rgba(0,204,0,0.28)] transition-all duration-200 hover:brightness-[1.07] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100";

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
    ".Input": { border: "1px solid #242736", backgroundColor: "#111219" },
    ".Input:focus": { border: "1px solid #FCC000", boxShadow: "none" },
    ".Label": { color: "#9096A8" },
  },
};

type Details = { name: string; email: string; company: string; phone: string };

export function CheckoutClient({
  sku,
  priceLabel,
  type,
}: {
  sku: string;
  priceLabel: string;
  type: "one_time" | "subscription";
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [successPath, setSuccessPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<Details>({
    name: "",
    email: "",
    company: "",
    phone: "",
  });

  async function startPayment(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const endpoint =
        type === "subscription"
          ? "/api/checkout/create-subscription"
          : "/api/checkout/create-intent";
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku, ...details }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not start checkout.");
      setClientSecret(j.clientSecret);
      setSuccessPath(
        type === "subscription"
          ? `/checkout/thank-you?plan=${encodeURIComponent(j.planName ?? "")}`
          : `/checkout/thank-you?order=${j.orderId}`,
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (clientSecret && successPath) {
    return (
      <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
        <PaymentStep successUrl={successPath} email={details.email} priceLabel={priceLabel} />
      </Elements>
    );
  }

  const set = (k: keyof Details) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDetails((d) => ({ ...d, [k]: e.target.value }));

  return (
    <form id="checkout-details" className="grid gap-5" onSubmit={startPayment}>
      <label className="grid gap-2">
        <span className={labelCls}>Full name</span>
        <input
          id="checkout-name"
          name="name"
          required
          autoComplete="name"
          value={details.name}
          onChange={set("name")}
          className={inputCls}
        />
      </label>
      <label className="grid gap-2">
        <span className={labelCls}>Work email</span>
        <input
          id="checkout-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={details.email}
          onChange={set("email")}
          className={inputCls}
        />
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className={labelCls}>Company / SaaS</span>
          <input
            id="checkout-company"
            name="company"
            autoComplete="organization"
            value={details.company}
            onChange={set("company")}
            className={inputCls}
          />
        </label>
        <label className="grid gap-2">
          <span className={labelCls}>Phone</span>
          <input
            id="checkout-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            value={details.phone}
            onChange={set("phone")}
            className={inputCls}
          />
        </label>
      </div>

      {error ? (
        <p role="alert" className="text-body-sm text-error">
          {error}
        </p>
      ) : null}

      <button id="checkout-continue" type="submit" disabled={loading} className={payBtnCls}>
        {loading ? "Starting checkout..." : "Continue to payment"}
        {!loading ? (
          <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
            &rarr;
          </span>
        ) : null}
      </button>
      <p className="text-center text-body-sm text-dim">
        Secured by Stripe. Your card details never touch our servers.
      </p>
    </form>
  );
}

function PaymentStep({
  successUrl,
  email,
  priceLabel,
}: {
  successUrl: string;
  email: string;
  priceLabel: string;
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
    const { error: err } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}${successUrl}`,
      },
      redirect: "if_required",
    });
    if (err) {
      // card declined / validation: stay on the page with the message
      setError(err.message ?? "Payment could not be completed.");
      setLoading(false);
    } else {
      router.push(successUrl);
    }
  }

  return (
    <form id="checkout-payment" className="grid gap-6" onSubmit={pay}>
      <PaymentElement
        id="checkout-payment-element"
        options={{ defaultValues: { billingDetails: { email } } }}
      />
      {error ? (
        <p role="alert" className="text-body-sm text-error">
          {error}
        </p>
      ) : null}
      <button
        id="checkout-pay"
        type="submit"
        disabled={!stripe || loading}
        className={payBtnCls}
      >
        {loading ? "Processing..." : `Pay ${priceLabel}`}
      </button>
      <p className="text-center text-body-sm text-dim">
        Secured by Stripe. Your card details never touch our servers.
      </p>
    </form>
  );
}
