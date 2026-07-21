"use client";

import { useState } from "react";
import Script from "next/script";

/*
 * The booking screen, kept on-brand. HighLevel's calendar GROUP page is
 * a white screen with no theme settings, so instead of embedding it we
 * render our own call-type selector in the site's cell language and
 * embed each calendar individually; the calendars themselves are themed
 * dark with the gold primary inside HighLevel, so the whole flow stays
 * on the site's palette. The slugs come from the group's own payload.
 */
type BookingCalendar = {
  name: string;
  line: string;
  slug: string;
  mins: number;
};

export function BookingCalendars({
  calendars,
}: {
  calendars: readonly BookingCalendar[];
}) {
  const [active, setActive] = useState(0);
  const cal = calendars[active];

  return (
    <div className="grid gap-8">
      <div className="grid gap-px overflow-hidden border border-hair bg-hair sm:grid-cols-2 lg:grid-cols-4">
        {calendars.map((c, i) => (
          <button
            key={c.slug}
            type="button"
            aria-pressed={i === active}
            onClick={() => setActive(i)}
            className={`flex h-full flex-col items-start gap-3 p-6 text-left transition-colors duration-300 focus-visible:outline-offset-[-4px] ${
              i === active ? "bg-surface" : "bg-canvas hover:bg-surface"
            }`}
          >
            <span
              className={`font-mono text-label uppercase ${
                i === active ? "text-gold" : "text-dim"
              }`}
            >
              [ {c.mins} mins ]
            </span>
            <span
              className={`font-display text-h4 ${
                i === active ? "text-ink" : "text-muted"
              }`}
            >
              {c.name}
            </span>
            <span className="text-body-sm text-muted">{c.line}</span>
          </button>
        ))}
      </div>

      {/* black, not surface: the widgets' own interior is #000000, so the
          frame disappears into it instead of reading as a second tone */}
      <div className="overflow-hidden rounded-card border border-hair bg-black">
        {/* keyed remount per calendar; form_embed.js resizes each iframe
            to its content as the widget posts its height */}
        {/* the widget page carries ~60px of its own dead padding on
            desktop (less on mobile); a negative TOP margin crops it
            against the wrapper's overflow-hidden. The bottom is left
            alone: the form step sits lower than step one and a bottom
            crop cuts its Schedule Meeting button. */}
        <iframe
          key={cal.slug}
          src={`https://api.leadconnectorhq.com/widget/bookings/${cal.slug}`}
          title={`Book: ${cal.name}`}
          id={`lc-booking-${cal.slug}`}
          scrolling="no"
          className="-mt-6 block w-full max-w-full border-0 lg:-mt-[60px]"
          style={{ minHeight: "46rem", overflow: "hidden" }}
        />
      </div>

      <Script
        src="https://link.msgsndr.com/js/form_embed.js"
        strategy="afterInteractive"
      />
    </div>
  );
}
