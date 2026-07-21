"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/Button";

/*
 * Confirmation. Reads the order id (an unguessable UUID) from the URL and
 * polls the status endpoint: the Stripe webhook flips the order to paid a
 * beat after the redirect, so a short poll covers the gap. Shows the paid,
 * still-confirming, and failed states, each on-brand.
 */
type Status = "loading" | "paid" | "pending" | "failed" | "error";

export function ThankYouClient() {
  const params = useSearchParams();
  const orderId = params.get("order");
  const plan = params.get("plan");
  const [status, setStatus] = useState<Status>("loading");
  const [productName, setProductName] = useState<string | null>(null);

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
        setProductName(j.productName ?? null);
        if (j.status === "paid") return setStatus("paid");
        if (j.status === "failed") return setStatus("failed");
        // still pending: the webhook may not have landed yet
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

  if (plan) {
    return (
      <section className="relative section-pad">
        <div className="shell">
          <div className="mx-auto max-w-[42rem] text-center">
            <p className="font-mono text-label uppercase text-gold">
              [ Subscription active ]
            </p>
            <h1 className="mt-4 font-display text-h1 leading-[1.04] text-ink">
              You are on {plan}.
            </h1>
            <p className="mt-5 text-lede text-muted">
              Your editing plan is live. A receipt is on its way. Sign in to your
              account to manage the plan and send your first footage.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-4">
              <Button href="/account/">Go to your account</Button>
              <Button href="/contact/" variant="ghost">
                Book a call
              </Button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative section-pad">
      <div className="shell">
        <div className="mx-auto max-w-[42rem] text-center">
          {status === "paid" ? (
            <>
              <p className="font-mono text-label uppercase text-gold">
                [ Payment complete ]
              </p>
              <h1 className="mt-4 font-display text-h1 leading-[1.04] text-ink">
                You are in. We are on it.
              </h1>
              <p className="mt-5 text-lede text-muted">
                {productName ? `${productName} is confirmed. ` : ""}
                Check your inbox for the branding intake form. Fill it out and
                the team starts your video. A receipt is on its way too.
              </p>
              <div className="mt-9 flex flex-wrap justify-center gap-4">
                <Button href="/contact/">Book a call with the team</Button>
                <Button href="/premade/" variant="ghost">
                  Browse more videos
                </Button>
              </div>
            </>
          ) : null}

          {status === "loading" || status === "pending" ? (
            <>
              <p className="font-mono text-label uppercase text-muted">
                [ Confirming ]
              </p>
              <h1 className="mt-4 font-display text-h2 leading-[1.04] text-ink">
                Confirming your payment.
              </h1>
              <p className="mt-5 text-lede text-muted">
                This takes a few seconds. You do not need to do anything, and
                your card is not charged twice. Your receipt and intake form
                will arrive by email shortly.
              </p>
            </>
          ) : null}

          {status === "failed" ? (
            <>
              <p className="font-mono text-label uppercase text-error">
                [ Payment not completed ]
              </p>
              <h1 className="mt-4 font-display text-h2 leading-[1.04] text-ink">
                That payment did not go through.
              </h1>
              <p className="mt-5 text-lede text-muted">
                No charge was made. You can try again, or reach us and we will
                sort it out.
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
            </>
          ) : null}

          {status === "error" ? (
            <>
              <p className="font-mono text-label uppercase text-muted">
                [ Order ]
              </p>
              <h1 className="mt-4 font-display text-h2 leading-[1.04] text-ink">
                We could not find that order.
              </h1>
              <p className="mt-5 text-lede text-muted">
                If you just paid, your receipt is on its way. Any questions,
                email hi@ghlvideo.com and we will help.
              </p>
              <div className="mt-9 flex justify-center">
                <Button href="/">Back to home</Button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
