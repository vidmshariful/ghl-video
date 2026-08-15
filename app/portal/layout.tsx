import type { Metadata } from "next";
import { THEME_INIT_SCRIPT } from "@/components/portal/theme-init";

/* The client portal. Like /admin, it lives outside the (site) route group
 * on purpose: no marketing header/footer, no chrome, never indexed. A
 * signed-in client sees only their portal, not the website. */
export const metadata: Metadata = {
  title: "Portal | GHL Video",
  robots: { index: false, follow: false },
};

export default function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div data-surface="portal" className="min-h-screen w-full bg-canvas text-ink">
      {/* saved light/dark applied before paint; see components/portal/theme-init */}
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <a
        href="#portal-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[110] focus:rounded-[8px] focus:bg-gold focus:px-4 focus:py-2.5 focus:text-body focus:font-semibold focus:text-canvas"
      >
        Skip to content
      </a>
      <main id="portal-main">{children}</main>
    </div>
  );
}
