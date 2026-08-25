"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/*
 * Book a Call, without leaving the landing page.
 *
 * Every sales LP used to link its Book a Call at /contact on the marketing
 * site, which is the one thing a paid-traffic page must never do: you buy the
 * click, then hand the visitor a site with a nav bar on it and no way back
 * into the offer. The calendar opens over the page instead, and closing it
 * puts them back exactly where they were (owner decision, 25 August 2026).
 *
 * The calendar is the same LeadConnector embed /contact runs. The widget sizes
 * its own iframe through a script that has to be re-appended after the frame
 * exists, which is why the script is added on open rather than at import.
 */

const LC_EMBED_SRC = "https://link.msgsndr.com/js/form_embed.js";
/* the Custom Video Strategy Call calendar, the same one /contact books onto */
const CALENDAR_SLUG = "quick-questionsm04owt";

export function BookCall({
  label = "Book a Call",
  className = "sp-btn sp-btn--ghost",
}: {
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    /* re-append so LeadConnector re-scans and sizes the frame it just found */
    document.querySelector(`script[src="${LC_EMBED_SRC}"]`)?.remove();
    const script = document.createElement("script");
    script.src = LC_EMBED_SRC;
    script.async = true;
    document.body.appendChild(script);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => panelRef.current?.focus(), 30);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      window.clearTimeout(t);
    };
  }, [open]);

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>

      {mounted && open
        ? createPortal(
            <div
              className="sp sp-modal"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
            >
              <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Book a call"
                tabIndex={-1}
                className="sp-modal-panel"
              >
                <div className="sp-modal-head">
                  <div>
                    <span className="sp-eyebrow">Book a call</span>
                    <p className="sp-modal-title">Pick a time that suits you.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close"
                    className="sp-modal-x"
                  >
                    &times;
                  </button>
                </div>
                <div className="sp-modal-body">
                  <iframe
                    src={`https://api.leadconnectorhq.com/widget/bookings/${CALENDAR_SLUG}`}
                    title="Book a call"
                    id={`lc-booking-${CALENDAR_SLUG}`}
                    scrolling="no"
                    className="sp-modal-frame"
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
