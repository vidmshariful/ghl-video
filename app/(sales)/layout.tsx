import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { BookCall } from "@/components/sales/BookCall";
import { getChrome } from "@/lib/chrome";
import "./sales.css";

/*
 * Sales landing pages: their own route group with NONE of the marketing
 * chrome (no header nav, footer, page-frame grid, or scroll ruler) and their
 * own scoped design system (sales.css, everything under .sp). A slim branded
 * top bar carries only the logo + a book-a-call. Outreach only, so noindex.
 * The root layout still supplies <html>, the brand fonts, and the CSS reset.
 *
 * The top bar's Book a Call opens the calendar OVER the page. It used to link
 * to /contact on the marketing site, which handed a click we paid for to a
 * page with a nav bar on it and no way back to the offer. No sales LP sends
 * anyone to the main site any more (owner decision, 25 August 2026).
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const chrome = await getChrome();
  return (
    <>
      {/* Hard-coded tracking (GTM, Google Ads, Hotjar), injected at body start
          just like the marketing site so the sales funnel is measured too. */}
      {chrome.headScripts ? (
        <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: chrome.headScripts }} />
      ) : null}
      <div data-surface="sales" className="sp">
        <div className="sp-topbar">
          <div className="sp-wrap sp-topbar-inner">
            <Logo className="h-6" />
            <BookCall className="sp-btn sp-btn--ghost sp-btn--sm" />
          </div>
        </div>
        {children}
      </div>
      {/* Body-end: GTM noscript + LeadConnector chat widget. */}
      {chrome.bodyEndScripts ? (
        <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: chrome.bodyEndScripts }} />
      ) : null}
    </>
  );
}
