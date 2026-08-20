import type { Metadata } from "next";
import { THEME_INIT_SCRIPT } from "@/components/portal/theme-init";
import { pageMetadata } from "@/lib/seo";

/*
 * The public library, on the portal surface.
 *
 * Outside the (site) route group on purpose: no marketing header, no footer
 * chrome, because somebody who clicked through to a library came to browse a
 * catalogue, not to be navigated somewhere else. It wears the portal skin
 * (owner decision, August 2026) so it reads as the product rather than as a
 * brochure, and so a client stepping between this and their portal never
 * changes worlds.
 *
 * Unlike the portals themselves it IS indexable: this is the shop window.
 */
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/library/", {
    title: "The GoHighLevel Video Library",
    description:
      "Every premade GoHighLevel video: explainers, demos, feature animations, marketing videos and complete packs. Watch anything, then order it white-labeled to your SaaS. No account needed.",
    alternates: { canonical: "/library/" },
  });
}

export default function LibraryLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div data-surface="portal" className="flex min-h-screen w-full flex-col bg-canvas text-ink">
      {/* saved light/dark applied before paint, same as the portals */}
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <a
        href="#library-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[110] focus:rounded-[8px] focus:bg-gold focus:px-4 focus:py-2.5 focus:text-body focus:font-semibold focus:text-canvas"
      >
        Skip to content
      </a>
      <main id="library-main" className="flex min-h-screen flex-col">
        {children}
      </main>
    </div>
  );
}
