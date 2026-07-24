"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { CheckoutProgress } from "@/components/checkout/CheckoutProgress";

/* the real team, so "Need help?" is a real face, not a stock stand-in */
const TEAM = [
  "/people/tanvir.jpg",
  "/people/shariful.jpg",
  "/people/mostafa.jpg",
  "/people/dillon.jpg",
];

/* Open the LeadConnector chat widget. Its launcher lives inside the
 * <chat-widget> web component's shadow root; retry briefly in case the
 * widget script is still loading, and fall back to the contact page. */
function openHelp() {
  let tries = 0;
  const tryOpen = () => {
    const el = document.querySelector("chat-widget");
    const btn = el?.shadowRoot?.querySelector(
      "button.lc_text-widget--bubble",
    ) as HTMLElement | null;
    if (btn) {
      btn.click();
      return;
    }
    if (tries++ < 12) window.setTimeout(tryOpen, 300);
    else window.open("/contact/", "_blank", "noopener");
  };
  tryOpen();
}

function NeedHelp() {
  return (
    <button
      type="button"
      onClick={openHelp}
      className="tap group flex shrink-0 items-center gap-3 rounded-full border border-hair bg-surface/70 py-1.5 pl-1.5 pr-4 transition-colors hover:border-gold/50"
    >
      <span className="flex -space-x-2.5">
        {TEAM.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- small avatar, remote-safe
          <img
            key={src}
            src={src}
            alt=""
            loading="eager"
            width={28}
            height={28}
            className="h-7 w-7 rounded-full border-2 border-canvas object-cover"
            style={{ zIndex: TEAM.length - i }}
          />
        ))}
      </span>
      <span className="text-body-sm font-semibold text-ink">Need help?</span>
    </button>
  );
}

/*
 * The checkout header mirrors the marketing site's menu bar so the flow feels
 * cohesive: the same shell width, the same bottom hairline, and the same three
 * zones split by vertical hairline rules (brand | progress | help). Only the
 * middle content differs, the order progress instead of the nav links.
 */
export function CheckoutHeader() {
  const pathname = usePathname();
  const active =
    pathname?.includes("/thank-you") || pathname?.includes("/intake") ? 1 : 0;
  return (
    <header className="sticky top-0 z-50 border-b border-hair bg-canvas/85 backdrop-blur-md">
      <div className="shell flex h-16 items-stretch justify-between md:h-20">
        {/* zone: brand */}
        <div className="flex items-center pr-5 md:pr-8">
          <Link href="/" aria-label="GHL Video home" className="tap shrink-0">
            <Logo className="h-6 md:h-7" />
          </Link>
        </div>

        {/* zone: progress, hairline-bounded like the main menu. Wide inner
            padding keeps the step bar compact and centered instead of
            stretching the connector lines across the whole bar. */}
        <div className="hidden flex-1 items-center justify-center border-x border-hair px-8 md:flex lg:px-[120px]">
          <CheckoutProgress active={active} compact />
        </div>

        {/* zone: help */}
        <div className="flex items-center pl-5 md:pl-8">
          <NeedHelp />
        </div>
      </div>

      {/* mobile: progress on its own hairline-topped row */}
      <div className="shell border-t border-hair py-3 md:hidden">
        <CheckoutProgress active={active} compact />
      </div>
    </header>
  );
}
