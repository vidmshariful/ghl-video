/*
 * Accepted-payment marks: recognizable card-brand chips on white, so they
 * read on the dark checkout. Drawn inline (no network, no brand-asset files).
 */

function Chip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex h-7 min-w-[2.7rem] items-center justify-center gap-[3px] rounded-[5px] bg-white px-2 shadow-[0_1px_2px_rgba(0,0,0,0.35)] ${className}`}
    >
      {children}
    </span>
  );
}

function Visa() {
  return (
    <Chip>
      <span className="text-[12px] font-black italic leading-none tracking-tight text-[#1A1F71]">
        VISA
      </span>
    </Chip>
  );
}

function Mastercard() {
  return (
    <Chip>
      <svg viewBox="0 0 36 22" className="h-4" aria-hidden="true">
        <circle cx="13" cy="11" r="9" fill="#EB001B" />
        <circle cx="23" cy="11" r="9" fill="#F79E1B" />
        <path d="M18 4.2a9 9 0 0 1 0 13.6 9 9 0 0 1 0-13.6z" fill="#FF5F00" />
      </svg>
    </Chip>
  );
}

function Amex() {
  return (
    <Chip>
      <span className="rounded-[2px] bg-[#1F72CF] px-1 py-[1px] text-[8px] font-bold leading-none tracking-wide text-white">
        AMEX
      </span>
    </Chip>
  );
}

function Discover() {
  return (
    <Chip>
      <span className="text-[9.5px] font-bold leading-none tracking-tight text-[#1A1A1A]">
        DISC
        <span className="text-[#F76B1C]">O</span>
        VER
      </span>
    </Chip>
  );
}

function ApplePay() {
  return (
    <Chip>
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
        <path
          fill="#000"
          d="M17.05 12.04c-.03-2.4 1.96-3.55 2.05-3.61-1.12-1.64-2.86-1.86-3.48-1.89-1.48-.15-2.89.87-3.64.87-.75 0-1.91-.85-3.14-.83-1.62.02-3.11.94-3.94 2.39-1.68 2.91-.43 7.22 1.2 9.58.8 1.15 1.75 2.44 3 2.39 1.2-.05 1.66-.78 3.11-.78 1.45 0 1.86.78 3.13.75 1.29-.02 2.11-1.17 2.9-2.33.91-1.34 1.29-2.63 1.31-2.7-.03-.01-2.51-.96-2.53-3.82zM14.66 4.9c.66-.8 1.11-1.92.99-3.03-.95.04-2.11.63-2.8 1.43-.61.71-1.15 1.85-1 2.94 1.06.08 2.14-.54 2.81-1.34z"
        />
      </svg>
      <span className="text-[11px] font-medium leading-none text-black">Pay</span>
    </Chip>
  );
}

function GooglePay() {
  return (
    <Chip>
      <span className="text-[13px] font-bold leading-none tracking-tight text-[#4285F4]">
        G
      </span>
      <span className="text-[11px] font-medium leading-none text-[#5F6368]">Pay</span>
    </Chip>
  );
}

export function PaymentMarks() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Visa />
      <Mastercard />
      <Amex />
      <Discover />
      <ApplePay />
      <GooglePay />
    </div>
  );
}
