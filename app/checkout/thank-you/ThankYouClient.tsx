"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/Button";

/*
 * Confirmation. Reads the order id (an unguessable UUID) from the URL and
 * polls the status endpoint: the Stripe webhook flips the order to paid a
 * beat after the redirect, so a short poll covers the gap. Shows the paid,
 * still-confirming, and failed states, each on-brand. A subscription lands
 * here with ?plan instead of ?order.
 */
type Status = "loading" | "paid" | "pending" | "failed" | "error";

type Detail = {
  productName: string | null;
  productCode: string | null;
  invoiceNumber: string | null;
  email: string | null;
  amountCents: number | null;
  currency: string;
  kind: string | null;
  videoCount: number | null;
  deliveryDays: number | null;
  bumps: { name: string; priceCents: number }[];
};

const money = (cents: number, currency: string) =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });

// fallback if the order id is somehow missing; normally the brief opens the
// tokenized intake page for this order.
const BRIEF_HREF = "/portal/";

export function ThankYouClient() {
  const params = useSearchParams();
  const orderId = params.get("order");
  const plan = params.get("plan");
  const [status, setStatus] = useState<Status>("loading");
  const [detail, setDetail] = useState<Detail | null>(null);

  useEffect(() => {
    if (plan) return; // subscriptions don't poll an order
    if (!orderId) {
      setStatus("error");
      return;
    }
    let tries = 0;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const r = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
        if (!r.ok) {
          if (active) setStatus("error");
          return;
        }
        const j = await r.json();
        if (!active) return;
        setDetail({
          productName: j.productName ?? null,
          productCode: j.productCode ?? null,
          invoiceNumber: j.invoiceNumber ?? null,
          email: j.email ?? null,
          amountCents: j.amountCents ?? null,
          currency: j.currency ?? "usd",
          kind: j.kind ?? null,
          videoCount: j.videoCount ?? null,
          deliveryDays: j.deliveryDays ?? null,
          bumps: j.bumps ?? [],
        });
        if (j.status === "paid") return setStatus("paid");
        if (j.status === "failed") return setStatus("failed");
        setStatus("pending");
        if (tries++ < 8) timer = setTimeout(poll, 2000);
      } catch {
        if (active) setStatus("error");
      }
    };
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [orderId, plan]);

  if (plan) return <PlanConfirmation plan={plan} />;

  return (
    <section className="relative section-pad">
      <div className="shell">
        {status === "paid" ? <Paid detail={detail} orderId={orderId} /> : null}
        {status === "loading" || status === "pending" ? <Confirming /> : null}
        {status === "failed" ? <Failed /> : null}
        {status === "error" ? <NotFound /> : null}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- */

function Paid({ detail, orderId }: { detail: Detail | null; orderId: string | null }) {
  const videos = detail?.videoCount ?? 1;
  const delivery = detail?.deliveryDays
    ? `${detail.deliveryDays} days after brief`
    : "5 to 7 days after brief";
  return (
    <div className="mx-auto max-w-[42rem]">
      <div className="text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-gradient shadow-[0_0_36px_rgba(0,204,0,0.3)]">
          <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true" fill="none">
            <path
              d="M5 12.5l4.5 4.5L19 7"
              stroke="var(--canvas)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <p className="mt-6 font-mono text-label uppercase tracking-[0.16em]">
          <span className="rounded-[3px] border border-gold/40 px-2 py-0.5 text-gold">
            Confirmed
          </span>{" "}
          <span className="text-muted">Payment received</span>
        </p>
        <h1 className="mt-4 font-display text-h1 leading-[1.04] text-ink">
          You are in. <span className="text-gradient">Now let us brand it.</span>
        </h1>
        <p className="mt-5 text-lede text-muted">
          Your payment is confirmed and your order is created. One quick step
          left: tell us how to brand your videos, and production starts.
        </p>
      </div>

      {/* order card */}
      <div className="mt-10 rounded-card border border-hair bg-card p-6 md:p-7">
        <div className="flex items-center justify-between border-b border-hair pb-4">
          <span className="font-mono text-label uppercase tracking-[0.14em] text-dim">
            Order confirmed
          </span>
          {detail?.invoiceNumber ? (
            <span className="font-mono text-body-sm font-semibold text-gold [font-variant-numeric:tabular-nums]">
              #{detail.invoiceNumber}
            </span>
          ) : null}
        </div>
        <dl className="mt-4 grid gap-3.5">
          <Row label="Product" value={detail?.productName ?? "Your order"} />
          {detail?.productCode ? <Row label="Code" value={detail.productCode} /> : null}
          <Row label="Videos" value={`${videos}, white-label`} />
          {detail?.bumps.length
            ? detail.bumps.map((b) => (
                <Row key={b.name} label="Add-on" value={b.name} />
              ))
            : null}
          {detail?.amountCents != null ? (
            <Row
              label="Amount paid"
              value={`${money(detail.amountCents, detail.currency)} ${detail.currency.toUpperCase()}`}
            />
          ) : null}
          <Row label="Delivery" value={delivery} />
          {detail?.email ? <Row label="Receipt sent to" value={detail.email} /> : null}
        </dl>
      </div>

      {/* branding brief */}
      <div className="mt-6 rounded-card border border-gold/40 bg-gold/[0.04] p-6 md:p-7">
        <h2 className="font-display text-h3 font-semibold text-ink">
          Complete your branding brief
        </h2>
        <p className="mt-2 text-body text-muted">
          This is what turns your order into your videos: your logo, dashboard
          theme, and voiceover preference. It takes about three minutes, and the
          delivery clock starts once it is in.
        </p>
        <Button href={orderId ? `/checkout/intake/${orderId}` : BRIEF_HREF} className="mt-5 w-full sm:w-auto">
          Start my branding brief
        </Button>
        <p className="mt-3 text-body-sm text-dim">
          A link is also in your confirmation email, so you can finish it
          anytime.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <dt className="shrink-0 text-body-sm text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right text-body font-semibold text-ink">
        {value}
      </dd>
    </div>
  );
}

function PlanConfirmation({ plan }: { plan: string }) {
  return (
    <section className="relative section-pad">
      <div className="shell">
        <div className="mx-auto max-w-[42rem] text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-gradient shadow-[0_0_36px_rgba(0,204,0,0.3)]">
            <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true" fill="none">
              <path
                d="M5 12.5l4.5 4.5L19 7"
                stroke="var(--canvas)"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <p className="mt-6 font-mono text-label uppercase tracking-[0.16em]">
            <span className="rounded-[3px] border border-gold/40 px-2 py-0.5 text-gold">
              Subscription active
            </span>
          </p>
          <h1 className="mt-4 font-display text-h1 leading-[1.04] text-ink">
            You are on {plan}.
          </h1>
          <p className="mt-5 text-lede text-muted">
            Your editing plan is live. A receipt is on its way. Head to your
            portal to send your first footage and manage the plan.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-4">
            <Button href="/portal/">Go to your portal</Button>
            <Button href="/contact/" variant="ghost">
              Book a call
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Confirming() {
  return (
    <div className="mx-auto max-w-[42rem] text-center">
      <p className="font-mono text-label uppercase text-muted">[ Confirming ]</p>
      <h1 className="mt-4 font-display text-h2 leading-[1.04] text-ink">
        Confirming your payment.
      </h1>
      <p className="mt-5 text-lede text-muted">
        This takes a few seconds. You do not need to do anything, and your card
        is not charged twice. Your receipt and branding brief arrive by email
        shortly.
      </p>
    </div>
  );
}

function Failed() {
  return (
    <div className="mx-auto max-w-[42rem] text-center">
      <p className="font-mono text-label uppercase text-error">
        [ Payment not completed ]
      </p>
      <h1 className="mt-4 font-display text-h2 leading-[1.04] text-ink">
        That payment did not go through.
      </h1>
      <p className="mt-5 text-lede text-muted">
        No charge was made. You can try again, or reach us and we will sort it
        out.
      </p>
      <div className="mt-9 flex flex-wrap justify-center gap-4">
        <Button href="/premade/">Try again</Button>
        <Link
          href="mailto:hi@ghlvideo.com"
          className="inline-flex items-center gap-2 self-center font-mono text-body font-semibold text-gold hover:underline"
        >
          hi@ghlvideo.com
        </Link>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="mx-auto max-w-[42rem] text-center">
      <p className="font-mono text-label uppercase text-muted">[ Order ]</p>
      <h1 className="mt-4 font-display text-h2 leading-[1.04] text-ink">
        We could not find that order.
      </h1>
      <p className="mt-5 text-lede text-muted">
        If you just paid, your receipt is on its way. Any questions, email
        hi@ghlvideo.com and we will help.
      </p>
      <div className="mt-9 flex justify-center">
        <Button href="/">Back to home</Button>
      </div>
    </div>
  );
}
