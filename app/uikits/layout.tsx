import type { Metadata } from "next";
import Link from "next/link";
import { assertDevOnly } from "@/components/uikits/dev-only";
import "../(sales)/sales.css";

/*
 * The dev UI kit. A live gallery of every element this platform renders,
 * built so a look-and-feel change can be tried against the whole system
 * before it touches a customer-facing page.
 *
 * DEV ONLY, and enforced rather than left to convention: assertDevOnly()
 * 404s every route under /uikits outside development. That guard is what
 * buys the kit its exemption from the part-boundary lint rules (see
 * eslint.config.mjs), since a gallery has to import all four surfaces'
 * UI at once. If the guard ever goes, the exemption has to go with it.
 *
 * The guard has to run in EVERY page too, not just here: a layout and its
 * page render in parallel, so this call alone gave a 404 status whose body
 * still carried the whole kit page in its RSC payload. See dev-only.ts.
 *
 * The route is still built and uploaded, it is only unreachable and renders
 * nothing. Stripping the files from the bundle needs a build step that is
 * not wired up, so do not describe the code as absent.
 */
export const metadata: Metadata = {
  title: "UI Kit | GHL Video",
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/uikits", label: "Overview" },
  { href: "/uikits/tokens", label: "Tokens" },
  { href: "/uikits/type", label: "Type" },
  { href: "/uikits/primitives", label: "Primitives" },
  { href: "/uikits/patterns", label: "Patterns" },
  { href: "/uikits/surfaces", label: "Surfaces" },
  { href: "/uikits/sales", label: "Sales system" },
  { href: "/uikits/leaks", label: "Leaks" },
  { href: "/uikits/boards", label: "Boards" },
] as const;

export default function UikitsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  assertDevOnly();

  return (
    <div
      data-surface="uikit"
      className="min-h-screen w-full bg-[var(--kit-bg)] text-[var(--kit-text)]"
    >
      <header className="sticky top-0 z-50 border-b border-[var(--kit-line)] bg-[var(--kit-bg)]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[76rem] flex-wrap items-center gap-x-5 gap-y-2 px-6 py-3">
          <Link
            href="/uikits"
            className="text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--kit-text)]"
          >
            UI KIT
          </Link>
          <span className="rounded-[3px] border border-[var(--kit-line)] px-2 py-0.5 text-[0.625rem] tracking-[0.1em] text-[var(--kit-warn)]">
            DEV ONLY
          </span>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-[3px] text-[0.8125rem] text-[var(--kit-dim)] transition-colors hover:text-[var(--kit-text)]"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
