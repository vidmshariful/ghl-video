/* The real lockup, served from /logo.svg (vector from the brand kit). */
export function Logo({ className = "h-7" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
      <img src="/logo.svg" alt="GHL Video" width={912} height={206} className="h-full w-auto" />
    </span>
  );
}
