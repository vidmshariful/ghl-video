"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import { Logo } from "@/components/Logo";
import { nav, cta } from "@/lib/site";

/* Light magnetic pull on the primary CTA only (brief section 6). */
function MagneticCta() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 300, damping: 24 });
  const sy = useSpring(y, { stiffness: 300, damping: 24 });

  return (
    <motion.div
      ref={ref}
      style={reduced ? undefined : { x: sx, y: sy }}
      onMouseMove={(e) => {
        if (reduced || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        x.set(((e.clientX - r.left) / r.width - 0.5) * 8);
        y.set(((e.clientY - r.top) / r.height - 0.5) * 6);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {/* quiet solid: the gradient + glow signature belongs to the
          hero and closing primaries, not the nav */}
      <Link
        href={cta.bookACall.href}
        className="group inline-flex items-center gap-2 rounded-[3px] bg-green px-5 py-2.5 text-sm font-semibold text-[#08090D] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
      >
        {cta.bookACall.label}
        <span
          aria-hidden="true"
          className="transition-transform duration-200 group-hover:translate-x-0.5"
        >
          &rarr;
        </span>
      </Link>
    </motion.div>
  );
}

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* close the menu on navigation, lock scroll while open */
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b border-hair transition-all duration-300 ${
        scrolled
          ? "bg-canvas/85 backdrop-blur-md"
          : "bg-canvas/40 backdrop-blur-sm"
      }`}
    >
      <div
        className={`shell flex items-center justify-between transition-all duration-300 ${
          scrolled ? "h-14" : "h-20"
        }`}
      >
        <Link href="/" aria-label="GHL Video home" className="shrink-0">
          <Logo className={scrolled ? "h-6" : "h-7"} />
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
          {nav.map((item) => {
            const active = pathname?.startsWith(item.href.replace(/\/$/, ""));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  active ? "text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {item.label}
                {active && (
                  <span className="mt-0.5 block h-px w-full bg-green" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:block">
          <MagneticCta />
        </div>

        {/* mobile: CTA stays visible, menu behind a plain toggle */}
        <div className="flex items-center gap-3 md:hidden">
          <Link
            href={cta.bookACall.href}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[3px] bg-green px-3.5 py-2 text-xs font-semibold text-[#08090D]"
          >
            {cta.bookACall.label}
            <span aria-hidden="true">&rarr;</span>
          </Link>
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen(!open)}
            className="flex h-9 w-9 shrink-0 flex-col items-center justify-center gap-[5px] rounded-[3px] border border-hair"
          >
            <span
              className={`h-px w-4 bg-ink transition-transform duration-200 ${open ? "translate-y-[3px] rotate-45" : ""}`}
            />
            <span
              className={`h-px w-4 bg-ink transition-transform duration-200 ${open ? "-translate-y-[3px] -rotate-45" : ""}`}
            />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            aria-label="Mobile"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            /* absolute against the fixed header (backdrop-filter would
               break a fixed child), behind the bar via -z-10 */
            className="absolute inset-x-0 top-0 -z-10 h-svh overflow-y-auto bg-canvas md:hidden"
          >
            <div className="shell flex flex-col gap-1 pt-28 pb-12">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="border-b border-hair py-4 font-display text-2xl font-semibold tracking-tight text-ink"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href={cta.bookACall.href}
                className="py-4 font-display text-2xl font-semibold tracking-tight text-green"
              >
                {cta.bookACall.label}
              </Link>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
