import { PaymentMarks } from "@/components/checkout/PaymentMarks";

/* Reassurance strip that sits just below the Pay button, inside the payment
 * box: the secure-payment promise, the processor, and the accepted card
 * marks. Compact so it fits the card. */
export function SecurePaymentsBand() {
  return (
    <div className="border-t border-hair pt-5 text-center">
      <p className="inline-flex flex-wrap items-center justify-center gap-2 text-body-sm font-semibold text-ink">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-gold" aria-hidden="true" fill="none">
          <path d="M7 10V8a5 5 0 0 1 10 0v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <rect x="4.5" y="10" width="15" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
        </svg>
        100% secure payments, powered by{" "}
        <span className="text-gradient">Stripe</span>.
      </p>
      <p className="mt-1.5 text-body-sm text-muted">
        A receipt is emailed the moment you pay. Your card details never touch
        our servers.
      </p>
      <div className="mt-3.5">
        <PaymentMarks />
      </div>
    </div>
  );
}
