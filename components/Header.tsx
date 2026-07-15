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
import { navServices, navLinks, cta, posters } from "@/lib/site";

/* Nav label in the bracket language: dim mono brackets fade in on
 * hover, stay lit on the active page. Brackets always occupy space so
 * nothing shifts. */
function BracketLabel({
  children,
  active = false,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  const bracket = (glyph: string) => (
    <span
      aria-hidden="true"
      className={`w-2 text-center font-mono text-dim transition-opacity duration-150 ${
        active ? "opacity-100" : "opacity-0 group-hover/nl:opacity-100"
      }`}
    >
      {glyph}
    </span>
  );
  return (
    <span className="flex items-center gap-1">
      {bracket("[")}
      <span
        className={`text-body font-medium transition-colors ${
          active ? "text-ink" : "text-muted group-hover/nl:text-ink"
        }`}
      >
        {children}
      </span>
      {bracket("]")}
    </span>
  );
}

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
      <Link
        href={cta.bookACall.href}
        className="group inline-flex items-center gap-2 rounded-[3px] bg-brand-gradient px-5 py-2.5 text-body font-semibold text-canvas shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
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

/* The Services trigger and its mega menu: a bounded blueprint panel
 * with three hairline-separated rows, poster thumb per service.
 * Hover-opens on desktop, click toggles everywhere, Escape and
 * outside click close. */
function ServicesMenu({ pathname }: { pathname: string | null }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = navServices.some((s) =>
    pathname?.startsWith(s.href.replace(/\/$/, "")),
  );

  const openNow = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={openNow}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls="services-menu"
        onClick={() => setOpen(!open)}
        className="group/nl flex items-center gap-1.5"
      >
        <BracketLabel active={active || open}>Services</BracketLabel>
        <svg
          viewBox="0 0 10 6"
          aria-hidden="true"
          className={`h-1.5 w-2.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M1 1l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="text-muted"
          />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id="services-menu"
            initial={{ opacity: 0, y: 6, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 6, x: "-50%" }}
            transition={{ duration: 0.18 }}
            className="absolute left-1/2 top-full z-50 w-[27rem] pt-4"
          >
            <div className="relative rounded-card border border-hair card-glass p-2 shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
              <span aria-hidden="true" className="absolute -left-1 -top-1.5 font-mono text-label leading-none text-dim/70">+</span>
              <span aria-hidden="true" className="absolute -right-1 -top-1.5 font-mono text-label leading-none text-dim/70">+</span>
              <ul className="divide-y divide-hair">
                {navServices.map((s) => (
                  <li key={s.href}>
                    <Link
                      href={s.href}
                      className="group flex items-center gap-4 rounded-[6px] px-4 py-4 transition-colors hover:bg-white/[0.03]"
                    >
                      <span
                        aria-hidden="true"
                        className={`h-2 w-2 shrink-0 rounded-[2px] bg-gold`}
                      />
                      <span className="flex-1">
                        <span className="block font-display text-body font-semibold text-ink">
                          {s.name}
                        </span>
                        <span className="mt-0.5 block text-body-sm text-muted">
                          {s.line}
                        </span>
                      </span>
                      {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
                      <img
                        src={posters[s.posterKey as keyof typeof posters]}
                        width={1280}
                        height={720}
                        alt=""
                        className="w-24 shrink-0 rounded-[4px] border border-hair object-cover brightness-[0.75] saturate-[0.8] transition-transform duration-300 [aspect-ratio:16/9] group-hover:scale-105"
                      />
                      <span
                        aria-hidden="true"
                        className="text-muted transition-transform duration-200 group-hover:translate-x-0.5"
                      >
                        &rarr;
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
        className={`shell flex items-stretch justify-between transition-all duration-300 ${
          scrolled ? "h-14" : "h-20"
        }`}
      >
        {/* zone: brand */}
        <div className="flex items-center pr-6 lg:pr-10">
          <Link href="/" aria-label="GHL Video home" className="shrink-0">
            <Logo className={scrolled ? "h-6" : "h-7"} />
          </Link>
        </div>

        {/* zone: menu, hairline-bounded */}
        <nav
          className="hidden flex-1 items-center justify-center gap-6 border-x border-hair px-6 md:flex"
          aria-label="Main"
        >
          <ServicesMenu pathname={pathname} />
          {navLinks.map((item) => (
            <Link key={item.href} href={item.href} className="group/nl">
              <BracketLabel
                active={!!pathname?.startsWith(item.href.replace(/\/$/, ""))}
              >
                {item.label}
              </BracketLabel>
            </Link>
          ))}
        </nav>

        {/* zone: CTA */}
        <div className="hidden items-center pl-6 md:flex lg:pl-10">
          <MagneticCta />
        </div>

        {/* mobile: CTA stays visible, menu behind a plain toggle */}
        <div className="flex items-center gap-3 md:hidden">
          <Link
            href={cta.bookACall.href}
            className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-[3px] bg-brand-gradient px-4 text-body-sm font-semibold text-canvas"
          >
            {cta.bookACall.label}
            <span aria-hidden="true">&rarr;</span>
          </Link>
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen(!open)}
            className="flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-[5px] rounded-[3px] border border-hair"
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
            <div className="shell flex flex-col pt-28 pb-12">
              <p className="pb-3 font-mono text-label uppercase text-dim">
                [ Services ]
              </p>
              {navServices.map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  className="flex items-center gap-3 border-t border-hair py-4"
                >
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 rounded-[2px] bg-gold`}
                  />
                  <span className="font-display text-h3 font-semibold tracking-tight text-ink">
                    {s.name}
                  </span>
                </Link>
              ))}
              <p className="pb-3 pt-8 font-mono text-label uppercase text-dim">
                [ Explore ]
              </p>
              {navLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="border-t border-hair py-4 font-display text-h3 font-semibold tracking-tight text-ink"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href={cta.bookACall.href}
                className="border-t border-hair py-4 font-display text-h3 font-semibold tracking-tight text-gold"
              >
                {cta.bookACall.label} &rarr;
              </Link>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
