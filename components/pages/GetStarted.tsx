"use client";

import { useState } from "react";
import Script from "next/script";
import { QuoteForm } from "@/components/QuoteForm";

/*
 * Two ways in, one section: send the brief, or talk it through first.
 * The segmented control is the same control the bundle tabs use.
 *
 * The quote tab renders the real quote form (the same one /quote runs,
 * posting to /api/quote); the call tab embeds the Custom Video Strategy
 * Call calendar from the contact page, with the same crop-and-resize
 * treatment BookingCalendars uses. The form reads best narrow, the
 * calendar needs room, so each panel carries its own width.
 */
export type GetStartedTab = {
  key: string;
  label: string;
  note: string;
  kind: "quote" | "calendar";
  calendarSlug?: string;
  calendarName?: string;
};

export function GetStarted({ tabs }: { tabs: readonly GetStartedTab[] }) {
  const [active, setActive] = useState(tabs[0].key);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  const hasCalendar = tabs.some((t) => t.kind === "calendar");

  return (
    <div>
      <div
        role="tablist"
        aria-label="How to start"
        className="mx-auto flex w-fit flex-wrap justify-center gap-1 rounded-[4px] border border-hair bg-surface/60 p-1"
      >
        {tabs.map((t) => {
          const isActive = t.key === current.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`start-tab-${t.key}`}
              aria-selected={isActive}
              aria-controls={`start-panel-${t.key}`}
              onClick={() => setActive(t.key)}
              className={`tap rounded-[3px] px-4 py-2 font-mono text-label uppercase transition-colors ${
                isActive
                  ? "bg-gold/15 font-semibold text-gold"
                  : "text-muted hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* both panels stay in the DOM; only the active one displays. The
          calendar iframe mounts only while its tab is active (keyed), so
          the widget always measures itself against a visible panel. */}
      {tabs.map((t) => (
        <div
          key={t.key}
          role="tabpanel"
          id={`start-panel-${t.key}`}
          aria-labelledby={`start-tab-${t.key}`}
          hidden={t.key !== current.key}
          className={`mx-auto mt-8 ${t.kind === "calendar" ? "max-w-4xl" : "max-w-2xl"}`}
        >
          <p className="mx-auto max-w-[var(--measure-body)] text-center text-body leading-relaxed text-muted">
            {t.note}
          </p>
          {t.kind === "quote" ? (
            <div className="mt-7 border border-hair bg-surface p-7 md:p-10">
              <QuoteForm />
            </div>
          ) : (
            t.key === current.key &&
            t.calendarSlug && (
              <div className="mt-7 overflow-hidden rounded-card border border-hair bg-black">
                {/* the widget page carries ~60px of its own dead padding on
                    desktop; the negative top margin crops it (see
                    BookingCalendars for the full note) */}
                <iframe
                  key={t.calendarSlug}
                  src={`https://api.leadconnectorhq.com/widget/bookings/${t.calendarSlug}`}
                  title={`Book: ${t.calendarName ?? t.label}`}
                  id={`lc-booking-${t.calendarSlug}`}
                  scrolling="no"
                  className="-mt-6 block w-full max-w-full border-0 lg:-mt-[60px]"
                  style={{ minHeight: "46rem", overflow: "hidden" }}
                />
              </div>
            )
          )}
        </div>
      ))}

      {hasCalendar && (
        <Script
          src="https://link.msgsndr.com/js/form_embed.js"
          strategy="afterInteractive"
        />
      )}
    </div>
  );
}
