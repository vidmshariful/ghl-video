import type { Metadata } from "next";
import { getChrome } from "@/lib/chrome";
import { CheckoutHeader } from "@/components/checkout/CheckoutHeader";
import { PageFrame } from "@/components/PageFrame";

/* Checkout lives outside the (site) route group: no marketing nav, no
 * footer, never indexed. Its own minimal chrome is a header with the logo,
 * the order progress, and a Need-help affordance that opens the live chat. */
export const metadata: Metadata = {
  title: { default: "Checkout | GHL Video", template: "%s | GHL Video" },
  robots: { index: false, follow: false },
};

export default async function CheckoutLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const chrome = await getChrome();
  return (
    <div className="flex min-h-screen w-full flex-col bg-canvas text-ink">
      {/* the blueprint frame: the same vertical rails the marketing pages use,
          so checkout sections snap into the same grid */}
      <PageFrame />
      <CheckoutHeader />
      <main className="relative z-10 flex-1">{children}</main>
      {/* the backend-managed chat widget, so "Need help?" has something to
          open. No footer on checkout by design. */}
      {chrome.bodyEndScripts ? (
        <div
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: chrome.bodyEndScripts }}
        />
      ) : null}
    </div>
  );
}
