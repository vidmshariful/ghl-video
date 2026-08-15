import type { Metadata } from "next";

/* The affiliate partner portal. Like /portal and /admin it lives outside
 * the (site) route group: no marketing chrome, never indexed. Partners
 * sign in to grab their links, assets, and (soon) their stats. */
export const metadata: Metadata = {
  title: "Partner Portal | GHL Video",
  robots: { index: false, follow: false },
};

export default function PartnersLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div data-surface="portal" className="min-h-screen w-full bg-canvas text-ink">
      <a
        href="#partners-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[110] focus:rounded-[3px] focus:bg-gold focus:px-4 focus:py-2.5 focus:text-body focus:font-semibold focus:text-canvas"
      >
        Skip to content
      </a>
      <main id="partners-main">{children}</main>
    </div>
  );
}
